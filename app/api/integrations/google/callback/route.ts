import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/google/oauth";
import { encryptGoogleCredentials } from "@/lib/integrations/google/secrets";
import { upsertGoogleIntegration } from "@/services/integrations/google/repository";
import { syncGoogleIntegration } from "@/services/integrations/google/service";
import type { TenantScope } from "@/db/tenant";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectBase = new URL("/dashboard#integrations", request.url);

  if (error || !code || !stateRaw) {
    redirectBase.searchParams.set("error", error || "authorization_cancelled");
    return NextResponse.redirect(redirectBase, 303);
  }

  try {
    let state: { organizationId: string };
    try {
      state = JSON.parse(stateRaw);
    } catch {
      throw new Error("Invalid state parameter");
    }

    const tokens = await exchangeCodeForTokens(code);
    const scope: TenantScope = {
      organizationId: state.organizationId,
      userId: "system-oauth",
      role: "OWNER",
    };

    // Store GA4
    const encryptedGa4 = encryptGoogleCredentials(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: Date.now() + tokens.expires_in * 1000,
      },
      `${state.organizationId}:GA4`,
    );

    const integration = await upsertGoogleIntegration(scope, {
      provider: "GA4",
      propertyName: "Google Analytics 4 Property",
      encryptedCredentials: encryptedGa4,
      status: "CONNECTED",
    });

    // Initial sync in background or immediately
    try {
      await syncGoogleIntegration(scope, integration.id);
    } catch {}

    redirectBase.searchParams.set("connected", "google");
    return NextResponse.redirect(redirectBase, 303);
  } catch (err) {
    redirectBase.searchParams.set("error", err instanceof Error ? err.message : "oauth_failed");
    return NextResponse.redirect(redirectBase, 303);
  }
}

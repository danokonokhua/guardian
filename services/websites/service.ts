import type { TenantScope } from "@/db/tenant";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import { z } from "zod";
import {
  createWebsite,
  findWebsiteForVerification,
  listWebsites,
  setWebsiteVerification,
  type WebsiteRecord,
} from "@/services/websites/repository";

const websiteInputSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Website URL must use http or https."),
  label: z.string().trim().max(120).optional(),
  businessId: z.string().uuid().optional(),
  businessName: z.string().trim().max(120).optional(),
});

export function listConfiguredWebsites(scope: TenantScope): Promise<WebsiteRecord[]> {
  return listWebsites(scope);
}

export async function onboardWebsite(scope: TenantScope, input: unknown): Promise<WebsiteRecord> {
  const parsed = parseWith(websiteInputSchema, input, "website");
  const url = new URL(parsed.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Website URL must use http or https.");
  }
  url.hash = "";
  try {
    return await createWebsite(scope, {
      normalizedUrl: url.toString().replace(/\/$/, ""),
      hostname: url.hostname.toLowerCase(),
      label: parsed.label,
      businessId: parsed.businessId,
      businessName: parsed.businessName,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictError("A website with this hostname already exists.");
    }
    throw error;
  }
}

export async function verifyWebsite(
  scope: TenantScope,
  websiteId: string,
): Promise<{ verified: boolean; status: "VERIFIED" | "FAILED"; website: WebsiteRecord }> {
  const website = await findWebsiteForVerification(scope, websiteId);
  if (!website) throw new NotFoundError("Website");
  if (!website.verifyToken) throw new Error("Website verification is not configured.");

  let verified = false;
  try {
    const origin = new URL(website.normalizedUrl).origin;
    const response = await fetch(`${origin}/.well-known/guardian-verification.txt`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const token = (await response.text()).trim().slice(0, 256);
      verified = token === website.verifyToken;
    }
  } catch {
    verified = false;
  }
  const status = verified ? "VERIFIED" : "FAILED";
  const updated = await setWebsiteVerification(scope, websiteId, status);
  if (!updated) throw new NotFoundError("Website");
  return { verified, status, website: updated };
}

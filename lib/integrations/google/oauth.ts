import "server-only";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
];

export interface GoogleOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`
        : undefined),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const config = getGoogleOAuthConfig();
  return Boolean(config.clientId && config.clientSecret);
}

export function buildGoogleAuthUrl(organizationId: string, stateToken: string): string {
  const config = getGoogleOAuthConfig();
  if (!config.clientId || !config.redirectUri) {
    // Return sandbox mock callback URL if real credentials are not configured yet
    return `/api/integrations/google/mock-connect?orgId=${organizationId}&state=${stateToken}`;
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: JSON.stringify({ organizationId, stateToken }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const config = getGoogleOAuthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Google OAuth credentials are not configured on this server.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange Google OAuth code: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const config = getGoogleOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google OAuth credentials are not configured on this server.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google access token.");
  }

  return (await response.json()) as { access_token: string; expires_in: number };
}

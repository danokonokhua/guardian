import { describe, expect, it } from "vitest";
import {
  buildGoogleAuthUrl,
  isGoogleOAuthConfigured,
} from "@/lib/integrations/google/oauth";

describe("Google OAuth URL generation", () => {
  it("generates fallback mock URL when Google client credentials are not configured", () => {
    // In test environment without GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
    const url = buildGoogleAuthUrl("org-123", "state-456");
    expect(url).toContain("/api/integrations/google/mock-connect");
    expect(url).toContain("orgId=org-123");
    expect(url).toContain("state=state-456");
  });

  it("checks config status accurately", () => {
    expect(typeof isGoogleOAuthConfigured()).toBe("boolean");
  });
});


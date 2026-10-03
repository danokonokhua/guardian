import { describe, expect, it } from "vitest";
import {
  generateVapidToken,
  getVapidPrivateKey,
  getVapidPublicKey,
  getVapidSubject,
} from "@/services/mobile/vapid";

describe("Mobile VAPID & RFC 8292 Web Push Auth (PRD §21)", () => {
  it("provides valid public and private VAPID credentials", () => {
    const pubKey = getVapidPublicKey();
    const privKey = getVapidPrivateKey();
    const subject = getVapidSubject();

    expect(pubKey).toBeDefined();
    expect(pubKey.length).toBeGreaterThan(30);
    expect(privKey).toBeDefined();
    expect(subject.startsWith("mailto:")).toBe(true);
  });

  it("generates an RFC 8292 authorization header containing JWT and public key", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/device-token-123";
    const { authorization } = generateVapidToken(endpoint);

    expect(authorization.startsWith("vapid t=")).toBe(true);
    expect(authorization).toContain(", k=");
    expect(authorization).toContain(getVapidPublicKey());
  });

  it("handles arbitrary endpoint origins gracefully", () => {
    const endpoint = "https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB";
    const { authorization } = generateVapidToken(endpoint);

    expect(authorization).toBeDefined();
    expect(authorization.startsWith("vapid t=")).toBe(true);
  });
});


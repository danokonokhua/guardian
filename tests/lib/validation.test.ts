import { describe, expect, it } from "vitest";

import { z } from "zod";

import { ValidationError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";

describe("parseWith (validation boundary)", () => {
  const schema = z.object({
    minimumRole: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).optional(),
  });

  it("returns typed output for valid input", () => {
    expect(parseWith(schema, { minimumRole: "ADMIN" }, "query")).toEqual({
      minimumRole: "ADMIN",
    });
    expect(parseWith(schema, {}, "query")).toEqual({});
  });

  it("throws the existing ValidationError taxonomy (400 / VALIDATION_ERROR)", () => {
    try {
      parseWith(schema, { minimumRole: "DARK_LORD" }, "query");
      expect.unreachable("parseWith should have thrown");
    } catch (error) {
      const validation = error as ValidationError;
      expect(validation).toBeInstanceOf(ValidationError);
      expect(validation.status).toBe(400);
      expect(validation.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(validation.details)).toBe(true);
    }
  });

  it("reports sanitized field locations and paths", () => {
    try {
      parseWith(schema, { minimumRole: 42 }, "query");
      expect.unreachable("parseWith should have thrown");
    } catch (error) {
      const details = (error as ValidationError).details as Array<{
        location: string;
        path: string;
        message: string;
      }>;
      expect(details[0]?.location).toBe("query");
      expect(details[0]?.path).toBe("minimumRole");
      expect(typeof details[0]?.message).toBe("string");
    }
  });

  it("rejects malformed UUID path parameters with a 400", () => {
    const paramsSchema = z.object({ organizationId: z.string().uuid() });
    expect(() => parseWith(paramsSchema, { organizationId: "not-a-uuid" }, "path")).toThrow(
      ValidationError,
    );
  });

  it("does not echo received values in error details", () => {
    try {
      parseWith(schema, { minimumRole: "SUPERUSER" }, "query");
      expect.unreachable("parseWith should have thrown");
    } catch (error) {
      const serialized = JSON.stringify((error as ValidationError).details);
      expect(serialized).not.toContain("SUPERUSER");
    }
  });
});

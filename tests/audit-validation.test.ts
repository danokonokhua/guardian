import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { parseValidationTargets } from "@/lib/audit/validation";

describe("free-audit validation target parser", () => {
  it("normalizes and de-duplicates up to ten public URLs", () => {
    expect(
      parseValidationTargets([
        " https://example.com ",
        "https://example.com",
        "http://example.org/path",
      ]),
    ).toEqual(["https://example.com/", "http://example.org/path"]);
  });

  it("rejects missing, over-limit, credentialed, and non-http targets", () => {
    expect(() => parseValidationTargets([])).toThrow(ValidationError);
    expect(() =>
      parseValidationTargets(Array.from({ length: 11 }, () => "https://example.com")),
    ).toThrow("no more than 10");
    expect(() => parseValidationTargets(["https://user:pass@example.com"])).toThrow(
      "without credentials",
    );
    expect(() => parseValidationTargets(["ftp://example.com"])).toThrow("http(s) URLs");
  });
});

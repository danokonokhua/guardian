import { ValidationError } from "@/lib/errors";

const MAX_VALIDATION_TARGETS = 10;

/** Validates and de-duplicates operator-supplied real-site validation targets. */
export function parseValidationTargets(rawTargets: readonly string[]): string[] {
  if (rawTargets.length === 0) {
    throw new ValidationError("Provide at least one public website URL to validate.");
  }
  if (rawTargets.length > MAX_VALIDATION_TARGETS) {
    throw new ValidationError(
      `Provide no more than ${MAX_VALIDATION_TARGETS} website URLs at once.`,
    );
  }

  const normalized = rawTargets.map((rawTarget) => {
    const value = rawTarget.trim();
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ValidationError("Each validation target must be a valid website URL.");
    }
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new ValidationError(
        "Validation targets must use public http(s) URLs without credentials.",
      );
    }
    return url.toString();
  });

  return [...new Set(normalized)];
}

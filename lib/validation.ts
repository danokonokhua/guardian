/**
 * API validation boundary (Phase 1B-06).
 *
 * Single entry point for validating API input with zod (the validation
 * library named by the approved architecture for this phase). On failure it
 * throws the existing ValidationError taxonomy — there is no second competing
 * error system — with sanitized details (field path + message only, never the
 * received values, so malformed input can never be echoed back usefully to an
 * attacker).
 */

import { z } from "zod";

import { ValidationError } from "@/lib/errors";

/** Validates `input` against `schema`, returning typed output or throwing 400. */
export function parseWith<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  location: string,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      location,
      path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
      message: issue.message,
    }));
    throw new ValidationError("Request input is invalid.", details);
  }
  return result.data;
}

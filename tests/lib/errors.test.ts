import { describe, expect, it } from "vitest";

import {
  AppError,
  NotFoundError,
  toApiErrorBody,
  ValidationError,
  type ApiErrorBody,
} from "@/lib/errors";

describe("error subclasses", () => {
  it("ValidationError maps to 400 / VALIDATION_ERROR", () => {
    const error = new ValidationError("email must be a valid address", {
      field: "email",
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(400);
    expect(error.message).toBe("email must be a valid address");
    expect(error.details).toEqual({ field: "email" });
  });

  it("NotFoundError maps to 404 / NOT_FOUND", () => {
    const error = new NotFoundError("Website");

    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Website not found.");
  });

  it("carries the subclass name for logs and stack traces", () => {
    expect(new NotFoundError().name).toBe("NotFoundError");
    expect(new ValidationError().name).toBe("ValidationError");
  });
});

describe("toApiErrorBody", () => {
  it("exposes AppError details to the client", () => {
    const { status, body } = toApiErrorBody(
      new AppError({
        code: "CONFLICT",
        status: 409,
        message: "Website already exists",
        details: { hostname: "example.com" },
      }),
      "req-1",
    );

    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toBe("Website already exists");
    expect(body.error.details).toEqual({ hostname: "example.com" });
    expect(body.error.requestId).toBe("req-1");
  });

  it("omits the details field when absent", () => {
    const { body } = toApiErrorBody(new NotFoundError(), "req-2");
    expect("details" in (body as ApiErrorBody).error).toBe(false);
  });

  it("sanitizes unknown errors to a generic 500 without leaking internals", () => {
    const leaky = new Error("connect ECONNREFUSED 10.0.0.5 with password=hunter2");
    const { status, body } = toApiErrorBody(leaky, "req-3");

    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred.");
    expect(body.error.message).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(JSON.stringify(body)).not.toContain("stack");
    expect(body.error.requestId).toBe("req-3");
  });

  it("handles non-error thrown values without crashing", () => {
    const { status, body } = toApiErrorBody("just a string", "req-4");
    expect(status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

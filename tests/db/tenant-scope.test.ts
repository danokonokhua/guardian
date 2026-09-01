import { describe, expect, it } from "vitest";

import type { Prisma } from "@prisma/client";

import type { OrganizationContext } from "@/lib/auth/context";
import {
  createTenantScope,
  withGucContext,
  withTenantTransaction,
  type PrismaTransactionHost,
  type PrismaTxClient,
} from "@/db/tenant";

/**
 * Offline tenant-scope tests (no PostgreSQL required).
 *
 * A recording fake stands in for the Prisma transaction surface: it captures
 * every $executeRaw tagged-template call (SQL text + parameters) and every
 * $transaction callback invocation. The fake implements the exported
 * PrismaTransactionHost interface — production typing is not weakened.
 * All IDs are uuid-shaped test dummies.
 */

const ORG_A = "11111111-1111-4111-8111-111111111111";
const USER_1 = "44444444-4444-4444-8444-444444444444";

interface RawCall {
  sql: string;
  parameters: unknown[];
}

/** Builds a recording host; txClient is cast once to the production tx type. */
function recordingClient() {
  const rawCalls: RawCall[] = [];
  const txClient = {
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number> {
      rawCalls.push({ sql: strings.join("$?"), parameters: values });
      return Promise.resolve(0);
    },
  } as unknown as PrismaTxClient;
  const host: PrismaTransactionHost = {
    $transaction(callback) {
      return callback(txClient);
    },
  };
  return { host, txClient, rawCalls };
}

/** Observe ordering of GUC statements relative to the callback. */
function orderingHost(order: string[]): PrismaTransactionHost {
  return {
    $transaction(callback) {
      return callback({
        $executeRaw(strings: TemplateStringsArray): Promise<number> {
          order.push(`guc:${strings.join("$?").includes("app.org_id") ? "org" : "user"}`);
          return Promise.resolve(0);
        },
      } as unknown as PrismaTxClient);
    },
  };
}

const orgContext: OrganizationContext = {
  user: { userId: USER_1, email: "alice@example.test", name: "Alice", status: "ACTIVE" },
  membership: { organizationId: ORG_A, role: "ADMIN", status: "ACTIVE" },
  organizationId: ORG_A,
};

void ({} as Prisma.TransactionClient);

describe("TenantScope", () => {
  it("carries organizationId, userId, and role", () => {
    const scope = createTenantScope(orgContext);
    expect(scope.organizationId).toBe(ORG_A);
    expect(scope.userId).toBe(USER_1);
    expect(scope.role).toBe("ADMIN");
  });

  it("is serializable (job-payload ready) and frozen", () => {
    const scope = createTenantScope(orgContext);
    const round = JSON.parse(JSON.stringify(scope)) as ReturnType<typeof createTenantScope>;
    expect(round).toEqual(scope);
    expect(Object.isFrozen(scope)).toBe(true);
  });
});

describe("withTenantTransaction", () => {
  it("sets app.org_id and app.user_id as transaction-local parameters", async () => {
    const fake = recordingClient();
    await withTenantTransaction(createTenantScope(orgContext), async () => "done", fake.host);

    expect(fake.rawCalls.length).toBe(2);
    const orgCall = fake.rawCalls[0];
    const userCall = fake.rawCalls[1];

    // Transaction-local flag (the literal `true` third argument) is part of the SQL text.
    expect(orgCall?.sql).toContain("set_config('app.org_id'");
    expect(orgCall?.sql).toContain(", true)");
    expect(userCall?.sql).toContain("set_config('app.user_id'");
    expect(userCall?.sql).toContain(", true)");
  });

  it("passes values as parameters — never concatenated into SQL", async () => {
    const fake = recordingClient();
    await withTenantTransaction(createTenantScope(orgContext), async () => "done", fake.host);

    for (const call of fake.rawCalls) {
      expect(call.sql).not.toContain(ORG_A);
      expect(call.sql).not.toContain(USER_1);
      expect(call.parameters.length).toBe(1);
    }
    expect(fake.rawCalls[0]?.parameters[0]).toBe(ORG_A);
    expect(fake.rawCalls[1]?.parameters[0]).toBe(USER_1);
  });

  it("hands the callback the transaction-scoped client and returns its result", async () => {
    const fake = recordingClient();
    const result = await withTenantTransaction(
      createTenantScope(orgContext),
      async (tx) => {
        expect(tx).toBe(fake.txClient);
        return 42;
      },
      fake.host,
    );
    expect(result).toBe(42);
  });

  it("executes GUC statements BEFORE the callback runs", async () => {
    const order: string[] = [];
    await withTenantTransaction(
      createTenantScope(orgContext),
      async () => {
        order.push("callback");
      },
      orderingHost(order),
    );
    expect(order).toEqual(["guc:org", "guc:user", "callback"]);
  });
});

describe("withGucContext (identity bootstrap helper)", () => {
  it("sets only the provided GUCs", async () => {
    const fake = recordingClient();
    await withGucContext({ userId: USER_1 }, async () => "ok", fake.host);
    expect(fake.rawCalls.length).toBe(1);
    expect(fake.rawCalls[0]?.sql).toContain("app.user_id");
    expect(fake.rawCalls[0]?.sql).not.toContain("app.org_id");
  });

  it("refuses to run with no GUC at all (fail-closed)", async () => {
    const fake = recordingClient();
    await expect(withGucContext({}, async () => "ok", fake.host)).rejects.toThrow(
      /organizationId.*userId|userId.*organizationId/,
    );
    expect(fake.rawCalls.length).toBe(0);
  });
});

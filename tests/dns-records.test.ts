import { expect, it } from "vitest";
import { compareDns, normalizeRecords, type DnsSnapshot } from "@/lib/dns/records";
const snapshot: DnsSnapshot = {
  A: { state: "OK", records: ["203.0.113.1"] },
  AAAA: { state: "OK", records: [] },
  MX: { state: "OK", records: [] },
  NS: { state: "OK", records: [] },
  TXT: { state: "OK", records: [] },
};
it("establishes baseline without treating initial observations as changes", () => {
  expect(compareDns({}, snapshot).every((r) => r.state === "BASELINE_REQUIRED")).toBe(true);
});
it("ignores ordering, duplicates and hostname case", () => {
  expect(
    normalizeRecords("NS", ["NS2.EXAMPLE.COM.", "ns1.example.com", "ns1.example.com"]),
  ).toEqual(["ns1.example.com", "ns2.example.com"]);
});
it("normalizes equivalent IPv6 addresses", () => {
  expect(normalizeRecords("AAAA", ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"])).toEqual([
    "2001:db8::1",
  ]);
});
it("preserves case-sensitive TXT changes", () => {
  const result = compareDns(
    { TXT: ["token=ABC"] },
    { ...snapshot, TXT: { state: "OK", records: ["token=abc"] } },
  );
  expect(result[4]).toMatchObject({
    state: "CHANGED",
    added: ["token=abc"],
    removed: ["token=ABC"],
  });
});
it("does not turn lookup failure into deletion", () => {
  expect(
    compareDns(
      { A: ["203.0.113.1"] },
      { ...snapshot, A: { state: "UNKNOWN", reason: "ETIMEOUT" } },
    )[0],
  ).toMatchObject({ state: "UNKNOWN", removed: [] });
});
it("reports removal on confirmed empty record set", () => {
  expect(compareDns({ MX: ["10 mx.example.com"] }, snapshot)[2]).toMatchObject({
    state: "CHANGED",
    removed: ["10 mx.example.com"],
  });
});
it("bounds evidence instead of silently truncating", () => {
  expect(() => normalizeRecords("TXT", ["x".repeat(4097)])).toThrow();
});
it("retains a null MX across normalization and baseline comparison", () => {
  const records = normalizeRecords("MX", ["0 ."]);
  expect(records).toEqual(["0 ."]);
  expect(normalizeRecords("MX", records)).toEqual(records);
  expect(
    compareDns({ MX: records }, { ...snapshot, MX: { state: "OK", records } })[2],
  ).toMatchObject({ state: "UNCHANGED" });
});

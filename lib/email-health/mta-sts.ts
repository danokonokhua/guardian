import { evidence, type PolicyEvidence, type ReadDns } from "./types";
import { dnsName } from "./spf";
import { requestSafeOutbound } from "@/lib/security/outbound-url";

export function parseStsPolicy(
  body: string,
  source: string,
): PolicyEvidence & { patterns?: string[]; mode?: string } {
  const fields: Record<string, string[]> = {};
  const result = (state: PolicyEvidence["state"], summary: string) =>
    evidence(state, summary, source);
  for (const line of body.trimEnd().split(/\r?\n/)) {
    const field = /^([a-zA-Z0-9][a-zA-Z0-9_.-]{0,31}):[ \t]*([^\r\n]+?)[ \t]*$/.exec(line);
    if (!field) return result("INVALID", "MTA-STS policy contains a malformed line.");
    (fields[field[1]!] ??= []).push(field[2]!);
  }
  if (
    ["version", "mode", "max_age"].some((key) => fields[key]?.length !== 1) ||
    fields.version?.[0] !== "STSv1" ||
    !["enforce", "testing", "none"].includes(fields.mode?.[0] ?? "") ||
    !/^\d{1,10}$/.test(fields.max_age?.[0] ?? "")
  )
    return result("INVALID", "MTA-STS requires one valid version, mode and max_age.");
  const mode = fields.mode![0]!;
  const patterns = fields.mx ?? [];
  if (
    (mode !== "none" && !patterns.length) ||
    patterns.some(
      (p) =>
        !dnsName(p.replace(/^\*\./, "")) ||
        /[^a-zA-Z0-9.*-]/.test(p) ||
        p.replace(/^\*\./, "").includes("*") ||
        p.includes("_"),
    )
  )
    return result("INVALID", "MTA-STS MX patterns are missing or malformed.");
  const weak = mode !== "enforce" || Number(fields.max_age![0]) === 0;
  return {
    ...result(
      weak ? "WEAK" : "HEALTHY",
      weak
        ? "MTA-STS is not enforcing a cached transport policy."
        : "MTA-STS publishes an enforcing HTTPS policy.",
    ),
    mode,
    patterns,
    policy: body.slice(0, 16384),
  };
}

export async function checkMtaSts(domain: string, read: ReadDns): Promise<PolicyEvidence> {
  const source = `https://mta-sts.${domain}/.well-known/mta-sts.txt`;
  const dns = await read(`_mta-sts.${domain}`, "TXT");
  if (dns.state === "UNKNOWN")
    return evidence("UNKNOWN", "MTA-STS DNS lookup could not be completed.", source);
  const records = dns.records.filter((r) => /^v=STSv1(?:;|$)/.test(r));
  if (!records.length)
    return evidence("MISSING", "No MTA-STS policy identifier is published.", source);
  if (records.length !== 1)
    return evidence("INVALID", "Multiple MTA-STS DNS policies are published.", source, records);
  const parts = records[0]!
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const ids = parts.filter((p) => p.startsWith("id="));
  const keys = parts.map((p) => p.split("=")[0]);
  if (new Set(keys).size !== keys.length)
    return evidence("INVALID", "MTA-STS DNS record contains duplicate tags.", source, records);
  if (
    ids.length !== 1 ||
    !/^id=[a-zA-Z0-9]{1,32}$/.test(ids[0]!) ||
    parts.some((p) => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*=[^;]+$/.test(p))
  )
    return evidence("INVALID", "MTA-STS DNS policy identifier is malformed.", source, records);
  try {
    const response = await requestSafeOutbound(source, { timeoutMs: 8000, maxBodyBytes: 65536 });
    if (response.status === 404)
      return evidence(
        "INVALID",
        "MTA-STS is advertised but its HTTPS policy is missing.",
        source,
        records,
      );
    if (!response.ok || response.bodyTruncated)
      return evidence(
        "UNKNOWN",
        "MTA-STS policy could not be fetched completely over HTTPS.",
        source,
        records,
      );
    const parsed = parseStsPolicy(await response.text(), source);
    if (parsed.state === "INVALID") return { ...parsed, records };
    const mx = await read(domain, "MX");
    if (mx.state === "UNKNOWN")
      return {
        ...parsed,
        records,
        state: "UNKNOWN",
        summary: "MTA-STS policy loaded, but MX coverage could not be checked.",
      };
    const hosts = mx.records.filter((h) => h !== ".");
    if (!hosts.length)
      return {
        ...parsed,
        records,
        state: "WEAK",
        summary: "MTA-STS is published but the domain has no receiving MX hosts.",
      };
    if (
      parsed.mode !== "none" &&
      hosts.some(
        (host) =>
          !parsed.patterns!.some((pattern) => {
            const p = pattern.toLowerCase();
            return p.startsWith("*.")
              ? host.endsWith(p.slice(1)) && host.split(".").length === p.split(".").length
              : host === p;
          }),
      )
    )
      return {
        ...parsed,
        records,
        state: "INVALID",
        summary: "MTA-STS policy does not cover every published MX host.",
      };
    return {
      ...parsed,
      records,
      details: [
        "MX patterns checked; SMTP connectivity, STARTTLS and MX certificates are not probed.",
      ],
    };
  } catch {
    return evidence(
      "UNKNOWN",
      "MTA-STS HTTPS policy was unavailable or its destination was unsafe.",
      source,
      records,
    );
  }
}

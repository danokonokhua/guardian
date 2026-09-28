import { evidence, type PolicyEvidence, type ReadDns } from "./types";

export function parseDmarc(
  records: string[],
  domain: string,
): PolicyEvidence & { tags?: Record<string, string> } {
  const policies = records.filter((r) => /^v\s*=\s*DMARC1(?:\s*;|\s*$)/.test(r));
  const result = (state: PolicyEvidence["state"], summary: string) =>
    evidence(state, summary, `dns:_dmarc.${domain}:TXT`, policies);
  if (!policies.length) return result("MISSING", "No DMARC policy is published at this name.");
  if (policies.length !== 1) return result("INVALID", "Multiple DMARC policies are published.");
  const tags: Record<string, string> = {};
  for (const part of policies[0]!.split(";").filter((p) => p.trim())) {
    const tag = /^\s*([a-z][a-z0-9_]*)\s*=\s*([^;]*?)\s*$/.exec(part);
    if (!tag || Object.hasOwn(tags, tag[1]!))
      return result("INVALID", "DMARC contains malformed or duplicate tags.");
    tags[tag[1]!] = tag[2]!;
  }
  for (const key of ["p", "sp", "np"])
    if (tags[key] !== undefined && !["none", "quarantine", "reject"].includes(tags[key]!))
      return result("INVALID", "DMARC contains an invalid policy value.");
  for (const key of ["adkim", "aspf"])
    if (tags[key] !== undefined && !["r", "s"].includes(tags[key]!))
      return result("INVALID", "DMARC alignment must be relaxed or strict.");
  if (
    (tags.psd !== undefined && !["y", "n", "u"].includes(tags.psd)) ||
    (tags.t !== undefined && !["y", "n"].includes(tags.t)) ||
    (tags.pct !== undefined && (!/^\d{1,3}$/.test(tags.pct) || Number(tags.pct) > 100))
  )
    return result("INVALID", "DMARC contains an invalid testing, percentage or PSD tag.");
  for (const key of ["rua", "ruf"]) {
    if (
      tags[key] &&
      tags[key]!.split(",").some(
        (uri) => !/^mailto:[^\s@,]+@[^\s@,!]+(?:!\d+[kmgt]?)?$/i.test(uri.trim()),
      )
    )
      return result("INVALID", "DMARC reporting addresses are malformed.");
  }
  const policy = tags.p ?? "none";
  const weak =
    policy === "none" || tags.t === "y" || (tags.pct !== undefined && Number(tags.pct) < 100);
  return {
    ...result(
      weak ? "WEAK" : "HEALTHY",
      weak
        ? "DMARC is monitoring-only, in testing, or partially enforced by legacy receivers."
        : `DMARC requests ${policy} for unauthenticated mail.`,
    ),
    tags,
    policy,
  };
}

/** RFC 9989 bounded DNS tree discovery, rather than assuming a fixed parent. */
export async function checkDmarc(domain: string, read: ReadDns): Promise<PolicyEvidence> {
  const labels = domain.split(".");
  const names = [domain];
  for (let count = Math.min(labels.length - 1, 7); count >= 1; count--)
    names.push(labels.slice(-count).join("."));
  const found: Array<{ domain: string; result: ReturnType<typeof parseDmarc> }> = [];
  const notes: string[] = [];
  let invalid: PolicyEvidence | undefined;
  for (const name of names) {
    const answer = await read(`_dmarc.${name}`, "TXT");
    if (answer.state === "UNKNOWN")
      return evidence(
        "UNKNOWN",
        "DMARC policy discovery was interrupted by a DNS failure.",
        `dns:_dmarc.${name}:TXT`,
      );
    const result = parseDmarc(answer.records, name);
    notes.push(`${name}: ${result.state}`);
    if (result.state === "INVALID") {
      invalid ??= result;
      continue;
    }
    if (result.state === "MISSING") continue;
    if (name === domain) return { ...result, details: notes };
    found.push({ domain: name, result });
    if (result.tags?.psd === "n" || result.tags?.psd === "y") break;
  }
  if (invalid)
    return {
      ...invalid,
      details: [...notes, "Repair malformed published records before relying on inherited policy."],
    };
  let selected = found.at(-1);
  if (!selected)
    return evidence("MISSING", "No applicable DMARC policy was found.", `dns:_dmarc.${domain}:TXT`);
  if (selected.result.tags?.psd === "y") {
    const parent = selected.domain;
    const organizational = labels.slice(-(parent.split(".").length + 1)).join(".");
    selected = found.find((value) => value.domain === organizational) ?? selected;
  }
  const result = selected.result;
  const policy = result.tags?.sp ?? result.tags?.p ?? "none";
  const weak =
    policy === "none" ||
    result.tags?.t === "y" ||
    (result.tags?.pct !== undefined && Number(result.tags.pct) < 100);
  return {
    ...result,
    state: weak ? "WEAK" : "HEALTHY",
    policy,
    summary: `Inherited DMARC policy from ${selected.domain}: ${policy}.`,
    details: notes,
  };
}

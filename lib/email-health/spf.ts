import { isIP } from "node:net";
import { evidence, type ReadDns, type PolicyEvidence } from "./types";

export function dnsName(value: string): boolean {
  return (
    value.length <= 253 &&
    value.split(".").every((label) => /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/i.test(label))
  );
}

/** Bounded configuration analysis, not an SPF evaluation of a specific sender. */
export async function checkSpf(domain: string, read: ReadDns): Promise<PolicyEvidence> {
  let terms = 0;
  const details: string[] = [];
  async function visit(
    host: string,
    stack: string[],
  ): Promise<PolicyEvidence & { permitsAll?: boolean }> {
    const source = `dns:${host}:TXT`;
    if (stack.includes(host))
      return evidence("INVALID", "SPF include/redirect loop detected.", source);
    const answer = await read(host, "TXT");
    if (answer.state === "UNKNOWN")
      return evidence("UNKNOWN", "SPF DNS lookup could not be completed.", source);
    const records = answer.records.filter((r) => /^v=spf1(?: |$)/i.test(r));
    const result = (state: PolicyEvidence["state"], summary: string) =>
      evidence(state, summary, source, records);
    if (!records.length) return result("MISSING", "No SPF policy is published.");
    if (records.length !== 1) return result("INVALID", "Multiple SPF policies are published.");
    const tokens = records[0]!.split(/ +/).slice(1).filter(Boolean);
    let terminal: string | undefined;
    let redirect: string | undefined;
    let uncertain = false;
    let weak = false;
    const modifiers = new Set<string>();
    for (const token of tokens) {
      const modifier = /^([a-z][a-z0-9_.-]*)=(.*)$/i.exec(token);
      if (modifier) {
        const key = modifier[1]!.toLowerCase();
        if (modifiers.has(key) || !modifier[2])
          return result("INVALID", "SPF contains a duplicate or empty modifier.");
        modifiers.add(key);
        if (key === "redirect") redirect = modifier[2];
        continue;
      }
      const match = /^([+?~-]?)(all|include|a|mx|ptr|ip4|ip6|exists)(.*)$/i.exec(token);
      if (!match) return result("INVALID", "SPF contains an invalid mechanism.");
      const qualifier = match[1] || "+",
        mechanism = match[2]!.toLowerCase(),
        suffix = match[3]!;
      if (mechanism === "all") {
        if (suffix) return result("INVALID", "SPF all mechanism has an invalid argument.");
        terminal ??= qualifier;
        continue;
      }
      if (mechanism === "ip4" || mechanism === "ip6") {
        const ip = /^:([^/]+)(?:\/(\d+))?$/.exec(suffix);
        const family = mechanism === "ip4" ? 4 : 6;
        if (!ip || isIP(ip[1]!) !== family || (ip[2] && Number(ip[2]) > (family === 4 ? 32 : 128)))
          return result("INVALID", "SPF contains an invalid IP address or prefix.");
        if (terminal === undefined && qualifier === "+" && ip[2] === "0") weak = true;
        continue;
      }
      if (suffix.includes("%")) {
        uncertain = true;
        details.push("Sender-dependent SPF macros require a message context.");
        continue;
      }
      if (mechanism === "ptr") {
        uncertain = true;
        details.push("Deprecated PTR mechanism requires sender-specific evaluation.");
        continue;
      }
      const arg = /^(?::([^/]+))?(?:\/(\d+))?(?:\/\/(\d+))?$/.exec(suffix);
      if (
        !arg ||
        (arg[2] && Number(arg[2]) > 32) ||
        (arg[3] && Number(arg[3]) > 128) ||
        ((mechanism === "include" || mechanism === "exists") && (!arg[1] || arg[2] || arg[3]))
      )
        return result("INVALID", "SPF mechanism arguments are invalid.");
      const target = (arg[1] ?? host).toLowerCase().replace(/\.$/, "");
      if (!dnsName(target)) return result("INVALID", "SPF references an invalid DNS name.");
      if (terminal !== undefined) continue;
      if (++terms > 10)
        return result(
          "UNKNOWN",
          "SPF expansion exceeds the ten DNS-term analysis limit; sender-specific evaluation is required.",
        );
      if (mechanism === "include") {
        const child = await visit(target, [...stack, host]);
        details.push(`${target}: ${child.state}; ${child.records.join(" | ")}`);
        if (child.state === "MISSING" || child.state === "INVALID")
          return result("INVALID", "An SPF include is missing, malformed or cyclic.");
        if (child.state === "UNKNOWN") uncertain = true;
        // An included +all can authorize every sender.
        if (qualifier === "+" && child.permitsAll) weak = true;
      } else {
        // a/mx/exists depend on a sender and may use void DNS results legitimately.
        const resolved = await read(target, mechanism === "mx" ? "MX" : "A");
        if (resolved.state === "UNKNOWN") uncertain = true;
        else if (mechanism === "mx" && resolved.records.length > 10)
          return result("INVALID", "SPF MX expansion exceeds ten hosts.");
        uncertain = true;
        details.push(
          `${mechanism}:${target} requires sender-specific evaluation; no healthy verdict inferred.`,
        );
      }
    }
    if (redirect && terminal === undefined) {
      if (++terms > 10 || redirect.includes("%"))
        return result("UNKNOWN", "SPF redirect cannot be resolved within the bounded analysis.");
      const target = redirect.toLowerCase().replace(/\.$/, "");
      if (!dnsName(target)) return result("INVALID", "SPF redirect domain is invalid.");
      const child = await visit(target, [...stack, host]);
      details.push(`${target}: ${child.state}; ${child.records.join(" | ")}`);
      if (child.state === "MISSING" || child.state === "INVALID")
        return result("INVALID", "SPF redirect is missing, malformed or cyclic.");
      if (child.state === "UNKNOWN") uncertain = true;
      else if (child.permitsAll) weak = true;
      terminal = child.state === "HEALTHY" ? "-" : "?";
    }
    if (uncertain)
      return result(
        "UNKNOWN",
        "SPF analysis is incomplete; review sender-dependent mechanisms or unavailable DNS.",
      );
    if (weak || terminal !== "-")
      return {
        ...result(
          "WEAK",
          "SPF does not end in an effective hard-fail policy, or permits all senders.",
        ),
        permitsAll: weak || terminal === "+",
      };
    return result(
      "HEALTHY",
      "SPF configuration passed bounded syntax and include/redirect checks.",
    );
  }
  const result = await visit(domain, []);
  return { ...result, details: [...new Set(details)].slice(0, 20) };
}

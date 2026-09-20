import http from "node:http";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { ValidationError } from "@/lib/errors";

export type SafeOutboundTarget = {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
};

export type SafeOutboundResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  /** A small allow-list of response headers needed by monitoring adapters. */
  headers?: Readonly<Record<string, string>>;
  /** True when the response body was safely truncated at the configured cap. */
  bodyTruncated?: boolean;
};

const IPV4_BLOCKED_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // unspecified/current network
  [0x0a000000, 0x0affffff], // RFC 1918
  [0x64400000, 0x647fffff], // shared address space
  [0x7f000000, 0x7fffffff], // loopback
  [0xa9fe0000, 0xa9feffff], // link-local
  [0xac100000, 0xac1fffff], // RFC 1918
  [0xc0000000, 0xc00000ff], // IETF protocol assignments
  [0xc0000200, 0xc00002ff], // TEST-NET-1
  [0xc0586300, 0xc05863ff], // 6to4 relay anycast
  [0xc6120000, 0xc613ffff], // benchmarking
  [0xc6336400, 0xc63364ff], // TEST-NET-2
  [0xcb007100, 0xcb0071ff], // TEST-NET-3
  [0xc0a80000, 0xc0a8ffff], // RFC 1918
  [0xe0000000, 0xffffffff], // multicast and reserved
];

function ipv4ToNumber(address: string): number | null {
  const octets = address.split(".");
  if (octets.length !== 4) return null;
  const values = octets.map((octet) => Number(octet));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return ((values[0]! << 24) | (values[1]! << 16) | (values[2]! << 8) | values[3]!) >>> 0;
}

function parseIpv6(address: string): bigint | null {
  const withoutZone = address.split("%", 1)[0] ?? address;
  const embeddedIpv4Index = withoutZone.lastIndexOf(":");
  let input = withoutZone;
  if (embeddedIpv4Index >= 0 && withoutZone.includes(".")) {
    const embedded = ipv4ToNumber(withoutZone.slice(embeddedIpv4Index + 1));
    if (embedded === null) return null;
    const high = ((embedded >>> 16) & 0xffff).toString(16);
    const low = (embedded & 0xffff).toString(16);
    input = `${withoutZone.slice(0, embeddedIpv4Index)}:${high}:${low}`;
  }

  const sections = input.split("::");
  if (sections.length > 2) return null;
  const left = sections[0] === "" ? [] : sections[0]!.split(":");
  const right = sections.length === 2 && sections[1] !== "" ? sections[1]!.split(":") : [];
  if (
    left.some((part) => !/^[0-9a-f]{1,4}$/i.test(part)) ||
    right.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))
  ) {
    return null;
  }
  const missing = sections.length === 2 ? 8 - left.length - right.length : 0;
  if (missing < 0 || (sections.length === 1 && left.length !== 8)) return null;
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8) return null;
  return parts.reduce((value, part) => (value << 16n) | BigInt(Number.parseInt(part, 16)), 0n);
}

function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const value = ipv4ToNumber(address);
    return (
      value === null || IPV4_BLOCKED_RANGES.some(([start, end]) => value >= start && value <= end)
    );
  }
  if (isIP(address) !== 6) return true;
  const value = parseIpv6(address);
  if (value === null) return true;
  const first = Number((value >> 112n) & 0xffffn);
  const mappedIpv4 = value >> 32n === 0xffffn ? Number(value & 0xffffffffn) : null;
  if (mappedIpv4 !== null) {
    const mapped = `${mappedIpv4 >>> 24}.${(mappedIpv4 >>> 16) & 255}.${(mappedIpv4 >>> 8) & 255}.${mappedIpv4 & 255}`;
    return isBlockedAddress(mapped);
  }
  // Only global unicast IPv6 (2000::/3) is an acceptable monitoring target.
  return first < 0x2000 || first > 0x3fff;
}

function invalidOutboundUrl(
  message = "Website URL must resolve to a public address.",
): ValidationError {
  return new ValidationError(message, { field: "url" });
}

/** Resolves a URL and rejects destinations that must never be reached by the server. */
export async function resolveSafeOutboundUrl(rawUrl: string): Promise<SafeOutboundTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw invalidOutboundUrl("Website URL must be a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw invalidOutboundUrl("Website URL must use http or https.");
  }
  if (url.username !== "" || url.password !== "") {
    throw invalidOutboundUrl("Website URL must not contain embedded credentials.");
  }

  const hostname =
    url.hostname.startsWith("[") && url.hostname.endsWith("]")
      ? url.hostname.slice(1, -1)
      : url.hostname;
  if (hostname.length === 0) throw invalidOutboundUrl();

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses =
      isIP(hostname) !== 0
        ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
        : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw invalidOutboundUrl("Website URL could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw invalidOutboundUrl();
  }
  // Prefer IPv4 when a hostname publishes both families. Some hosts have a
  // reachable IPv6 DNS record but no working IPv6 route from the worker;
  // choosing IPv4 first avoids false transport failures while retaining the
  // all-address SSRF safety check above.
  const selected = addresses.find(({ family }) => family === 4) ?? addresses[0]!;
  return { url, hostname, address: selected.address, family: selected.family as 4 | 6 };
}

/** Pins TLS connections to the address checked by resolveSafeOutboundUrl. */
export function pinnedLookup(target: SafeOutboundTarget): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  };
}

/**
 * Sends one request to the already-validated address. Native http(s) is used
 * so the lookup callback pins the socket to the address checked above;
 * redirects are intentionally not followed.
 */
export async function requestSafeOutbound(
  rawUrl: string,
  options: {
    method?: "GET" | "HEAD";
    timeoutMs?: number;
    maxBodyBytes?: number;
    truncateBody?: boolean;
  } = {},
): Promise<SafeOutboundResponse> {
  const target = await resolveSafeOutboundUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBodyBytes = options.maxBodyBytes ?? 64 * 1024;
  const requestOptions = {
    method: options.method ?? "GET",
    timeout: timeoutMs,
    lookup: pinnedLookup(target),
    servername: target.hostname,
  };
  const request = target.url.protocol === "https:" ? https.request : http.request;

  return new Promise<SafeOutboundResponse>((resolve, reject) => {
    const clientRequest = request(target.url, requestOptions, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let bodyTruncated = false;
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        response.destroy(error);
        reject(error);
      };
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > maxBodyBytes) {
          if (!options.truncateBody) {
            fail(new Error("Outbound response exceeded the safety limit."));
            return;
          }
          bodyTruncated = true;
          response.removeAllListeners("data");
          response.resume();
          return;
        }
        chunks.push(buffer);
      });
      response.once("error", fail);
      response.once("end", () => {
        if (settled) return;
        settled = true;
        const status = response.statusCode ?? 0;
        const body = Buffer.concat(chunks).toString("utf8");
        const headers: Record<string, string> = {};
        // Keep this list deliberately small: adapters need security/indexability
        // metadata, but callers must never receive arbitrary upstream headers.
        for (const name of [
          "content-type",
          "x-robots-tag",
          "location",
          "strict-transport-security",
          "content-security-policy",
          "content-security-policy-report-only",
          "x-content-type-options",
          "x-frame-options",
          "referrer-policy",
          "permissions-policy",
        ] as const) {
          const value = response.headers[name];
          if (typeof value === "string") headers[name] = value.slice(0, 1_000);
          else if (Array.isArray(value)) headers[name] = value.join(", ").slice(0, 1_000);
        }
        resolve({
          ok: status >= 200 && status < 300,
          status,
          text: async () => body,
          headers,
          ...(bodyTruncated ? { bodyTruncated: true } : {}),
        });
      });
    });
    clientRequest.once("timeout", () =>
      clientRequest.destroy(new Error("Outbound request timed out.")),
    );
    clientRequest.once("error", reject);
    clientRequest.end();
  });
}

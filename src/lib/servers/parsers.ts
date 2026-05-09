/**
 * Strict protocol parsers + sanitizer.
 *
 * Decodes raw subscription strings into a normalized ParsedNode shape.
 * Anything malformed is dropped (returns null) — never throws to the caller.
 *
 * Supported:
 *   - vless://uuid@host:port?params#tag
 *   - vmess://base64(json)
 *   - ss://method:password@host:port (legacy)
 *     ss://base64(method:password)@host:port (SIP002)
 *     ss://base64(method:password@host:port)#tag (legacy single-blob)
 *   - trojan://password@host:port?sni=...&type=...#tag
 */

export type ParsedNode = {
  protocol: "vless" | "vmess" | "shadowsocks" | "trojan";
  host: string;
  port: number;
  /** Raw original string — preserved for handing to the engine. */
  config: string;
  /** Optional human label from the URI fragment. */
  tag?: string;
  /** Protocol-specific extras (uuid, method, sni, etc.) */
  meta: Record<string, string>;
};

const HOST_RE = /^[a-z0-9.\-_]+$/i;

function safeDecodeBase64(input: string): string | null {
  try {
    // url-safe base64 → standard
    let s = input.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    if (typeof atob === "function") return atob(s);
    // node fallback
    return Buffer.from(s, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function validHostPort(host: string, port: number): boolean {
  if (!host || !HOST_RE.test(host)) return false;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return false;
  return true;
}

function parseVless(raw: string): ParsedNode | null {
  // vless://uuid@host:port?query#tag
  const m = /^vless:\/\/([^@]+)@([^:/?#]+):(\d+)(\?[^#]*)?(#.*)?$/i.exec(raw);
  if (!m) return null;
  const [, uuid, host, portStr, query, frag] = m;
  const port = Number(portStr);
  if (!validHostPort(host, port)) return null;
  const params = new URLSearchParams(query?.slice(1) ?? "");
  const meta: Record<string, string> = { uuid };
  for (const [k, v] of params.entries()) meta[k] = v;
  return {
    protocol: "vless",
    host,
    port,
    config: raw,
    tag: frag ? decodeURIComponent(frag.slice(1)) : undefined,
    meta,
  };
}

function parseVmess(raw: string): ParsedNode | null {
  const body = raw.slice("vmess://".length);
  const decoded = safeDecodeBase64(body);
  if (!decoded) return null;
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(decoded);
  } catch {
    return null;
  }
  const host = String(json.add ?? "");
  const port = Number(json.port);
  if (!validHostPort(host, port)) return null;
  const meta: Record<string, string> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v == null) continue;
    meta[k] = String(v);
  }
  return {
    protocol: "vmess",
    host,
    port,
    config: raw,
    tag: typeof json.ps === "string" ? json.ps : undefined,
    meta,
  };
}

function parseShadowsocks(raw: string): ParsedNode | null {
  // SIP002:  ss://base64(method:password)@host:port[/?plugin=...]#tag
  // Legacy:  ss://base64(method:password@host:port)#tag
  const noScheme = raw.slice("ss://".length);
  const hashIdx = noScheme.indexOf("#");
  const tag = hashIdx >= 0 ? decodeURIComponent(noScheme.slice(hashIdx + 1)) : undefined;
  const body = hashIdx >= 0 ? noScheme.slice(0, hashIdx) : noScheme;

  // Try SIP002 first (has @)
  const at = body.lastIndexOf("@");
  if (at > 0) {
    const userInfoRaw = body.slice(0, at);
    const hostPart = body.slice(at + 1).split("/")[0];
    const decodedUser = safeDecodeBase64(userInfoRaw) ?? userInfoRaw;
    const colon = decodedUser.indexOf(":");
    if (colon < 0) return null;
    const method = decodedUser.slice(0, colon);
    const password = decodedUser.slice(colon + 1);
    const hpMatch = /^([^:]+):(\d+)$/.exec(hostPart);
    if (!hpMatch) return null;
    const host = hpMatch[1];
    const port = Number(hpMatch[2]);
    if (!validHostPort(host, port)) return null;
    return { protocol: "shadowsocks", host, port, config: raw, tag, meta: { method, password } };
  }

  // Legacy single-blob
  const decoded = safeDecodeBase64(body);
  if (!decoded) return null;
  const legacy = /^([^:]+):([^@]+)@([^:]+):(\d+)$/.exec(decoded);
  if (!legacy) return null;
  const [, method, password, host, portStr] = legacy;
  const port = Number(portStr);
  if (!validHostPort(host, port)) return null;
  return { protocol: "shadowsocks", host, port, config: raw, tag, meta: { method, password } };
}

function parseTrojan(raw: string): ParsedNode | null {
  const m = /^trojan:\/\/([^@]+)@([^:/?#]+):(\d+)(\?[^#]*)?(#.*)?$/i.exec(raw);
  if (!m) return null;
  const [, password, host, portStr, query, frag] = m;
  const port = Number(portStr);
  if (!validHostPort(host, port)) return null;
  const params = new URLSearchParams(query?.slice(1) ?? "");
  const meta: Record<string, string> = { password };
  for (const [k, v] of params.entries()) meta[k] = v;
  return {
    protocol: "trojan",
    host,
    port,
    config: raw,
    tag: frag ? decodeURIComponent(frag.slice(1)) : undefined,
    meta,
  };
}

/** Single entry point — returns null on any malformed input. */
export function parseOne(raw: string): ParsedNode | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("vless://")) return parseVless(s);
  if (s.startsWith("vmess://")) return parseVmess(s);
  if (s.startsWith("ss://")) return parseShadowsocks(s);
  if (s.startsWith("trojan://")) return parseTrojan(s);
  return null;
}

/**
 * Strict sanitizer — accepts a blob (file contents, base64 subscription,
 * newline list) and returns only well-formed nodes.
 */
export function parseSubscription(blob: string): ParsedNode[] {
  if (!blob) return [];
  // Many subscription endpoints return base64 — try once.
  const trimmed = blob.trim();
  let lines: string[];
  if (!/\s/.test(trimmed) && !trimmed.includes("://")) {
    const decoded = safeDecodeBase64(trimmed);
    lines = (decoded ?? trimmed).split(/\r?\n/);
  } else {
    lines = trimmed.split(/\r?\n/);
  }
  const out: ParsedNode[] = [];
  for (const line of lines) {
    const node = parseOne(line);
    if (node) out.push(node);
  }
  return out;
}

/**
 * Anti-duplicate — collapses by `protocol + host + port`. The first
 * occurrence wins (so live DB rows take precedence over scraper output
 * if the caller orders the input that way).
 */
export function dedupe<T extends { protocol: string; host: string; port: number }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = `${r.protocol}|${r.host.toLowerCase()}|${r.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

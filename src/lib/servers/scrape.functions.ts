/**
 * Server-side scraper. Fetches a list of public subscription URLs
 * (GitHub Raw, Gist, plain HTTP), parses every line through the strict
 * sanitizer, dedupes by host:port, and returns the merged catalog.
 *
 * Runs as a TanStack server function so CORS does not apply and the
 * full set of public sources can be aggregated server-side without
 * shipping URLs through the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { parseSubscription, dedupe, type ParsedNode } from "./parsers";

// Public, CORS-irrelevant (server-side fetch) subscription endpoints.
// Curated from well-known public mirrors. Add/remove via this array.
const DEFAULT_SOURCES = [
  "https://raw.githubusercontent.com/freefq/free/master/v2",
  "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
  "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",
  "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
];

const FETCH_TIMEOUT_MS = 8000;
const MAX_PER_SOURCE = 200;

async function fetchSource(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export const scrapePublicSources = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ nodes: ParsedNode[]; sources: number; raw: number }> => {
    const blobs = await Promise.all(DEFAULT_SOURCES.map(fetchSource));
    const all: ParsedNode[] = [];
    for (const blob of blobs) {
      const parsed = parseSubscription(blob).slice(0, MAX_PER_SOURCE);
      all.push(...parsed);
    }
    const merged = dedupe(all);
    return { nodes: merged, sources: DEFAULT_SOURCES.length, raw: all.length };
  },
);

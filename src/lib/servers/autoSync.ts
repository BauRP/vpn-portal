/**
 * Silent background synchronization of public node sources.
 *
 * - Triggers on app launch and on visibility/appStateChange.
 * - Skips if `last_sync_timestamp` < 6h ago.
 * - On failure (offline / fetch error) retries silently after 15min,
 *   not on every UI tap.
 * - Persists timestamp + node count to localStorage so the catalog
 *   survives offline launches.
 */

import { scrapePublicSources } from "./scrape.functions";

const LS_TIMESTAMP = "trivo.last_sync_timestamp";
const LS_NODES = "trivo.cached_nodes";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

let inFlight = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let qcInvalidate: (() => void) | null = null;

function readTs(): number {
  try {
    const v = localStorage.getItem(LS_TIMESTAMP);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function writeTs(ts: number) {
  try {
    localStorage.setItem(LS_TIMESTAMP, String(ts));
  } catch {
    /* ignore quota / private mode */
  }
}

function persistNodes(nodes: unknown) {
  try {
    localStorage.setItem(LS_NODES, JSON.stringify(nodes));
  } catch {
    /* ignore */
  }
}

export function getCachedNodes(): unknown[] {
  try {
    const raw = localStorage.getItem(LS_NODES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void runSync(true);
  }, RETRY_MS);
}

async function runSync(force = false): Promise<void> {
  if (inFlight) return;
  if (typeof window === "undefined") return;

  // APK/file:// origin can't reach external HTTPS via the SSR endpoint.
  // Skip silently — the live `servers` table still feeds useServers().
  const isApk =
    window.location.protocol === "file:" ||
    /capacitor/i.test(navigator.userAgent || "");
  if (isApk) return;

  const now = Date.now();
  const last = readTs();
  if (!force && last && now - last < SIX_HOURS_MS) return;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    scheduleRetry();
    return;
  }

  inFlight = true;
  try {
    const r = await scrapePublicSources();
    persistNodes(r.nodes);
    writeTs(Date.now());
    qcInvalidate?.();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  } catch {
    // Silent: schedule one retry in 15 min, do not surface errors.
    scheduleRetry();
  } finally {
    inFlight = false;
  }
}

/**
 * Wire up auto-sync. Call once at app root. Idempotent.
 */
export function startAutoSync(opts?: { onSynced?: () => void }) {
  if (started) return;
  started = true;
  qcInvalidate = opts?.onSynced ?? null;

  // Launch trigger.
  void runSync(false);

  // App resume / tab-visible trigger.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void runSync(false);
    });
  }

  // Recover from offline → online.
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void runSync(true));
  }
}

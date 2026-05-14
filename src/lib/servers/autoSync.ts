/**
 * Silent background synchronization of public node sources.
 *
 * - Triggers on app launch and on visibility/online events.
 * - Skips if `last_sync_timestamp` < 6h ago.
 * - On failure (offline / fetch error) retries silently after 15min.
 * - Persists timestamp + nodes to localStorage so the catalog
 *   survives offline launches.
 * - Exposes a subscribable status ("idle" | "syncing" | "error")
 *   so the UI can render a discrete "Syncing servers…" indicator
 *   and gate the Connect button while the first launch is preparing
 *   the node list.
 */

import { useSyncExternalStore } from "react";
import { scrapePublicSources } from "./scrape.functions";

const LS_TIMESTAMP = "trivo.last_sync_timestamp";
const LS_NODES = "trivo.cached_nodes";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

export type AutoSyncStatus = "idle" | "syncing" | "error";

let status: AutoSyncStatus = "idle";
let inFlight = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let qcInvalidate: (() => void) | null = null;
let firstLaunchPending = true;

const statusSubs = new Set<(s: AutoSyncStatus) => void>();

function setStatus(next: AutoSyncStatus) {
  if (next === status) return;
  status = next;
  statusSubs.forEach((cb) => cb(next));
}

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

export function getAutoSyncStatus(): AutoSyncStatus {
  return status;
}

/**
 * True only on the first launch when the local cache is empty AND
 * a sync is currently in flight. Used to BLOCK the Connect button —
 * we cannot route packets without at least one known node.
 */
export function isFirstLaunchSyncing(): boolean {
  return firstLaunchPending && status === "syncing" && getCachedNodes().length === 0;
}

export function subscribeAutoSyncStatus(cb: (s: AutoSyncStatus) => void) {
  statusSubs.add(cb);
  return () => {
    statusSubs.delete(cb);
  };
}

/** React hook — re-renders on every status change. */
export function useAutoSyncStatus(): AutoSyncStatus {
  return useSyncExternalStore(subscribeAutoSyncStatus, getAutoSyncStatus, getAutoSyncStatus);
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
  if (isApk) {
    firstLaunchPending = false;
    return;
  }

  const now = Date.now();
  const last = readTs();
  if (!force && last && now - last < SIX_HOURS_MS) {
    firstLaunchPending = false;
    return;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    setStatus("error");
    scheduleRetry();
    return;
  }

  inFlight = true;
  setStatus("syncing");
  try {
    const r = await scrapePublicSources();
    persistNodes(r.nodes);
    writeTs(Date.now());
    qcInvalidate?.();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    setStatus("idle");
  } catch {
    setStatus("error");
    scheduleRetry();
  } finally {
    inFlight = false;
    firstLaunchPending = false;
  }
}

/** Force a sync now (used by online recovery). */
export function triggerSync(): void {
  void runSync(true);
}

/**
 * Wire up auto-sync. Call once at app root. Idempotent.
 */
export function startAutoSync(opts?: { onSynced?: () => void }) {
  if (started) return;
  started = true;
  qcInvalidate = opts?.onSynced ?? null;

  void runSync(false);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void runSync(false);
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void runSync(true));
  }
}

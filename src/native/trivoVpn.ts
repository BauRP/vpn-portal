/**
 * Trivo VPN — JS bridge to the native Capacitor plugin.
 *
 * In an Android/Capacitor build the `TrivoVpn` plugin is registered by
 * Capacitor and routed to the Kotlin implementation in
 * `android-plugins/trivo-vpn/`.
 *
 * In the Lovable web preview Capacitor is unavailable. We expose
 * `isNativeTrivo` + safe no-op fallbacks so the rest of the codebase
 * (vpnEngine, ServerSheet) can call it unconditionally.
 *
 * NOTE: We intentionally do NOT import `@capacitor/core` here. The web
 * runtime has no Capacitor and this template ships without it. A native
 * shell can re-add Capacitor and replace this file with a real
 * `registerPlugin` call.
 */

export type NativeNetworkTrust = "trusted" | "untrusted" | "offline";
export type NativeHealth = "connected" | "degraded" | "down";

export interface TcpPingOptions { host: string; port: number; timeoutMs?: number }
export interface TcpPingResult { rttMs: number | null }

export interface StartOptions {
  protocol: "vless-reality" | "shadowsocks" | "wireguard";
  server?: { host: string; port: number; config: string } | null;
  killSwitch?: boolean;
  dns?: string[];
  disallowedApps?: string[];
}

export interface AccelerationOptions {
  smartAccel: boolean;
  compression: boolean;
  mtu?: number;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface TrivoVpnPlugin {
  tcpPing(opts: TcpPingOptions): Promise<TcpPingResult>;
  icmpPing(opts: TcpPingOptions): Promise<TcpPingResult>;
  start(opts: StartOptions): Promise<{ started: boolean }>;
  stop(): Promise<{ stopped: boolean }>;
  setProtocol(opts: { protocol: StartOptions["protocol"] }): Promise<void>;
  setKillSwitch(opts: { enabled: boolean }): Promise<void>;
  setStealthMode(opts: { mode: "standard" | "elite" }): Promise<void>;
  setAcceleration(opts: AccelerationOptions): Promise<void>;
  scheduleScraper(opts: { intervalMinutes: number }): Promise<{ scheduled: boolean }>;
  cancelScraper(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ requested: boolean }>;
  addListener(
    event: "healthChange",
    cb: (e: { state: NativeHealth }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "networkChange",
    cb: (e: { trust: NativeNetworkTrust }) => void,
  ): Promise<PluginListenerHandle>;
}

const noopHandle: PluginListenerHandle = { remove: async () => {} };

const webFallback: TrivoVpnPlugin = {
  async tcpPing() { return { rttMs: null }; },
  async icmpPing() { return { rttMs: null }; },
  async start() { return { started: false }; },
  async stop() { return { stopped: false }; },
  async setProtocol() {},
  async setKillSwitch() {},
  async setStealthMode() {},
  async setAcceleration() {},
  async scheduleScraper() { return { scheduled: false }; },
  async cancelScraper() {},
  async isIgnoringBatteryOptimizations() { return { ignoring: true }; },
  async requestIgnoreBatteryOptimizations() { return { requested: false }; },
  async addListener() { return noopHandle; },
};

/**
 * Resolve the real Capacitor-registered plugin if it has been injected on
 * `window`, otherwise fall back to the web no-op implementation.
 */
function resolvePlugin(): TrivoVpnPlugin {
  if (typeof window === "undefined") return webFallback;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  const plugin = cap?.Plugins?.TrivoVpn as TrivoVpnPlugin | undefined;
  return plugin ?? webFallback;
}

export const TrivoVpn: TrivoVpnPlugin = new Proxy({} as TrivoVpnPlugin, {
  get(_target, prop) {
    const impl = resolvePlugin() as unknown as Record<string | symbol, unknown>;
    return impl[prop];
  },
});

/** True only when running inside the Capacitor native shell on Android. */
export const isNativeTrivo: boolean = (() => {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === "android";
})();

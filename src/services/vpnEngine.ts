/**
 * src/services/vpnEngine.ts
 *
 * High-level service the UI calls to start / stop the tunnel. Forwards
 * directly to the Capacitor-registered `TrivoVpn` plugin (Java side:
 * com.trivo.vpn.TrivoVpnPlugin). On the web preview the JS bridge falls
 * back to a no-op implementation, so this module is safe to import
 * unconditionally.
 *
 * Re-exports the existing engine adapter (health probe, lifecycle
 * subscriptions) from the master VPN module so callers have a single
 * import surface.
 */

import { TrivoVpn, isNativeTrivo, type StartTunnelOptions } from "@/native/trivoVpn";

export { vpnEngine, useEngineHealth } from "@/components/mastervpn/vpnEngine";
export type {
  EngineHealth,
  NetworkTrust,
  VpnProtocol,
  StealthMode,
} from "@/components/mastervpn/vpnEngine";

export interface NodeConfig {
  protocol: "vless-reality" | "shadowsocks" | "wireguard";
  host: string;
  port: number;
  /** Raw outbound config (sing-box JSON / VLESS URL / SS URI). */
  raw?: string;
  [k: string]: unknown;
}

export async function startTunnel(nodeConfig: NodeConfig): Promise<boolean> {
  const opts: StartTunnelOptions = { config: nodeConfig };
  try {
    const r = await TrivoVpn.startTunnel(opts);
    return !!r?.started;
  } catch (err) {
    console.error("[vpnEngine] startTunnel failed", err);
    return false;
  }
}

export async function stopTunnel(): Promise<boolean> {
  try {
    const r = await TrivoVpn.stop();
    return !!r?.stopped;
  } catch (err) {
    console.error("[vpnEngine] stopTunnel failed", err);
    return false;
  }
}

export const isNativeVpn = isNativeTrivo;

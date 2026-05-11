import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trivo.vpn.elite",
  appName: "VPN Elite",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;

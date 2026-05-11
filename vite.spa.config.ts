/**
 * Standalone SPA build for the Capacitor APK.
 *
 *   npm run build:spa            → emits a static dist/ that Capacitor copies
 *                                   into android/app/src/main/assets/public
 *
 * This config is INTENTIONALLY decoupled from @lovable.dev/vite-tanstack-config
 * so it never drags SSR, Cloudflare Worker, or shellComponent logic into the
 * APK bundle. The default vite.config.ts continues to power SSR for the web
 * preview & published site untouched.
 */
import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // Relative base is mandatory — Android WebView loads file://.../index.html
  // and absolute /assets/* paths would resolve against the device root.
  base: "./",
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
  define: {
    // Strip SSR-only branches; TanStack Start checks this at runtime.
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
});

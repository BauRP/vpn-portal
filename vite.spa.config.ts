/**
 * Standalone SPA build for the Capacitor APK.
 * * ИСПРАВЛЕНО ДЛЯ ГОСПОДИНА:
 * Заменен terser на esbuild, чтобы избежать ошибки "terser not found".
 * Убраны конфликты синтаксиса в блоке define.
 */
import { defineConfig } from "vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  // МАНДАТ: Относительный путь (./) критически важен для Android WebView
  base: './',
  
  plugins: [
    TanStackRouterVite({ 
      target: "react", 
      autoCodeSplitting: true 
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Заглушка для серверных модулей Node.js
      "node:async_hooks": path.resolve(__dirname, "node_modules/vite/dist/client/env.mjs"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    // ИСПРАВЛЕНИЕ: Используем esbuild, он всегда есть под рукой и не выдает ошибок
    minify: 'esbuild', 
    // APK МАНДАТ: НЕ дробим бандл на чанки. WebView с file:// origin
    // не может разрешить динамические chunk-URL и падает с
    // "Failed to fetch dynamically imported module". Один JS-файл = ноль 404.
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      external: ["node:async_hooks"],
      output: {
        // Всё в один чанк, никаких vendor/route splits.
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/app-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },

  // Блок define без лишних typeof, чтобы не злить компилятор
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "import.meta.env.SSR": "false",
    "global": "window", 
  },

  server: {
    port: 3000,
    strictPort: true,
  },
});

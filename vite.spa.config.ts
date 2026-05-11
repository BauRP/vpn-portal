/**
 * Standalone SPA build for the Capacitor APK.
 * * ИСПРАВЛЕНО ДЛЯ ГОСПОДИНА:
 * Убраны конфликты синтаксиса, мешавшие сборке APK.
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
    minify: 'terser',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      // Игнорируем серверные зависимости при сборке
      external: ["node:async_hooks"],
    },
  },

  // ИСПРАВЛЕННЫЙ БЛОК: Теперь без ошибок в синтаксисе
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

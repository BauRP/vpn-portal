/**
 * Standalone SPA build for the Capacitor APK.
 * * ПОДГОТОВЛЕНО ДЛЯ ГОСПОДИНА:
 * Этот конфиг гарантирует работу APK без белого экрана.
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
    // Настраиваем роутер под SPA
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
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    // es2022 оптимален для современных Android устройств
    target: "es2022",
    minify: 'terser', // Дополнительное сжатие для экономии места
    rollupOptions: {
      // Явное указание точки входа для SPA
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },

  // Жестко прописываем переменные окружения для отключения SSR логики
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "import.meta.env.SSR": false, 
  },

  // Настройка сервера для предпросмотра (если запустите локально)
  server: {
    port: 3000,
    strictPort: true,
  },
});

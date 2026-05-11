/**
 * SPA bootstrap used by vite.spa.config.ts (Capacitor APK build).
 * Mounts the same TanStack Router tree without SSR / shellComponent —
 * Android WebView loads index.html from disk and React owns everything.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";

const router = getRouter();

const el = document.getElementById("root");
if (!el) throw new Error("#root missing in index.html");

createRoot(el).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

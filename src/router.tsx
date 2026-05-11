import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory, createBrowserHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Dual-mode history:
 * - Capacitor APK (file:// protocol) → HashHistory, prevents white-screen on
 *   Android WebView when Android cannot resolve nested deep links from disk.
 * - Web preview / SSR / published site → BrowserHistory (default), preserves
 *   clean URLs and SSR hydration.
 */
function pickHistory() {
  if (typeof window === "undefined") return undefined; // SSR: let TanStack default
  if (window.location.protocol === "file:") return createHashHistory();
  return createBrowserHistory();
}

export const getRouter = () => {
  const queryClient = new QueryClient();
  const history = pickHistory();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(history ? { history } : {}),
  });

  return router;
};

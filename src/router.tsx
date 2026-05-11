import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory, createBrowserHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * УМНАЯ НАВИГАЦИЯ ДЛЯ ГОСПОДИНА
 * Авто-выбор между сайтом и APK (Android)
 */
function pickHistory() {
  if (typeof window === "undefined") return undefined; 
  // Если мы открыли файл прямо с диска (как в APK), используем HashHistory
  if (window.location.protocol === "file:" || window.location.hostname === 'localhost') {
    return createHashHistory();
  }
  return createBrowserHistory();
}

// Создаем QueryClient один раз вне функции, чтобы не терять данные
const queryClient = new QueryClient();

export const getRouter = () => {
  const history = pickHistory();

  const router = createRouter({
    routeTree,
    context: { 
      queryClient,
      // Здесь можно добавить начальное состояние для премиума, если нужно
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Применяем нашу историю
    history: history,
  });

  return router;
};

// Экспортируем экземпляр роутера для использования в приложении
export const router = getRouter();

// Регистрация типов для TypeScript (чтобы не было ошибок в коде)
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

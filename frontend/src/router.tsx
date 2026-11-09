import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";

import { AppLayout } from "@/components/AppLayout";
import { Spinner } from "@/components/Spinner";
import { DevErrorPage } from "@/pages/DevErrorPage";
import { ErrorPage } from "@/pages/ErrorPage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Pages for development only. Vite replaces import.meta.env.DEV with false in a production build,
// so this list is empty there. The dynamic import goes with it, which means the design page's code
// isn't built at all, instead of being built and hidden.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: "dev/error", element: <DevErrorPage /> },
      {
        path: "design",
        // Shown inside the shell for the moment the page's code takes to load.
        hydrateFallbackElement: <Spinner label="Loading the house style" />,
        lazy: async () => {
          const { DesignPage } = await import("@/pages/DesignPage");
          return { Component: DesignPage };
        },
      },
    ]
  : [];

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    // Only reached if the shell itself crashes, so this page has no header or footer.
    errorElement: (
      <main>
        <ErrorPage />
      </main>
    ),
    children: [
      {
        // A crash in a page stops here, inside the shell, so people can still move on.
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          ...devRoutes,
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);

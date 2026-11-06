import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";

import { AppLayout } from "@/components/AppLayout";
import { DevErrorPage } from "@/pages/DevErrorPage";
import { ErrorPage } from "@/pages/ErrorPage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

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
          // import.meta.env.DEV is false in a production build, so this route doesn't exist there.
          ...(import.meta.env.DEV ? [{ path: "dev/error", element: <DevErrorPage /> }] : []),
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);

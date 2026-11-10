import { createBrowserRouter } from "react-router";
import type { RouteObject } from "react-router";

import { AppLayout } from "@/components/AppLayout";
import { Spinner } from "@/components/Spinner";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SignedOutOnly } from "@/features/auth/components/SignedOutOnly";
import { DashboardBookingsPage } from "@/pages/DashboardBookingsPage";
import { DashboardHoursPage } from "@/pages/DashboardHoursPage";
import { DashboardInformationPage } from "@/pages/DashboardInformationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardPhotosPage } from "@/pages/DashboardPhotosPage";
import { DashboardRestaurantPage } from "@/pages/DashboardRestaurantPage";
import { DevErrorPage } from "@/pages/DevErrorPage";
import { ErrorPage } from "@/pages/ErrorPage";
import { HomePage } from "@/pages/HomePage";
import { NewRestaurantPage } from "@/pages/NewRestaurantPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ReservationsPage } from "@/pages/ReservationsPage";
import { RestaurantPage } from "@/pages/RestaurantPage";
import { RestaurantsPage } from "@/pages/RestaurantsPage";
import { SignInPage } from "@/pages/SignInPage";
import { SignUpPage } from "@/pages/SignUpPage";

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
          // Public: anyone can browse, signed in or not.
          { path: "restaurants", element: <RestaurantsPage /> },
          { path: "restaurants/:slug", element: <RestaurantPage /> },
          // A guard is a layout route without a path: it decides, then shows the page inside it
          // through <Outlet />. The API checks every request too, which is the real protection.
          {
            // For people who aren't signed in. Anyone signed in goes on to where they were heading.
            element: <SignedOutOnly />,
            children: [
              { path: "login", element: <SignInPage /> },
              { path: "register", element: <SignUpPage /> },
            ],
          },
          {
            // For anyone signed in.
            element: <RequireAuth />,
            children: [{ path: "reservations", element: <ReservationsPage /> }],
          },
          {
            // For restaurant owners only.
            element: (
              <RequireAuth roles={["OWNER"]} notAllowedTitle="This page is for restaurants" />
            ),
            children: [
              { path: "dashboard", element: <DashboardPage /> },
              { path: "dashboard/new", element: <NewRestaurantPage /> },
              {
                // One restaurant: its header and parts, with the open part inside. Bookings
                // live at the restaurant's own address, so they're what opens first.
                path: "dashboard/:restaurantId",
                element: <DashboardRestaurantPage />,
                children: [
                  { index: true, element: <DashboardBookingsPage /> },
                  { path: "information", element: <DashboardInformationPage /> },
                  { path: "hours", element: <DashboardHoursPage /> },
                  { path: "photos", element: <DashboardPhotosPage /> },
                ],
              },
            ],
          },
          ...devRoutes,
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);

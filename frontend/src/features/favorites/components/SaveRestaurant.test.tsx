// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test, vi } from "vitest";

import { returnStateFor } from "@/features/auth/returnTo";
import { SaveRestaurant } from "@/features/favorites/components/SaveRestaurant";
import type { SaveViewer } from "@/features/favorites/components/SaveRestaurant";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

function renderSave(viewer: SaveViewer) {
  const router = createMemoryRouter(
    [
      {
        path: "/restaurants/lori-smokehouse",
        element: <SaveRestaurant name="Lori Smokehouse" viewer={viewer} />,
      },
      { path: "/login", element: <p>Sign in page</p> },
    ],
    { initialEntries: ["/restaurants/lori-smokehouse"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const guest = (change: Partial<Extract<SaveViewer, { kind: "guest" }>> = {}): SaveViewer => ({
  kind: "guest",
  saved: false,
  saving: false,
  error: null,
  onToggle: vi.fn(),
  ...change,
});

test("signed out, it offers Sign in to save, which comes back to this page afterwards", async () => {
  const back = returnStateFor({ pathname: "/restaurants/lori-smokehouse", search: "", hash: "" });
  const router = renderSave({ kind: "signedOut", signIn: back });

  await userEvent.click(screen.getByRole("link", { name: "Sign in to save" }));

  expect(router.state.location.pathname).toBe("/login");
  expect(router.state.location.state).toEqual(back);
});

test("a guest toggles it", async () => {
  const viewer = guest({ saved: true });
  renderSave(viewer);

  await userEvent.click(screen.getByRole("button", { name: "Saved Lori Smokehouse" }));

  expect(viewer.kind === "guest" && viewer.onToggle).toHaveBeenCalled();
});

test("until the app knows whether it's saved, and while a change is sent, the ring turns", () => {
  renderSave(guest({ saved: undefined }));
  expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  cleanup();

  renderSave(guest({ saving: true }));
  expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
});

test("a change that fails says why, under the toggle", () => {
  renderSave(
    guest({
      error: new ApiError(
        0,
        "NETWORK_ERROR",
        "We can't reach the server right now. Please try again.",
      ),
    }),
  );

  expect(screen.getByRole("alert").textContent).toBe(
    "We can't reach the server right now. Please try again.",
  );
});

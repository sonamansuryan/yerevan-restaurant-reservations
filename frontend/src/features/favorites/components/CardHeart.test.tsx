// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test, vi } from "vitest";

import { returnStateFor } from "@/features/auth/returnTo";
import { CardHeart } from "@/features/favorites/components/CardHeart";
import type { SaveViewer } from "@/features/favorites/components/SaveRestaurant";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

function renderHeart(viewer: SaveViewer) {
  const router = createMemoryRouter(
    [
      { path: "/restaurants", element: <CardHeart name="Lori Smokehouse" viewer={viewer} /> },
      { path: "/login", element: <p>Sign in page</p> },
    ],
    { initialEntries: ["/restaurants"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

type GuestViewer = Extract<SaveViewer, { kind: "guest" }>;

const guest = (change: Partial<GuestViewer> = {}): GuestViewer => ({
  kind: "guest",
  saved: false,
  saving: false,
  error: null,
  onToggle: vi.fn(),
  ...change,
});

test("signed out, the heart asks to sign in first, and comes back to this page afterwards", async () => {
  const back = returnStateFor({ pathname: "/restaurants", search: "?guests=4", hash: "" });
  const router = renderHeart({ kind: "signedOut", signIn: back });

  const link = screen.getByRole("link", { name: "Sign in to save Lori Smokehouse" });
  expect(link.getAttribute("href")).toBe("/login");
  await userEvent.click(link);

  expect(router.state.location.pathname).toBe("/login");
  expect(router.state.location.state).toEqual(back);
});

test("a guest's heart saves the restaurant", async () => {
  const viewer = guest();
  renderHeart(viewer);

  const heart = screen.getByRole("button", { name: "Save Lori Smokehouse" });
  expect(heart.getAttribute("aria-pressed")).toBe("false");
  expect(heart.hasAttribute("aria-busy")).toBe(false);
  await userEvent.click(heart);

  expect(viewer.onToggle).toHaveBeenCalledTimes(1);
});

test("once saved, it says so, and pressed", async () => {
  const viewer = guest({ saved: true });
  renderHeart(viewer);

  const heart = screen.getByRole("button", { name: "Saved Lori Smokehouse" });
  expect(heart.getAttribute("aria-pressed")).toBe("true");
  await userEvent.click(heart);

  expect(viewer.onToggle).toHaveBeenCalledTimes(1);
});

test("while a change is sent, the ring turns and a click does nothing", async () => {
  const viewer = guest({ saved: true, saving: true });
  renderHeart(viewer);

  const heart = screen.getByRole("button", { name: "Saved Lori Smokehouse" });
  expect(heart.getAttribute("aria-busy")).toBe("true");
  expect(heart.getAttribute("aria-disabled")).toBe("true");
  await userEvent.click(heart);

  expect(viewer.onToggle).not.toHaveBeenCalled();
});

test("until the app knows whether it's saved, the ring turns and a click does nothing", async () => {
  const viewer = guest({ saved: undefined });
  renderHeart(viewer);

  // It doesn't claim to be saved before it knows.
  const heart = screen.getByRole("button", { name: "Save Lori Smokehouse" });
  expect(heart.getAttribute("aria-pressed")).toBe("false");
  expect(heart.getAttribute("aria-busy")).toBe("true");
  await userEvent.click(heart);

  expect(viewer.onToggle).not.toHaveBeenCalled();
});

test("a change that fails tells screen readers why", () => {
  renderHeart(
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

test("with nothing wrong, there's no alert", () => {
  renderHeart(guest());

  expect(screen.queryByRole("alert")).toBeNull();
});

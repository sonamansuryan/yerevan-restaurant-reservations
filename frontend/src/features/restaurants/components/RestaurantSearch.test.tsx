// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test } from "vitest";

import { RestaurantSearch } from "@/features/restaurants/components/RestaurantSearch";

afterEach(cleanup);

type TestRouter = ReturnType<typeof createMemoryRouter>;

/** The search on the home page, with Browse as somewhere to land. */
function renderSearch(): TestRouter {
  const router = createMemoryRouter(
    [
      { path: "/", element: <RestaurantSearch /> },
      { path: "/restaurants", element: <p>Browse</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const searchBox = (): HTMLElement => screen.getByLabelText("Search restaurants");

test("a search takes the words to Browse, trimmed", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "  khachapuri  {Enter}");

  expect(await screen.findByText("Browse")).toBeDefined();
  expect(router.state.location.pathname).toBe("/restaurants");
  expect(router.state.location.search).toBe("?q=khachapuri");
});

test("words that need escaping arrive whole", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "sevan & salt");
  await userEvent.click(screen.getByRole("button", { name: "Search" }));

  await screen.findByText("Browse");
  expect(new URLSearchParams(router.state.location.search).get("q")).toBe("sevan & salt");
});

test("an empty search simply opens Browse", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "   {Enter}");

  await screen.findByText("Browse");
  expect(router.state.location.search).toBe("");
});

test("the form is a search landmark, with a labelled box", () => {
  renderSearch();

  expect(screen.getByRole("search", { name: "Restaurants" })).toBeDefined();
  expect(searchBox().getAttribute("maxlength")).toBe("100");
});

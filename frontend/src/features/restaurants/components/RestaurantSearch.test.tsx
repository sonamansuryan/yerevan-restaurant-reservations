// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, expect, test } from "vitest";

import { RestaurantSearch } from "@/features/restaurants/components/RestaurantSearch";

afterEach(cleanup);

type TestRouter = ReturnType<typeof createMemoryRouter>;

// The search starts at an evening table for two, today.
const TODAY = "2026-11-13";
const TONIGHT = { date: TODAY, time: "19:30", guests: 2 };
// How Browse's address writes that table, after any words.
const AT_TONIGHT = "date=2026-11-13&time=19%3A30&guests=2";

/** The search on the home page, with Browse as somewhere to land. */
function renderSearch(): TestRouter {
  const router = createMemoryRouter(
    [
      { path: "/", element: <RestaurantSearch query={TONIGHT} today={TODAY} /> },
      { path: "/restaurants", element: <p>Browse</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const searchBox = (): HTMLElement => screen.getByLabelText("Restaurant, dish or street");

test("a search takes the words to Browse, trimmed, with the table looked for", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "  khachapuri  {Enter}");

  expect(await screen.findByText("Browse")).toBeDefined();
  expect(router.state.location.pathname).toBe("/restaurants");
  expect(router.state.location.search).toBe(`?q=khachapuri&${AT_TONIGHT}`);
});

test("the day, time and party chosen go to Browse too", async () => {
  const router = renderSearch();

  await userEvent.selectOptions(screen.getByLabelText("Date"), "Tomorrow, 14 Nov");
  await userEvent.selectOptions(screen.getByLabelText("Time"), "21:00");
  await userEvent.selectOptions(screen.getByLabelText("Guests"), "4 guests");
  await userEvent.click(screen.getByRole("button", { name: "Find a table" }));

  await screen.findByText("Browse");
  expect(router.state.location.search).toBe("?date=2026-11-14&time=21%3A00&guests=4");
});

test("words that need escaping arrive whole", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "sevan & salt");
  await userEvent.click(screen.getByRole("button", { name: "Find a table" }));

  await screen.findByText("Browse");
  expect(new URLSearchParams(router.state.location.search).get("q")).toBe("sevan & salt");
});

test("an empty search simply opens Browse, for the table looked for", async () => {
  const router = renderSearch();

  await userEvent.type(searchBox(), "   {Enter}");

  await screen.findByText("Browse");
  expect(router.state.location.search).toBe(`?${AT_TONIGHT}`);
});

test("the form is a search landmark, with a labelled box", () => {
  renderSearch();

  expect(screen.getByRole("search", { name: "Find a table" })).toBeDefined();
  expect(searchBox().getAttribute("maxlength")).toBe("100");
  expect(searchBox().getAttribute("placeholder")).toBe("e.g. khorovats, Abovyan Street");
});

test("the day, time and party start at the table given, each under its own visible name", () => {
  renderSearch();

  const choice = (name: string): HTMLSelectElement =>
    screen.getByRole<HTMLSelectElement>("combobox", { name });
  const options = (name: string): (string | null)[] =>
    within(choice(name))
      .getAllByRole("option")
      .map((option) => option.textContent);

  // As far ahead as booking goes: today and the 60 days after it.
  expect(choice("Date").value).toBe(TODAY);
  expect(options("Date")).toHaveLength(61);
  expect(options("Date").slice(0, 3)).toEqual(["Today, 13 Nov", "Tomorrow, 14 Nov", "Sun 15 Nov"]);
  expect(options("Date").at(-1)).toBe("Tue 12 Jan");
  // Every half hour from 09:00 to 23:30.
  expect(choice("Time").value).toBe("19:30");
  expect(options("Time")).toHaveLength(30);
  expect([options("Time")[0], options("Time")[1], options("Time").at(-1)]).toEqual([
    "09:00",
    "09:30",
    "23:30",
  ]);
  // One to twenty guests.
  expect(choice("Guests").value).toBe("2");
  expect(options("Guests")).toHaveLength(20);
  expect([options("Guests")[0], options("Guests").at(-1)]).toEqual(["1 guest", "20 guests"]);
  // Each name is shown, in the label around its choice.
  for (const name of ["Date", "Time", "Guests"]) {
    expect(choice(name).closest("label")?.firstElementChild?.textContent).toBe(name);
  }
});

test("the button says what it does, and its magnifier is only decoration", () => {
  renderSearch();

  const button = screen.getByRole("button", { name: "Find a table" });
  expect(button.getAttribute("type")).toBe("submit");
  expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});

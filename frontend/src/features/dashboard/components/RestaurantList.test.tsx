// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { PublishPanel } from "@/features/dashboard/components/PublishPanel";
import { RestaurantHeader } from "@/features/dashboard/components/RestaurantHeader";
import { RestaurantList } from "@/features/dashboard/components/RestaurantList";
import { ownedDraft, ownedLori, ownedRestaurants } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

test("each restaurant is a line that opens its own dashboard, and says whether guests see it", () => {
  render(
    <MemoryRouter>
      <RestaurantList restaurants={ownedRestaurants} />
    </MemoryRouter>,
  );

  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(
    ownedRestaurants.map((restaurant) => `/dashboard/${restaurant.id}`),
  );
  expect(links[0]?.textContent).toContain("Lori Smokehouse");
  expect(links[0]?.textContent).toContain("Arabkir · Armenian · Steakhouse");
  expect(links[0]?.textContent).toContain("Published");
  expect(links[2]?.textContent).toContain("Draft");
});

test("a restaurant's header names it, and its parts link to their own addresses", () => {
  render(
    <MemoryRouter initialEntries={[`/dashboard/${ownedLori.id}/hours`]}>
      <RestaurantHeader restaurant={ownedLori} />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lori Smokehouse");
  const parts = screen.getByRole("navigation", { name: "Lori Smokehouse" });
  const base = `/dashboard/${ownedLori.id}`;
  expect(
    [...parts.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Bookings", base],
    ["Analytics", `${base}/analytics`],
    ["Information", `${base}/information`],
    ["Opening hours", `${base}/hours`],
    ["Tables", `${base}/tables`],
    ["Blocked times", `${base}/blocks`],
    ["Photos", `${base}/photos`],
  ]);
  expect(screen.getByRole("link", { name: "Opening hours" }).getAttribute("aria-current")).toBe(
    "page",
  );
  expect(screen.getByRole("link", { name: "See the guests’ page" }).getAttribute("href")).toBe(
    "/restaurants/lori-smokehouse",
  );
});

test("a draft has no guests' page to link to yet", () => {
  render(
    <MemoryRouter>
      <RestaurantHeader restaurant={ownedDraft} />
    </MemoryRouter>,
  );

  expect(screen.getByText("Draft")).toBeDefined();
  expect(screen.queryByRole("link", { name: "See the guests’ page" })).toBeNull();
});

test("a draft is published with one button, and the server says what's missing", async () => {
  const onChange = vi.fn();
  const notReady = new ApiError(
    409,
    "NOT_READY_TO_PUBLISH",
    "Add at least one table before you publish.",
    { missing: ["TABLE"] },
  );

  render(<PublishPanel isPublished={false} onChange={onChange} error={notReady} />);
  await userEvent.click(screen.getByRole("button", { name: "Publish" }));

  expect(onChange).toHaveBeenCalledWith(true);
  expect(screen.getByRole("alert").textContent).toBe("Add at least one table before you publish.");
});

test("a published restaurant can be hidden again", async () => {
  const onChange = vi.fn();

  render(<PublishPanel isPublished onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Unpublish" }));

  expect(onChange).toHaveBeenCalledWith(false);
  expect(screen.getByText("Guests can find it and book a table.")).toBeDefined();
});

test("a restaurant Seghan hid says so, in the list and its header, with no guests' page to link to", () => {
  const hidden = { ...ownedLori, hiddenBySeghan: true };
  render(
    <MemoryRouter>
      <RestaurantList restaurants={[hidden]} />
      <RestaurantHeader restaurant={hidden} />
    </MemoryRouter>,
  );

  expect(screen.getAllByText("Hidden by Seghan")).toHaveLength(2);
  expect(screen.queryByText("Published")).toBeNull();
  expect(screen.queryByRole("link", { name: "See the guests’ page" })).toBeNull();
});

test("while Seghan hides it, the panel says so, and the owner's own choice still works", async () => {
  const onChange = vi.fn();

  render(<PublishPanel isPublished hiddenBySeghan onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "Unpublish" }));

  expect(screen.getByText("Hidden by Seghan")).toBeDefined();
  expect(
    screen.getByText(
      "Seghan has hidden it, so guests can’t find or book it. Its bookings stay as they are. Your choice here applies again once Seghan shows it.",
    ),
  ).toBeDefined();
  expect(onChange).toHaveBeenCalledWith(false);
});

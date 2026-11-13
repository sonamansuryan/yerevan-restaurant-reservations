// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { OwnersBand } from "@/features/home/components/OwnersBand";

afterEach(cleanup);

test("invites owners to list a restaurant, through the sign-up for restaurants", () => {
  render(
    <MemoryRouter>
      <OwnersBand />
    </MemoryRouter>,
  );

  const band = screen.getByRole("region", { name: "Run a restaurant in Yerevan?" });
  expect(
    within(band).getByRole("link", { name: "List your restaurant" }).getAttribute("href"),
  ).toBe("/register?role=owner");
  expect(band.textContent).toContain("No double bookings, ever.");
});

test("in /design, its heading steps down", () => {
  render(
    <MemoryRouter>
      <OwnersBand heading="h4" />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { level: 4 }).textContent).toBe(
    "Run a restaurant in Yerevan?",
  );
});

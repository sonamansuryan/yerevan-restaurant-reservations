// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { SignUpScreen } from "@/features/auth/components/SignUpScreen";
import type { SignUpRole } from "@/features/auth/schemas";

afterEach(cleanup);

function renderScreen(defaultRole: SignUpRole = "CUSTOMER"): void {
  render(
    <MemoryRouter>
      <SignUpScreen defaultRole={defaultRole} onSubmit={vi.fn()} />
    </MemoryRouter>,
  );
}

test("a guest's name is written into the book as it's typed", async () => {
  renderScreen();
  expect(screen.getByText("Your name", { selector: "span" })).toBeDefined();

  await userEvent.type(screen.getByLabelText("Your name"), "Lilit");

  expect(screen.getByText("Lilit", { selector: "span" })).toBeDefined();
});

test("the book is decoration, so screen readers skip it", () => {
  renderScreen();

  const book = screen.getByText("in the book").closest("[aria-hidden]");

  expect(book?.getAttribute("aria-hidden")).toBe("true");
});

test("a restaurant sees what its dashboard holds, and its own sentence", async () => {
  renderScreen();

  await userEvent.click(screen.getByRole("radio", { name: /A restaurant/ }));

  expect(screen.getByText("Add your restaurant and publish it when you’re ready.")).toBeDefined();
  expect(screen.getByText("Split shifts and late nights")).toBeDefined();
  expect(screen.queryByText("in the book")).toBeNull();
});

test("the heading stays put whichever role is chosen", async () => {
  renderScreen("OWNER");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Create an account");

  await userEvent.click(screen.getByRole("radio", { name: /A guest/ }));

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Create an account");
  expect(screen.getByText("Book tables and keep your reservations in one place.")).toBeDefined();
});

test("the left page starts with today's date in Yerevan", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-06T21:30:00Z"));
  renderScreen();
  vi.useRealTimers();

  expect(screen.getByText("Saturday 7 November")).toBeDefined();
});

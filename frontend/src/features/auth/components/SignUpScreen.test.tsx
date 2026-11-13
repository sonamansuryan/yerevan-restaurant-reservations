// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

test("a guest's name is written on a booking as it's typed", async () => {
  renderScreen();
  expect(screen.getByText("Your name", { selector: "p" })).toBeDefined();

  await userEvent.type(screen.getByLabelText("Your name"), "Lilit");

  expect(screen.getByText("Lilit", { selector: "p" })).toBeDefined();
});

test("the booking is decoration, so screen readers skip it", () => {
  renderScreen();

  const booking = screen.getByText("Tonight · 20:00").closest("[aria-hidden]");

  expect(booking?.getAttribute("aria-hidden")).toBe("true");
});

test("a restaurant sees what its dashboard holds, and its own sentence", async () => {
  renderScreen();

  await userEvent.click(screen.getByRole("radio", { name: /A restaurant/ }));

  expect(screen.getByText("Add your restaurant and publish it when you’re ready.")).toBeDefined();
  expect(screen.getByText("Opening hours, with split shifts and late nights")).toBeDefined();
  expect(screen.queryByText("Tonight · 20:00")).toBeNull();
});

test("the panel comes first, with the logo home, then the switch, the heading and the form", () => {
  renderScreen();

  const home = screen.getByRole("link", { name: "Seghan, home" });
  const welcome = screen.getByText("Your table is waiting.");
  const pages = screen.getByRole("navigation", { name: "Your account" });
  const heading = screen.getByRole("heading", { level: 1 });
  const name = screen.getByLabelText("Your name");
  expect(home.compareDocumentPosition(welcome)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(welcome.compareDocumentPosition(pages)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(pages.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(heading.compareDocumentPosition(name)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  // The welcome is branding, not a second heading.
  expect(welcome.tagName).toBe("P");
});

test("it offers to sign in instead, and marks Create account as the page that's open", () => {
  renderScreen();

  const pages = screen.getByRole("navigation", { name: "Your account" });
  const signIn = within(pages).getByRole("link", { name: "Sign in" });
  const signUp = within(pages).getByRole("link", { name: "Create account" });
  expect(signIn.getAttribute("href")).toBe("/login");
  expect(signIn.getAttribute("aria-current")).toBeNull();
  expect(signUp.getAttribute("href")).toBe("/register");
  expect(signUp.getAttribute("aria-current")).toBe("page");
});

test("the heading stays put whichever role is chosen", async () => {
  renderScreen("OWNER");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Create an account");

  await userEvent.click(screen.getByRole("radio", { name: /A guest/ }));

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Create an account");
  expect(screen.getByText("Book tables and keep your reservations in one place.")).toBeDefined();
});

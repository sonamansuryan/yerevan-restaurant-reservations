// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

function renderForm(props: Partial<ComponentProps<typeof SignUpForm>> = {}): Mock {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      <SignUpForm defaultRole="CUSTOMER" onSubmit={onSubmit} {...props} />
    </MemoryRouter>,
  );
  return onSubmit;
}

const field = (label: string): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(label);
const radio = (name: RegExp): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("radio", { name });
const createAccount = (): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: "Create account" }));
const guestHint = "Restaurants see this on your booking.";

test.each([
  ["CUSTOMER", /A guest/],
  ["OWNER", /A restaurant/],
] as const)("with %s as the default role, that line starts chosen", (role, line) => {
  renderForm({ defaultRole: role });

  expect(radio(line).checked).toBe(true);
});

test("an empty form isn't sent: each field says what's missing, and focus goes to the name", async () => {
  const onSubmit = renderForm();

  await createAccount();

  expect(await screen.findByText("Enter your name.")).toBeDefined();
  expect(screen.getByText("Enter your email.")).toBeDefined();
  expect(screen.getByText("Use at least 8 characters.")).toBeDefined();
  expect(document.activeElement).toBe(field("Your name"));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a short password's message takes the place of its hint", async () => {
  renderForm();
  expect(screen.getByText("At least 8 characters.")).toBeDefined();

  await userEvent.type(field("Password"), "short");
  await createAccount();

  expect(await screen.findByText("Use at least 8 characters.")).toBeDefined();
  expect(screen.queryByText("At least 8 characters.")).toBeNull();
});

test("switching to a restaurant keeps what's typed, and drops the guest-only hint", async () => {
  renderForm();
  expect(screen.getByText(guestHint)).toBeDefined();
  await userEvent.type(field("Your name"), "Ani Sargsyan");
  await userEvent.type(field("Email"), "ani@example.com");

  await userEvent.click(radio(/A restaurant/));

  expect(field("Your name").value).toBe("Ani Sargsyan");
  expect(field("Email").value).toBe("ani@example.com");
  expect(screen.queryByText(guestHint)).toBeNull();
});

test("a valid form is sent with the chosen role, the name trimmed and the email lowercased", async () => {
  const onSubmit = renderForm();

  await userEvent.click(radio(/A restaurant/));
  await userEvent.type(field("Your name"), " Ani Sargsyan ");
  await userEvent.type(field("Email"), "Ani@Example.com");
  await userEvent.type(field("Password"), "a long password");
  await createAccount();

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(onSubmit.mock.calls[0]?.[0]).toEqual({
    role: "OWNER",
    name: "Ani Sargsyan",
    email: "ani@example.com",
    password: "a long password",
  });
});

test("a taken email shows a notice, with a way to sign in instead", () => {
  renderForm({
    error: new ApiError(409, "EMAIL_TAKEN", "There’s already an account with this email."),
  });

  expect(screen.getByRole("alert").textContent).toBe(
    "There’s already an account with this email. Sign in instead",
  );
  expect(screen.getByRole("link", { name: "Sign in instead" }).getAttribute("href")).toBe("/login");
});

test("it tells the left page the role and the name as they change", async () => {
  const onDraftChange = vi.fn();
  renderForm({ onDraftChange });

  await userEvent.type(field("Your name"), "Lilit");
  await userEvent.click(radio(/A restaurant/));

  expect(onDraftChange).toHaveBeenLastCalledWith({ role: "OWNER", name: "Lilit" });
});

test("the fields are named for password managers", () => {
  renderForm();

  expect(field("Your name").getAttribute("autocomplete")).toBe("name");
  expect(field("Email").getAttribute("autocomplete")).toBe("email");
  expect(field("Password").getAttribute("autocomplete")).toBe("new-password");
});

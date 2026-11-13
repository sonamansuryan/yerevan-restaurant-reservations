// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { SignInForm } from "@/features/auth/components/SignInForm";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

function renderForm(props: Partial<ComponentProps<typeof SignInForm>> = {}): Mock {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      <SignInForm onSubmit={onSubmit} {...props} />
    </MemoryRouter>,
  );
  return onSubmit;
}

const email = (): HTMLElement => screen.getByLabelText("Email");
const password = (): HTMLElement => screen.getByLabelText("Password");
const signIn = (): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: "Sign in" }));

test("an empty form isn't sent: each field says what's missing, and focus goes to the first", async () => {
  const onSubmit = renderForm();

  await signIn();

  expect(await screen.findByText("Enter your email.")).toBeDefined();
  expect(screen.getByText("Enter your password.")).toBeDefined();
  expect(document.activeElement).toBe(email());
  expect(onSubmit).not.toHaveBeenCalled();
});

test("an incomplete email is caught before anything is sent", async () => {
  const onSubmit = renderForm();

  await userEvent.type(email(), "lilit@");
  await userEvent.type(password(), "a long password");
  await signIn();

  expect(await screen.findByText("Enter a full email address.")).toBeDefined();
  expect(email().getAttribute("aria-invalid")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a valid form is sent, with the email trimmed and lowercased, and the password as typed", async () => {
  const onSubmit = renderForm();

  await userEvent.type(email(), "  Lilit@Example.com ");
  await userEvent.type(password(), " a long password ");
  await signIn();

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(onSubmit.mock.calls[0]?.[0]).toEqual({
    email: "lilit@example.com",
    password: " a long password ",
  });
});

test("while sending, the button is busy and a second press sends nothing", async () => {
  const onSubmit = renderForm({
    pending: true,
    defaultValues: { email: "lilit@example.com", password: "a long password" },
  });

  const button = screen.getByRole("button", { name: "Sign in" });
  await userEvent.click(button);

  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test.each([
  [
    "a wrong email or password",
    401,
    "INVALID_CREDENTIALS",
    "Incorrect email or password. Please try again.",
  ],
  [
    "too many tries",
    429,
    "TOO_MANY_REQUESTS",
    "Too many attempts. Please wait a minute and try again.",
  ],
  ["no connection", 0, "NETWORK_ERROR", "We can't reach the server right now. Please try again."],
])("the server's answer to %s shows as a notice", (_, status, code, message) => {
  renderForm({ error: new ApiError(status, code, message) });

  expect(screen.getByRole("alert").textContent).toBe(message);
});

test("a problem the server finds in one field shows under that field, with focus there", async () => {
  renderForm({
    error: new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
      fields: { email: "Enter a full email address." },
    }),
  });

  expect(await screen.findByText("Enter a full email address.")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(document.activeElement).toBe(email());
});

test("the fields are named for password managers and phone keyboards", () => {
  renderForm();

  expect(email().getAttribute("autocomplete")).toBe("email");
  expect(email().getAttribute("inputmode")).toBe("email");
  expect(password().getAttribute("autocomplete")).toBe("current-password");
});

test("Google's way in comes before the form", () => {
  render(
    <MemoryRouter>
      <SignInForm onSubmit={vi.fn()} google={<button type="button">Continue with Google</button>} />
    </MemoryRouter>,
  );

  const google = screen.getByRole("button", { name: "Continue with Google" });
  expect(google.compareDocumentPosition(email())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  // It isn't part of what the form sends.
  expect(google.closest("form")).toBeNull();
});

test("an owner is told they sign in here too, and a new one is offered to list a restaurant", () => {
  renderForm();

  const listYours = screen.getByRole("link", { name: "List your restaurant" });
  expect(listYours.getAttribute("href")).toBe("/register?role=owner");
  expect(listYours.closest("p")?.textContent).toBe(
    "Restaurant owner? You sign in here too. New to Seghan? List your restaurant",
  );
});

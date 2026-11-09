// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, expect, test } from "vitest";

import { PasswordField } from "@/components/PasswordField";

afterEach(cleanup);

test("it's a labelled password field, hidden at first", () => {
  render(<PasswordField label="Password" />);

  expect(screen.getByLabelText("Password").getAttribute("type")).toBe("password");
});

test("Show reveals the password, and Hide hides it again", async () => {
  render(<PasswordField label="Password" defaultValue="a long password" />);
  const field = screen.getByLabelText("Password");

  await userEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(field.getAttribute("type")).toBe("text");

  await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(field.getAttribute("type")).toBe("password");
});

test("Show is a plain button, so pressing it never sends a form", () => {
  render(<PasswordField label="Password" />);

  expect(screen.getByRole("button", { name: "Show password" }).getAttribute("type")).toBe("button");
});

test("an error is tied to the field, which is marked invalid", () => {
  render(<PasswordField label="Password" error="Use at least 8 characters." />);
  const field = screen.getByLabelText("Password");

  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(field.getAttribute("aria-describedby")).toBe(
    screen.getByText("Use at least 8 characters.").id,
  );
});

test("its ref and other props reach the real input, as React Hook Form's register() needs", () => {
  const ref = createRef<HTMLInputElement>();
  render(<PasswordField label="Password" ref={ref} name="password" autoComplete="new-password" />);

  expect(ref.current?.name).toBe("password");
  expect(ref.current?.getAttribute("autocomplete")).toBe("new-password");
});

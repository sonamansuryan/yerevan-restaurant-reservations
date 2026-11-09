// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { FormNotice } from "@/components/FormNotice";

afterEach(cleanup);

test("a problem is an alert, so screen readers say it at once", () => {
  render(<FormNotice tone="error">Incorrect email or password. Please try again.</FormNotice>);

  expect(screen.getByRole("alert").textContent).toBe(
    "Incorrect email or password. Please try again.",
  );
});

test("good news is a polite status", () => {
  render(<FormNotice tone="success">Password updated.</FormNotice>);

  expect(screen.getByRole("status").textContent).toBe("Password updated.");
});

test("the dot is decoration, and the words carry the meaning", () => {
  render(<FormNotice>Incorrect email or password.</FormNotice>);

  const dot = screen.getByRole("alert").querySelector("span");

  expect(dot?.getAttribute("aria-hidden")).toBe("true");
});

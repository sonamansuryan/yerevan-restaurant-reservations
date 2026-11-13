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

test("the icon is decoration, and the words carry the meaning", () => {
  render(<FormNotice>Incorrect email or password.</FormNotice>);

  const notice = screen.getByRole("alert");

  expect(notice.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(notice.textContent).toBe("Incorrect email or password.");
});

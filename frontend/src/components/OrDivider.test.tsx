// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { OrDivider } from "@/components/OrDivider";

afterEach(cleanup);

test("screen readers hear only the word, not the two lines", () => {
  render(<OrDivider />);

  const divider = screen.getByText("or");
  const lines = divider.querySelectorAll("span");

  expect(lines).toHaveLength(2);
  lines.forEach((line) => expect(line.getAttribute("aria-hidden")).toBe("true"));
});

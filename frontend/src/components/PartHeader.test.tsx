// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { PartHeader } from "@/components/PartHeader";

afterEach(cleanup);

test("it heads the part, says what it holds, and offers its main action", () => {
  render(
    <PartHeader
      title="Tables"
      description="7 tables, 37 seats"
      action={<button type="button">Add a table</button>}
    />,
  );

  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Tables");
  expect(screen.getByText("7 tables, 37 seats")).toBeDefined();
  expect(screen.getByRole("button", { name: "Add a table" })).toBeDefined();
});

test("in /design, its heading steps down, and the line and action are optional", () => {
  render(<PartHeader title="Photos" headingLevel={4} />);

  expect(screen.getByRole("heading", { level: 4 }).textContent).toBe("Photos");
  expect(screen.queryByRole("paragraph")).toBeNull();
});

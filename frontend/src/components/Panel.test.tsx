// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { Panel } from "@/components/Panel";

afterEach(cleanup);

test("a titled panel is a section headed by its title, at the level it's given", () => {
  render(
    <Panel title="Visibility" headingLevel={2} aside={<span>Published</span>}>
      <p>Guests can find it.</p>
    </Panel>,
  );

  const heading = screen.getByRole("heading", { level: 2, name: "Visibility" });
  expect(heading.closest("section")?.textContent).toContain("Guests can find it.");
  expect(screen.getByText("Published")).toBeDefined();
});

test("it isn't a landmark, so a page of panels doesn't crowd a screen reader's regions", () => {
  render(<Panel title="Indoor">A list</Panel>);

  expect(screen.queryByRole("region")).toBeNull();
});

test("flush, its content runs edge to edge under a ruled title row", () => {
  render(
    <Panel title="Indoor" flush>
      <ul>
        <li>T1</li>
      </ul>
    </Panel>,
  );

  const list = screen.getByRole("list");
  expect(list.parentElement?.className ?? "").toBe("");
  expect(screen.getByRole("heading", { name: "Indoor" }).parentElement?.className).toContain(
    "border-b",
  );
});

test("it takes extra classes and attributes, so /design can show it", () => {
  render(
    <Panel data-testid="panel" className="max-w-180">
      Text
    </Panel>,
  );

  expect(screen.getByTestId("panel").className).toContain("max-w-180");
  expect(screen.getByTestId("panel").className).toContain("rounded-band");
});

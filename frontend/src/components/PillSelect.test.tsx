// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { PillSelect } from "@/components/PillSelect";

afterEach(cleanup);

const cuisines = [
  { value: "", label: "Any" },
  { value: "ARMENIAN", label: "Armenian" },
  { value: "GEORGIAN", label: "Georgian" },
];

/** The words on the pill, which screen readers skip, as they hear the select itself. */
const shown = (): (string | null)[] =>
  [
    ...(screen.getByLabelText("Cuisine").parentElement?.querySelectorAll(":scope > span") ?? []),
  ].map((span) => span.textContent);

test("the select is named by the label on the pill, and the pill shows the choice", () => {
  render(<PillSelect label="Cuisine" value="GEORGIAN" options={cuisines} onChange={vi.fn()} />);

  const select = screen.getByRole("combobox", { name: "Cuisine" });
  expect((select as HTMLSelectElement).value).toBe("GEORGIAN");
  expect(shown()).toEqual(["Cuisine", "Georgian"]);
  for (const span of select.parentElement?.querySelectorAll(":scope > span") ?? []) {
    expect(span.getAttribute("aria-hidden")).toBe("true");
  }
});

test("choosing gives the new value", async () => {
  const onChange = vi.fn();
  render(<PillSelect label="Cuisine" value="" options={cuisines} onChange={onChange} />);

  await userEvent.selectOptions(screen.getByLabelText("Cuisine"), "Armenian");

  expect(onChange).toHaveBeenCalledWith("ARMENIAN");
});

test("the real select lies over the whole pill, so a tap anywhere opens it", () => {
  render(<PillSelect label="Cuisine" value="" options={cuisines} onChange={vi.fn()} />);

  const select = screen.getByLabelText("Cuisine");
  expect(select.className).toContain("absolute");
  expect(select.className).toContain("inset-0");
  expect(select.className).toContain("opacity-0");
});

test("a choice that narrows the list turns the pill ink, and other attributes reach the select", () => {
  render(
    <PillSelect
      label="Cuisine"
      value="ARMENIAN"
      options={cuisines}
      onChange={vi.fn()}
      active
      data-force="focus"
    />,
  );

  const select = screen.getByLabelText("Cuisine");
  expect(select.parentElement?.className).toContain("bg-ink");
  expect(select.getAttribute("data-force")).toBe("focus");
});

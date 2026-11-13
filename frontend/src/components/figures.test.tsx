// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { BarList } from "@/components/BarList";
import { Figures } from "@/components/Figures";

afterEach(cleanup);

describe("Figures", () => {
  test("each figure is a term with its number and note, in order", () => {
    render(
      <Figures
        figures={[
          { label: "Bookings", value: "42" },
          { label: "Guests", value: "118", note: "who came" },
        ]}
      />,
    );

    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(terms).toEqual(["Bookings", "Guests"]);
    expect(values).toEqual(["42", "118", "who came"]);
  });

  test("a figure that isn't words is read out as words instead", () => {
    render(<Figures figures={[{ label: "Rating", value: "–", spoken: "None" }]} />);

    const value = screen.getByRole("definition");
    expect(within(value).getByText("–").getAttribute("aria-hidden")).toBe("true");
    expect(within(value).getByText("None").className).toContain("sr-only");
  });

  test("extra attributes reach the list, for /design", () => {
    render(<Figures figures={[]} aria-label="The month" data-state="sample" />);

    expect(screen.getByLabelText("The month").getAttribute("data-state")).toBe("sample");
  });
});

describe("BarList", () => {
  const widthOf = (line: HTMLElement): string =>
    (line.querySelector("[aria-hidden] > span") as HTMLElement).style.width;
  const lines = (): HTMLElement[] => screen.getAllByRole("listitem");

  test("against the whole, each bar is its part's share, and each line says its number", () => {
    render(
      <BarList
        bars={[
          { key: "a", label: "Arrived", value: 30, note: "75%" },
          { key: "c", label: "Cancelled", value: 10, note: "25%" },
        ]}
        max={40}
      />,
    );

    expect(lines().map((line) => line.textContent)).toEqual(["Arrived3075%", "Cancelled1025%"]);
    expect(lines().map(widthOf)).toEqual(["75%", "25%"]);
  });

  test("without a whole, the largest is the full bar", () => {
    render(
      <BarList
        bars={[
          { key: "lori", label: "Lori Smokehouse", value: 21 },
          { key: "kond", label: "Kond House", value: 7 },
        ]}
      />,
    );

    expect(lines().map(widthOf)).toEqual(["100%", `${(7 / 21) * 100}%`]);
  });

  test("nothing draws no bar, and a count too small to see still shows a sliver", () => {
    render(
      <BarList
        bars={[
          { key: "none", label: "None", value: 0 },
          { key: "one", label: "One in many", value: 1 },
        ]}
        max={5000}
      />,
    );

    const [none, one] = lines().map(
      (line) => line.querySelector("[aria-hidden] > span") as HTMLElement,
    );
    expect(none?.style.width).toBe("0%");
    expect(none?.className).not.toContain("min-w-0.5");
    expect(one?.className).toContain("min-w-0.5");
  });

  test("all zeros, with nothing to compare, draw no bars rather than failing", () => {
    render(<BarList bars={[{ key: "none", label: "None", value: 0 }]} />);

    expect(widthOf(lines()[0] as HTMLElement)).toBe("0%");
  });

  test("the bars are only pictures, so screen readers hear the names and numbers alone", () => {
    render(<BarList bars={[{ key: "a", label: "Arrived", value: 1284 }]} max={2000} />);

    const bar = lines()[0]?.querySelector("[aria-hidden]");
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    // Grouped by thousands, as figures are.
    expect(lines()[0]?.textContent).toBe("Arrived1,284");
  });
});

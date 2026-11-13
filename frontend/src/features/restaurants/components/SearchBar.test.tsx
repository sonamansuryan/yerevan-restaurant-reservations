// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { SearchBar } from "@/features/restaurants/components/SearchBar";
import { readSearch } from "@/features/restaurants/tableSearch";
import type { TableQuery } from "@/features/restaurants/tableSearch";

afterEach(cleanup);

const TODAY = "2026-11-13";

// The page wraps the bar in its own form, so the test does too.
function renderBar(query: TableQuery, defaultText?: string): HTMLFormElement {
  render(
    <form aria-label="Find a table">
      <SearchBar
        label="Restaurant, dish or street"
        placeholder="Try khorovats or Saryan Street"
        defaultText={defaultText}
        query={query}
        today={TODAY}
        button="Find a table"
      />
    </form>,
  );
  return screen.getByRole<HTMLFormElement>("form", { name: "Find a table" });
}

const words = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>("Restaurant, dish or street");
const choice = (label: "Date" | "Time" | "Guests"): HTMLSelectElement =>
  screen.getByLabelText<HTMLSelectElement>(label);

test("each part is a labelled field, starting at the search already in use", () => {
  renderBar({ date: "2026-11-14", time: "20:00", guests: 4 }, "khorovats");

  expect(words().value).toBe("khorovats");
  expect(choice("Date").value).toBe("2026-11-14");
  expect(choice("Time").value).toBe("20:00");
  expect(choice("Guests").value).toBe("4");
  expect(screen.getByRole("button", { name: "Find a table" }).getAttribute("type")).toBe("submit");
});

test("the fields are named as Browse's address calls them", () => {
  renderBar({ date: TODAY, time: "19:30", guests: 2 });

  expect([words().name, choice("Date").name, choice("Time").name, choice("Guests").name]).toEqual([
    "q",
    "date",
    "time",
    "guests",
  ]);
});

test("the days run from today, by name, for as far as booking can", () => {
  renderBar({ date: TODAY, time: "19:30", guests: 2 });

  const options = Array.from(choice("Date").options);
  expect(options).toHaveLength(61);
  expect(options.slice(0, 3).map((option) => option.textContent)).toEqual([
    "Today, 13 Nov",
    "Tomorrow, 14 Nov",
    "Sun 15 Nov",
  ]);
  expect(options.at(-1)?.value).toBe("2027-01-12");
});

test("the times are the search's half hours, and the party one to twenty guests", () => {
  renderBar({ date: TODAY, time: "19:30", guests: 1 });

  const times = Array.from(choice("Time").options, (option) => option.textContent);
  const parties = Array.from(choice("Guests").options, (option) => option.textContent);
  expect(times).toHaveLength(30);
  expect([times[0], times.at(-1)]).toEqual(["09:00", "23:30"]);
  expect(parties).toHaveLength(20);
  expect([parties[0], parties[1], parties.at(-1)]).toEqual(["1 guest", "2 guests", "20 guests"]);
});

test("the search as sent: the words trimmed, and the table looked for", async () => {
  const form = renderBar({ date: TODAY, time: "19:30", guests: 2 });

  await userEvent.type(words(), "  dolma  ");
  await userEvent.selectOptions(choice("Date"), "2026-11-20");
  await userEvent.selectOptions(choice("Time"), "21:00");
  await userEvent.selectOptions(choice("Guests"), "6");

  expect(readSearch(form)).toEqual({ q: "dolma", date: "2026-11-20", time: "21:00", guests: 6 });
});

test("no words, or only spaces, are no words at all", async () => {
  const form = renderBar({ date: TODAY, time: "19:30", guests: 2 });

  expect(readSearch(form)).toEqual({ q: undefined, date: TODAY, time: "19:30", guests: 2 });

  await userEvent.type(words(), "   ");

  expect(readSearch(form).q).toBeUndefined();
});

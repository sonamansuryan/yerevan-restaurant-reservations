// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { OpeningHoursForm } from "@/features/dashboard/components/OpeningHoursForm";
import type { WeekFields } from "@/features/dashboard/hours";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

const fridayLate: WeekFields = {
  hours: [{ dayOfWeek: 5, opens: String(18 * 60), closes: String(2 * 60) }],
};

function renderForm(props: Partial<ComponentProps<typeof OpeningHoursForm>> = {}): Mock {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      <OpeningHoursForm values={fridayLate} onSubmit={onSubmit} {...props} />
    </MemoryRouter>,
  );
  return onSubmit;
}

const day = (name: string): HTMLElement => screen.getByRole("group", { name });
const save = (): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: "Save opening hours" }));
const selected = (select: HTMLElement): string | undefined =>
  (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? undefined;

test("the week starts on Monday, and a day with no openings is closed", () => {
  renderForm();

  const names = screen.getAllByRole("group").map((group) => group.querySelector("p")?.textContent);
  expect(names).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  expect(within(day("Monday")).getByText("Closed")).toBeDefined();
  expect(within(day("Friday")).queryByText("Closed")).toBeNull();
});

test("a closing at or before the opening is marked as the next day's", () => {
  renderForm();

  const friday = within(day("Friday"));
  expect(selected(friday.getByLabelText("Opens"))).toBe("18:00");
  expect(selected(friday.getByLabelText("Closes"))).toBe("02:00 (next day)");
});

test("the week is sent whole, with each closing counted from its own day", async () => {
  const onSubmit = renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Add opening hours, Monday" }));
  await save();

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(onSubmit.mock.calls[0]?.[0]).toEqual({
    hours: [
      { dayOfWeek: 5, opensAt: 1080, closesAt: 1560 },
      { dayOfWeek: 1, opensAt: 720, closesAt: 1320 },
    ],
  });
});

test("changing the opening time moves the next-day mark with it", async () => {
  renderForm();
  const friday = within(day("Friday"));

  await userEvent.selectOptions(friday.getByLabelText("Opens"), "01:00");

  expect(selected(friday.getByLabelText("Closes"))).toBe("02:00");
});

test("a day holds three openings at most", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Add opening hours, Monday" }));
  await userEvent.click(screen.getByRole("button", { name: "Add another opening, Monday" }));
  await userEvent.click(screen.getByRole("button", { name: "Add another opening, Monday" }));

  expect(within(day("Monday")).getAllByLabelText("Opens")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Add another opening, Monday" })).toBeNull();
});

test("Remove takes an opening away, and its day is closed again", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Remove, Friday 18:00 to 02:00" }));

  expect(within(day("Friday")).getByText("Closed")).toBeDefined();
});

test("an empty week isn't sent, and says why in the server's words", async () => {
  const onSubmit = renderForm({ values: { hours: [] } });

  await save();

  expect(screen.getByRole("alert").textContent).toBe("Add at least one opening time.");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("the server's message appears under the opening it's about, and goes when it changes", async () => {
  const twoOnMonday: WeekFields = {
    hours: [
      { dayOfWeek: 1, opens: String(12 * 60), closes: String(15 * 60) },
      { dayOfWeek: 1, opens: String(14 * 60), closes: String(16 * 60) },
    ],
  };
  const overlap = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
    fields: { "hours.1": "Overlaps Monday 12:00–15:00." },
  });

  renderForm({ values: twoOnMonday, error: overlap });

  const [first, second] = within(day("Monday")).getAllByLabelText("Opens");
  expect(second?.getAttribute("aria-invalid")).toBe("true");
  expect(first?.getAttribute("aria-invalid")).toBeNull();
  expect(screen.getByText("Overlaps Monday 12:00–15:00.")).toBeDefined();
  // Only the opening's own message: nothing for the whole form.
  expect(screen.queryByRole("alert")).toBeNull();

  const closes = within(day("Monday")).getAllByLabelText("Closes")[1];
  if (closes) await userEvent.selectOptions(closes, "17:00");

  expect(screen.queryByText("Overlaps Monday 12:00–15:00.")).toBeNull();
});

test("after a save it says so, until something changes", async () => {
  renderForm({ saved: true });

  expect(screen.getByRole("status").textContent).toBe("Opening hours saved.");

  await userEvent.click(screen.getByRole("button", { name: "Add opening hours, Monday" }));

  expect(screen.queryByRole("status")).toBeNull();
});

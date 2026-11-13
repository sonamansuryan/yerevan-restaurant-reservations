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

// Two openings on Monday, and the server's answer that the second overlaps the first.
const twoOnMonday: WeekFields = {
  hours: [
    { dayOfWeek: 1, opens: String(12 * 60), closes: String(15 * 60) },
    { dayOfWeek: 1, opens: String(14 * 60), closes: String(16 * 60) },
  ],
};
const overlap = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
  fields: { "hours.1": "Overlaps Monday 12:00–15:00." },
});

function renderForm(props: Partial<ComponentProps<typeof OpeningHoursForm>> = {}): Mock {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      {/* As on the page: Save changes is up in the header, outside the form, and sends it by id. */}
      <button type="submit" form="opening-hours">
        Save changes
      </button>
      <OpeningHoursForm id="opening-hours" values={fridayLate} onSubmit={onSubmit} {...props} />
    </MemoryRouter>,
  );
  return onSubmit;
}

const day = (name: string): HTMLElement => screen.getByRole("group", { name });
// Found by its label's words. jsdom names it "Openon Monday", dropping the space before the hidden
// words, which a browser keeps.
const open = (name: string): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(`Open on ${name}`);
const save = (): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: "Save changes" }));
const selected = (select: HTMLElement): string | undefined =>
  (select as HTMLSelectElement).selectedOptions[0]?.textContent ?? undefined;

test("the week starts on Monday, and a day with no openings is closed", () => {
  renderForm();

  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Weekly opening hours");
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
  expect(within(day("Monday")).getByText("No bookings this day")).toBeDefined();
  expect(open("Monday").checked).toBe(false);
  expect(within(day("Friday")).queryByText("No bookings this day")).toBeNull();
  expect(open("Friday").checked).toBe(true);
});

test("a closing at or before the opening is marked as the next day's", () => {
  renderForm();

  const friday = within(day("Friday"));
  expect(selected(friday.getByLabelText("Friday opens"))).toBe("18:00");
  expect(selected(friday.getByLabelText("Friday closes"))).toBe("02:00 (next day)");
});

test("the week is sent whole, with each closing counted from its own day", async () => {
  const onSubmit = renderForm();

  await userEvent.click(open("Monday"));
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

  await userEvent.selectOptions(friday.getByLabelText("Friday opens"), "01:00");

  expect(selected(friday.getByLabelText("Friday closes"))).toBe("02:00");
});

test("ticking Open gives a day its first opening, and the next one comes for the evening", async () => {
  renderForm();

  await userEvent.click(open("Monday"));
  const monday = within(day("Monday"));
  expect(selected(monday.getByLabelText("Monday opens"))).toBe("12:00");
  expect(selected(monday.getByLabelText("Monday closes"))).toBe("22:00");
  expect(monday.queryByText("No bookings this day")).toBeNull();

  await userEvent.click(monday.getByRole("button", { name: "Add another opening, Monday" }));

  expect(monday.getAllByLabelText("Monday opens").map(selected)).toEqual(["12:00", "18:00"]);
  expect(monday.getAllByLabelText("Monday closes").map(selected)).toEqual(["22:00", "23:00"]);
});

test("a day holds three openings at most", async () => {
  renderForm();

  await userEvent.click(open("Monday"));
  await userEvent.click(screen.getByRole("button", { name: "Add another opening, Monday" }));
  await userEvent.click(screen.getByRole("button", { name: "Add another opening, Monday" }));

  expect(within(day("Monday")).getAllByLabelText("Monday opens")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Add another opening, Monday" })).toBeNull();
});

test("unticking Open closes the day, taking all its openings with it", async () => {
  renderForm();
  await userEvent.click(open("Monday"));
  await userEvent.click(screen.getByRole("button", { name: "Add another opening, Monday" }));

  await userEvent.click(open("Monday"));

  expect(within(day("Monday")).queryAllByLabelText("Monday opens")).toHaveLength(0);
  expect(within(day("Monday")).getByText("No bookings this day")).toBeDefined();
  expect(open("Monday").checked).toBe(false);
  // Only that day's: Friday keeps its opening.
  expect(within(day("Friday")).getAllByLabelText("Friday opens")).toHaveLength(1);
});

test("Remove takes an opening away, and its day is closed again", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Remove, Friday 18:00 to 02:00" }));

  expect(within(day("Friday")).getByText("No bookings this day")).toBeDefined();
  expect(open("Friday").checked).toBe(false);
});

test("an empty week isn't sent, and says why in the server's words", async () => {
  const onSubmit = renderForm({ values: { hours: [] } });

  await save();

  expect(screen.getByRole("alert").textContent).toBe("Add at least one opening time.");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("the server's message appears under the opening it's about, and goes when it changes", async () => {
  renderForm({ values: twoOnMonday, error: overlap });

  const [first, second] = within(day("Monday")).getAllByLabelText("Monday opens");
  expect(second?.getAttribute("aria-invalid")).toBe("true");
  expect(first?.getAttribute("aria-invalid")).toBeNull();
  // The message is under the opening, and its opening time is described by it.
  const message = screen.getByText("Overlaps Monday 12:00–15:00.");
  expect(second?.getAttribute("aria-describedby")).toBe(message.id);
  // Only the opening's own message: nothing for the whole form.
  expect(screen.queryByRole("alert")).toBeNull();

  const closes = within(day("Monday")).getAllByLabelText("Monday closes")[1];
  if (closes) await userEvent.selectOptions(closes, "17:00");

  expect(screen.queryByText("Overlaps Monday 12:00–15:00.")).toBeNull();
  expect(second?.getAttribute("aria-invalid")).toBeNull();
});

test("both times of the opening the server's message is about are marked invalid", () => {
  renderForm({ values: twoOnMonday, error: overlap });

  // Both are drawn as invalid, so screen readers should hear both are.
  const [first, second] = within(day("Monday")).getAllByLabelText("Monday closes");
  expect(second?.getAttribute("aria-invalid")).toBe("true");
  expect(first?.getAttribute("aria-invalid")).toBeNull();
});

test("after a save it says so, until something changes", async () => {
  renderForm({ saved: true });

  expect(screen.getByRole("status").textContent).toBe("Opening hours saved.");

  await userEvent.click(open("Monday"));

  expect(screen.queryByRole("status")).toBeNull();
});

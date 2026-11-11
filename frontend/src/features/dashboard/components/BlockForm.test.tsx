// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { newBlock } from "@/features/dashboard/blocks";
import { BlockForm } from "@/features/dashboard/components/BlockForm";
import { fridayBookings, ownedTables } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

const FRIDAY = "2026-11-13";
type Props = ComponentProps<typeof BlockForm>;

function renderForm(props: Partial<Props> = {}): Props {
  const all: Props = {
    tables: ownedTables.filter((table) => table.isActive),
    values: newBlock(FRIDAY),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  render(<BlockForm {...all} />);
  return all;
}

const field = (label: string): HTMLElement => screen.getByLabelText(label);
const send = (): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: "Block this time" }));
const sent = (onSubmit: Props["onSubmit"]): unknown => vi.mocked(onSubmit).mock.calls[0]?.[0];

test("the whole restaurant for a whole day sends just the date", async () => {
  const { onSubmit } = renderForm();

  fireEvent.change(field("Date"), { target: { value: "2026-12-31" } });
  await userEvent.type(field("Reason"), "New Year's Eve");
  await send();

  expect(sent(onSubmit)).toEqual({ date: "2026-12-31", reason: "New Year's Eve" });
});

test("one table for a time range sends the table, and when it starts and ends", async () => {
  const { onSubmit } = renderForm();

  await userEvent.click(screen.getByRole("radio", { name: /One table/ }));
  await userEvent.selectOptions(field("Table"), "T4 · Terrace · 3–6 guests");
  await userEvent.click(screen.getByRole("radio", { name: /A time range/ }));
  fireEvent.change(field("Start date"), { target: { value: "2026-11-20" } });
  await userEvent.selectOptions(field("Start time"), "18:00");
  fireEvent.change(field("End date"), { target: { value: "2026-11-21" } });
  await userEvent.selectOptions(field("End time"), "02:00");
  await send();

  expect(sent(onSubmit)).toEqual({
    tableId: "table-t4",
    from: "2026-11-20T18:00",
    to: "2026-11-21T02:00",
  });
});

test("only active tables can be chosen", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("radio", { name: /One table/ }));

  const options = [...(field("Table") as HTMLSelectElement).options].map((option) => option.text);
  expect(options).toContain("T1 · Indoor · 2–4 guests");
  expect(options.some((option) => option.startsWith("T6"))).toBe(false);
});

test("problems show under their fields, and nothing is sent", async () => {
  const { onSubmit } = renderForm();

  await userEvent.click(screen.getByRole("radio", { name: /One table/ }));
  await userEvent.click(screen.getByRole("radio", { name: /A time range/ }));
  fireEvent.change(field("End date"), { target: { value: "2026-11-12" } });
  await send();

  expect(screen.getByText("Choose a table.")).toBeDefined();
  expect(screen.getByText("End the block after it starts.")).toBeDefined();
  expect(field("End date").getAttribute("aria-invalid")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("the server's message about the end shows under the end date", () => {
  const over = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
    fields: { to: "Choose a time that hasn't passed yet." },
  });

  renderForm({ values: { ...newBlock(FRIDAY), kind: "range" }, error: over });

  expect(screen.getByText("Choose a time that hasn't passed yet.")).toBeDefined();
  expect(field("End date").getAttribute("aria-invalid")).toBe("true");
  // It belongs to a field, so there's no notice above the form.
  expect(screen.queryByRole("alert")).toBeNull();
});

test("bookings inside the block are listed above the form", () => {
  const inside = new ApiError(
    409,
    "BLOCK_HAS_BOOKINGS",
    "2 upcoming bookings fall inside this block. Choose another time, or cancel them first.",
    { reservations: fridayBookings.slice(2, 4) },
  );

  renderForm({ error: inside });

  expect(screen.getByRole("alert").textContent).toBe(inside.message);
  expect(
    screen.getByRole("list", { name: "Bookings in the way" }).querySelectorAll("li"),
  ).toHaveLength(2);
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { TableForm } from "@/features/dashboard/components/TableForm";
import { NEW_TABLE } from "@/features/dashboard/tables";
import { fridayBookings } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

type Props = ComponentProps<typeof TableForm>;

function renderForm(props: Partial<Props> = {}): Props {
  const all: Props = {
    values: NEW_TABLE,
    submitLabel: "Add the table",
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  render(<TableForm {...all} />);
  return all;
}

const field = (label: string): HTMLElement => screen.getByLabelText(label);

test("a new table is sent with its seats as numbers", async () => {
  const { onSubmit } = renderForm();

  await userEvent.type(field("Name"), " T7 ");
  await userEvent.selectOptions(field("Seats"), "6");
  await userEvent.selectOptions(field("Fewest guests"), "3");
  await userEvent.selectOptions(field("Area"), "Terrace");
  await userEvent.click(screen.getByRole("button", { name: "Add the table" }));

  expect(vi.mocked(onSubmit).mock.calls[0]?.[0]).toEqual({
    label: "T7",
    capacity: 6,
    minCapacity: 3,
    zone: "TERRACE",
  });
});

test("a missing name, or a minimum above the seats, shows under its field, and nothing is sent", async () => {
  const { onSubmit } = renderForm();

  await userEvent.selectOptions(field("Seats"), "2");
  await userEvent.selectOptions(field("Fewest guests"), "4");
  await userEvent.click(screen.getByRole("button", { name: "Add the table" }));

  expect(screen.getByText("Enter the table's name, such as T4.")).toBeDefined();
  expect(screen.getByText("Use no more than the table's seats.")).toBeDefined();
  expect(field("Fewest guests").getAttribute("aria-invalid")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a name another table has shows under the name, not above the form", () => {
  const taken = new ApiError(
    409,
    "TABLE_LABEL_TAKEN",
    "Another table already has this name. If it's deactivated, activate it again instead.",
  );

  renderForm({ values: { ...NEW_TABLE, label: "T6" }, error: taken });

  expect(field("Name").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText(taken.message)).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("too few seats for a booked party is said above the form, with that booking", () => {
  const party = fridayBookings.find((booking) => booking.id === "booking-3");
  const tooSmall = new ApiError(
    409,
    "TABLE_TOO_SMALL",
    "An upcoming booking for 4 guests needs this table. Keep at least 4 seats until it's over or cancelled.",
    { reservations: [party] },
  );

  renderForm({ submitLabel: "Save table", error: tooSmall });

  expect(screen.getByRole("alert").textContent).toBe(tooSmall.message);
  expect(screen.getByRole("list", { name: "Bookings in the way" }).textContent).toContain(
    "Anahit Petrosyan · 4 guests · Table T3",
  );
});

test("Cancel leaves without sending, and the button says what it does while sending", async () => {
  const { onCancel, onSubmit } = renderForm({ submitLabel: "Save table", pending: true });

  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save table" }).getAttribute("aria-busy")).toBe("true");
});

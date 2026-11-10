// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { RestaurantForm } from "@/features/dashboard/components/RestaurantForm";
import { NEW_RESTAURANT, restaurantFields } from "@/features/dashboard/schemas";
import { ownedLori } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

type Props = Partial<ComponentProps<typeof RestaurantForm>>;

function renderForm(props: Props = {}): Mock {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      <RestaurantForm
        values={NEW_RESTAURANT}
        submitLabel="Add the restaurant"
        onSubmit={onSubmit}
        {...props}
      />
    </MemoryRouter>,
  );
  return onSubmit;
}

const field = (label: string): HTMLElement => screen.getByLabelText(label);
const send = (label = "Add the restaurant"): Promise<void> =>
  userEvent.click(screen.getByRole("button", { name: label }));

test("a new restaurant is sent with its choices as numbers and empty details as none", async () => {
  const onSubmit = renderForm();

  await userEvent.type(field("Name"), "Lori Smokehouse");
  await userEvent.click(field("Armenian"));
  await userEvent.click(field("Steakhouse"));
  await userEvent.selectOptions(field("Price"), "֏֏ Moderate");
  await userEvent.selectOptions(field("District"), "Arabkir");
  await userEvent.type(field("Address"), "52 Komitas Avenue, Yerevan");
  await send();

  expect(onSubmit).toHaveBeenCalledOnce();
  expect(onSubmit.mock.calls[0]?.[0]).toEqual({
    name: "Lori Smokehouse",
    description: null,
    cuisines: ["ARMENIAN", "STEAKHOUSE"],
    district: "ARABKIR",
    address: "52 Komitas Avenue, Yerevan",
    phone: null,
    website: null,
    priceLevel: 2,
    slotIntervalMin: 30,
    reservationDurationMin: 120,
  });
});

test("problems show under their fields, in the server's words, and nothing is sent", async () => {
  const onSubmit = renderForm();

  await userEvent.type(field("Website"), "lori.am");
  await send();

  for (const message of [
    "Enter the restaurant's name.",
    "Choose at least one cuisine.",
    "Choose a price from ֏ to ֏֏֏֏.",
    "Choose a district from the list.",
    "Enter the address.",
    "Enter a website address, such as https://example.am.",
  ]) {
    expect(screen.getByText(message)).toBeDefined();
  }
  expect(field("Name").getAttribute("aria-invalid")).toBe("true");
  expect(onSubmit).not.toHaveBeenCalled();
});

test("once three cuisines are ticked, the others wait, so the limit can't be broken", async () => {
  renderForm();

  await userEvent.click(field("Armenian"));
  await userEvent.click(field("Georgian"));
  expect((field("Italian") as HTMLInputElement).disabled).toBe(false);

  await userEvent.click(field("Fusion"));
  expect((field("Italian") as HTMLInputElement).disabled).toBe(true);
  expect((field("Fusion") as HTMLInputElement).disabled).toBe(false);

  // Unticking one frees the rest again.
  await userEvent.click(field("Georgian"));
  expect((field("Italian") as HTMLInputElement).disabled).toBe(false);
});

test("a saved restaurant fills the form, with its booking settings", () => {
  renderForm({ values: restaurantFields(ownedLori), submitLabel: "Save changes" });

  expect((field("Name") as HTMLInputElement).value).toBe("Lori Smokehouse");
  expect((field("Armenian") as HTMLInputElement).checked).toBe(true);
  expect((field("Georgian") as HTMLInputElement).checked).toBe(false);
  const length = field("Booking length") as HTMLSelectElement;
  expect(length.selectedOptions[0]?.textContent).toBe("2 hours");
});

test("the server's message about one field shows under that field", () => {
  const refused = new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
    fields: { phone: "Enter a phone number, such as +374 10 123456." },
  });

  renderForm({ values: restaurantFields(ownedLori), submitLabel: "Save changes", error: refused });

  expect(screen.getByText("Enter a phone number, such as +374 10 123456.")).toBeDefined();
  expect(field("Phone").getAttribute("aria-invalid")).toBe("true");
  // It's about one field, so there's no notice for the whole form.
  expect(screen.queryByRole("alert")).toBeNull();
});

test("no connection is said above the form", () => {
  const offline = new ApiError(0, "NETWORK_ERROR", "We can't reach the server right now.");

  renderForm({ values: restaurantFields(ownedLori), submitLabel: "Save changes", error: offline });

  expect(screen.getByRole("alert").textContent).toBe("We can't reach the server right now.");
});

test("after a save it says so, until something changes", async () => {
  renderForm({ values: restaurantFields(ownedLori), submitLabel: "Save changes", saved: true });

  expect(screen.getByRole("status").textContent).toBe("Changes saved.");

  await userEvent.type(field("Name"), " Grill");

  expect(screen.queryByRole("status")).toBeNull();
});

test("while sending, the button is busy", () => {
  renderForm({ values: restaurantFields(ownedLori), submitLabel: "Save changes", pending: true });

  expect(screen.getByRole("button", { name: "Save changes" }).getAttribute("aria-busy")).toBe(
    "true",
  );
});

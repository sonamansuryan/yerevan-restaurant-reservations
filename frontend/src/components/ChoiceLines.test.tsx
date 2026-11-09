// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { ChoiceLines } from "@/components/ChoiceLines";

afterEach(cleanup);

const roles = [
  { value: "CUSTOMER", label: "A guest", note: "Book tables" },
  { value: "OWNER", label: "A restaurant", note: "Manage bookings" },
];

const radio = (name: RegExp): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("radio", { name });

test("it's a radio group named by its legend, with one radio per line", () => {
  render(<ChoiceLines legend="I’m joining as" name="role" options={roles} />);

  const group = screen.getByRole("group", { name: "I’m joining as" });

  expect(within(group).getAllByRole("radio")).toHaveLength(2);
  expect(radio(/A guest/).value).toBe("CUSTOMER");
});

test("each radio is named by its line, note included, while the dotted line stays silent", () => {
  render(<ChoiceLines legend="I’m joining as" name="role" options={roles} />);

  expect(screen.getByRole("radio", { name: "A guest Book tables" })).toBeDefined();
  for (const leader of document.querySelectorAll(".menu-leader")) {
    expect(leader.getAttribute("aria-hidden")).toBe("true");
  }
});

test("defaultChoice chooses a line to start with", () => {
  render(<ChoiceLines legend="I’m joining as" name="role" options={roles} defaultChoice="OWNER" />);

  expect(radio(/A restaurant/).checked).toBe(true);
  expect(radio(/A guest/).checked).toBe(false);
});

test("a tap anywhere on a line chooses it, the note included", async () => {
  render(
    <ChoiceLines legend="I’m joining as" name="role" options={roles} defaultChoice="CUSTOMER" />,
  );

  await userEvent.click(screen.getByText("Manage bookings"));

  expect(radio(/A restaurant/).checked).toBe(true);
});

test("an error is tied to the group, and every radio is marked invalid", () => {
  render(
    <ChoiceLines
      legend="I’m joining as"
      name="role"
      options={roles}
      error="Choose a guest or restaurant account."
    />,
  );

  const group = screen.getByRole("group", { name: "I’m joining as" });

  expect(group.getAttribute("aria-describedby")).toBe(
    screen.getByText("Choose a guest or restaurant account.").id,
  );
  expect(radio(/A guest/).getAttribute("aria-invalid")).toBe("true");
});

test("other props, such as register's name, reach every radio", () => {
  render(<ChoiceLines legend="I’m joining as" name="role" options={roles} />);

  expect(radio(/A guest/).name).toBe("role");
  expect(radio(/A restaurant/).name).toBe("role");
});

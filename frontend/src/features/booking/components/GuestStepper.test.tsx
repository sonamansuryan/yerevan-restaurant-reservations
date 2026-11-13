// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { GuestStepper } from "@/features/booking/components/GuestStepper";

afterEach(cleanup);

test("the party is said in words, and read out as it changes", () => {
  render(<GuestStepper guests={2} onChange={vi.fn()} />);

  // An <output> is a status, so screen readers hear the new number without moving to it.
  const output = screen.getByRole("status");
  expect(output.tagName).toBe("OUTPUT");
  expect(output.textContent).toBe("2 guests");
  expect(output.getAttribute("aria-live")).toBe("polite");
});

test("one guest is one guest", () => {
  render(<GuestStepper guests={1} onChange={vi.fn()} />);

  expect(screen.getByRole("status").textContent).toBe("1 guest");
});

test("more and fewer change the party by one", async () => {
  const onChange = vi.fn();
  render(<GuestStepper guests={4} onChange={onChange} />);

  await userEvent.click(screen.getByRole("button", { name: "More guests" }));
  expect(onChange).toHaveBeenLastCalledWith(5);

  await userEvent.click(screen.getByRole("button", { name: "Fewer guests" }));
  expect(onChange).toHaveBeenLastCalledWith(3);
  expect(onChange).toHaveBeenCalledTimes(2);
});

test("there are never fewer than one guest, or more than twenty", async () => {
  const onChange = vi.fn();
  const { rerender } = render(<GuestStepper guests={1} onChange={onChange} />);

  const fewer = screen.getByRole<HTMLButtonElement>("button", { name: "Fewer guests" });
  const more = screen.getByRole<HTMLButtonElement>("button", { name: "More guests" });
  expect(fewer.disabled).toBe(true);
  expect(more.disabled).toBe(false);
  await userEvent.click(fewer);

  rerender(<GuestStepper guests={20} onChange={onChange} />);

  expect(fewer.disabled).toBe(false);
  expect(more.disabled).toBe(true);
  await userEvent.click(more);

  expect(onChange).not.toHaveBeenCalled();
});

test("the buttons and the number are one group, named Guests", () => {
  render(<GuestStepper guests={2} onChange={vi.fn()} />);

  const group = screen.getByRole("group", { name: "Guests" });
  expect(
    within(group)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Fewer guests", "More guests"]);
  expect(within(group).getByRole("status").textContent).toBe("2 guests");
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { SlotButton } from "@/components/SlotButton";

afterEach(cleanup);

test("a time is a button that says whether it's the chosen one", () => {
  render(
    <>
      <SlotButton>18:30</SlotButton>
      <SlotButton selected>19:00</SlotButton>
    </>,
  );

  expect(screen.getByRole("button", { name: "18:30" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "19:00" }).getAttribute("aria-pressed")).toBe("true");
});

test("a time that can't be chosen does nothing", async () => {
  const onClick = vi.fn();
  render(
    <SlotButton disabled onClick={onClick}>
      13:00
    </SlotButton>,
  );

  await userEvent.click(screen.getByRole("button", { name: "13:00" }));

  expect(onClick).not.toHaveBeenCalled();
});

test("passes other attributes to the button, so /design can show its states", () => {
  render(<SlotButton data-force="hover">19:00</SlotButton>);

  expect(screen.getByRole("button", { name: "19:00" }).getAttribute("data-force")).toBe("hover");
});

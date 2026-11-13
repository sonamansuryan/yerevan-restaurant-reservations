// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import { SaveButton } from "@/components/SaveButton";

afterEach(cleanup);

test("not saved: it says Save, isn't pressed, and is named after what it saves", () => {
  render(<SaveButton saved={false} name="Lori Smokehouse" />);

  const button = screen.getByRole("button", { name: "Save Lori Smokehouse" });
  expect(button.getAttribute("aria-pressed")).toBe("false");
  // The restaurant is in the name, not on screen: the card or page around it already shows it.
  expect(button.textContent).toBe("Save");
});

test("saved: it says Saved, and is pressed", () => {
  render(<SaveButton saved name="Lori Smokehouse" />);

  const button = screen.getByRole("button", { name: "Saved Lori Smokehouse" });
  expect(button.getAttribute("aria-pressed")).toBe("true");
});

test("a press asks for the change", async () => {
  const onClick = vi.fn();
  render(<SaveButton saved={false} name="Lori Smokehouse" onClick={onClick} />);

  await userEvent.click(screen.getByRole("button"));

  expect(onClick).toHaveBeenCalledTimes(1);
});

test("while the change is sent, it says so and ignores presses, but keeps its focus", async () => {
  const onClick = vi.fn();
  render(<SaveButton saved={false} name="Lori Smokehouse" loading onClick={onClick} />);

  const button = screen.getByRole("button");
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(button.hasAttribute("disabled")).toBe(false);
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

test("other attributes reach the button, so /design can freeze its states", () => {
  render(<SaveButton saved={false} name="Lori Smokehouse" data-force="hover" />);

  expect(screen.getByRole("button").getAttribute("data-force")).toBe("hover");
});

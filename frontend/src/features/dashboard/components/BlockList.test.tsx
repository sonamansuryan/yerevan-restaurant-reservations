// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { BlockList } from "@/features/dashboard/components/BlockList";
import { sampleBlocks } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

// jsdom has no showModal(), which Modal uses. These open and close it the simple way.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

const FRIDAY = "2026-11-13";

test("each block says when, what, and why, by when it starts", () => {
  render(<BlockList blocks={sampleBlocks} today={FRIDAY} onRemove={vi.fn()} />);

  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    "Saturday 14 November18:00–23:00 · Table T4 · TerraceReason: A wobbly legRemove",
    "Friday 20 November – Saturday 21 November18:00–02:00 · Whole restaurantReason: Private eventRemove",
    "Thursday 31 DecemberAll day · Whole restaurantRemove",
    "Friday 1 January 2027 – Thursday 7 January 2027All day · Whole restaurantReason: Holiday weekRemove",
  ]);
});

test("Remove asks first, and Keep it removes nothing", async () => {
  const onRemove = vi.fn();
  render(<BlockList blocks={sampleBlocks} today={FRIDAY} onRemove={onRemove} />);

  await userEvent.click(
    screen.getByRole("button", {
      name: "Remove, Saturday 14 November, 18:00–23:00, Table T4 · Terrace",
    }),
  );
  const question = screen.getByRole("dialog", { name: "Remove this block?" });
  expect(question.textContent).toContain("Guests can book this time again.");

  await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));

  expect(onRemove).not.toHaveBeenCalled();
});

test("confirming removes that block", async () => {
  const onRemove = vi.fn();
  render(<BlockList blocks={sampleBlocks} today={FRIDAY} onRemove={onRemove} />);

  await userEvent.click(
    screen.getByRole("button", { name: "Remove, Thursday 31 December, All day, Whole restaurant" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Remove block" }));

  expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "block-3" }));
});

test("a removal that failed says so above the list", () => {
  const offline = new ApiError(0, "NETWORK_ERROR", "We can't reach the server right now.");

  render(<BlockList blocks={sampleBlocks} today={FRIDAY} onRemove={vi.fn()} error={offline} />);

  expect(screen.getByRole("alert").textContent).toBe("We can't reach the server right now.");
});

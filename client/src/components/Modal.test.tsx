// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Modal } from "@/components/Modal";

// jsdom has no showModal() or close(), so these stand in for them. These tests cover the React
// wiring only. Focus, Esc and the backdrop's real behavior can only be tested in a browser.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(cleanup);

test("it opens as a modal, named by its title", () => {
  render(
    <Modal open title="Cancel this booking?" onClose={vi.fn()}>
      Text
    </Modal>,
  );

  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Cancel this booking?" })).toBeDefined();
});

test("it stays closed until asked", () => {
  render(
    <Modal open={false} title="Title" onClose={vi.fn()}>
      Text
    </Modal>,
  );

  expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
});

test("it closes when the parent says so", () => {
  const { rerender } = render(
    <Modal open title="Title" onClose={vi.fn()}>
      Text
    </Modal>,
  );

  rerender(
    <Modal open={false} title="Title" onClose={vi.fn()}>
      Text
    </Modal>,
  );

  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
});

test("the close button asks to close", async () => {
  const onClose = vi.fn();
  render(
    <Modal open title="Title" onClose={onClose}>
      Text
    </Modal>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(onClose).toHaveBeenCalledOnce();
});

test("a footer replaces the close button, so there's always one visible way out", () => {
  render(
    <Modal open title="Title" onClose={vi.fn()} footer={<button type="button">Keep it</button>}>
      Text
    </Modal>,
  );

  expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
});

test("the browser closing it, as Esc does, tells the parent", () => {
  const onClose = vi.fn();
  render(
    <Modal open title="Title" onClose={onClose}>
      Text
    </Modal>,
  );

  fireEvent(screen.getByRole("dialog"), new Event("close"));

  expect(onClose).toHaveBeenCalledOnce();
});

test("a press on the backdrop closes it, and a press on the content doesn't", () => {
  const onClose = vi.fn();
  render(
    <Modal open title="Title" onClose={onClose}>
      Text
    </Modal>,
  );

  fireEvent.mouseDown(screen.getByText("Text"));
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.mouseDown(screen.getByRole("dialog"));
  expect(onClose).toHaveBeenCalledOnce();
});

test("the footer's actions are shown", () => {
  render(
    <Modal open title="Title" onClose={vi.fn()} footer={<button type="button">Keep it</button>}>
      Text
    </Modal>,
  );

  expect(screen.getByRole("button", { name: "Keep it" })).toBeDefined();
});

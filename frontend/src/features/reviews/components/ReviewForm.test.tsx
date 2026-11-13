// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { ReviewForm } from "@/features/reviews/components/ReviewForm";
import { ApiError } from "@/lib/api";

afterEach(cleanup);

function renderForm(change: Partial<ComponentProps<typeof ReviewForm>> = {}) {
  const props = {
    visit: "Lori Smokehouse on Friday 6 November",
    onPost: vi.fn(),
    onClose: vi.fn(),
    ...change,
  };
  // ServerNotice reads the location, for its Sign in link.
  render(
    <MemoryRouter>
      <ReviewForm {...props} />
    </MemoryRouter>,
  );
  return props;
}

test("the five ratings are in words, best first, with none chosen yet", () => {
  renderForm();

  const ratings = within(screen.getByRole("group", { name: "Your rating" }));
  const radios = ratings.getAllByRole<HTMLInputElement>("radio");
  expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
    "Excellent 5",
    "Very good 4",
    "Good 3",
    "Fair 2",
    "Poor 1",
  ]);
  expect(radios.some((radio) => radio.checked)).toBe(false);
});

test("the words are optional, and the hint says who will see them", () => {
  renderForm();

  const words = screen.getByLabelText("Your review");
  expect(words.getAttribute("aria-describedby")).toBeTruthy();
  expect(screen.getByText("Optional. Other guests see it with your first name.")).toBeDefined();
});

test("a rating is needed: without one, it says so, and nothing is sent", async () => {
  const { onPost } = renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect(screen.getByText("Choose a rating.")).toBeDefined();
  expect(onPost).not.toHaveBeenCalled();
});

test("a rating alone is enough, and blank words count as none", async () => {
  const { onPost } = renderForm();

  await userEvent.click(screen.getByRole("radio", { name: /Excellent/ }));
  await userEvent.type(screen.getByLabelText("Your review"), "   ");
  await userEvent.click(screen.getByRole("button", { name: "Post review" }));

  expect(onPost).toHaveBeenCalledWith({ rating: 5 });
});

test("the arrow keys move between the ratings, as in any radio group", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("radio", { name: /Good 3/ }));
  await userEvent.keyboard("{ArrowDown}");

  expect(screen.getByRole<HTMLInputElement>("radio", { name: /Fair/ }).checked).toBe(true);
});

test("words over 1000 characters are refused under the field, and nothing is sent", async () => {
  const { onPost } = renderForm({
    defaultValues: { rating: "4", comment: "a".repeat(1001) },
    validateOnMount: true,
  });

  expect(await screen.findByText("Use 1000 characters or fewer.")).toBeDefined();
  expect(screen.queryByText("Optional. Other guests see it with your first name.")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Post review" }));
  expect(onPost).not.toHaveBeenCalled();
});

test("while it's sent, Post review waits", () => {
  renderForm({ sending: true });

  const button = screen.getByRole("button", { name: "Post review" });
  expect(button.getAttribute("aria-busy")).toBe("true");
});

test("a refusal is said above the form in the server's words", () => {
  renderForm({
    error: new ApiError(
      409,
      "NOT_VISITED",
      "You can review a visit once the restaurant has marked you as arrived.",
    ),
  });

  expect(screen.getByRole("alert").textContent).toBe(
    "You can review a visit once the restaurant has marked you as arrived.",
  );
});

test("a refusal about one field shows under that field instead", async () => {
  renderForm({
    error: new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", {
      fields: { comment: "Use 1000 characters or fewer." },
    }),
  });

  expect(await screen.findByText("Use 1000 characters or fewer.")).toBeDefined();
  expect(screen.queryByText("The request is invalid.")).toBeNull();
});

test("Not now closes it", async () => {
  const { onClose, onPost } = renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Not now" }));

  expect(onClose).toHaveBeenCalled();
  expect(onPost).not.toHaveBeenCalled();
});

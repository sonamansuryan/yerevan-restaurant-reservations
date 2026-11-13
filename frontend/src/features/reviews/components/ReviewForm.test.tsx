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

test("it names the visit, unless it sits under the visit's own card", () => {
  renderForm();
  expect(screen.getByText("Your visit to Lori Smokehouse on Friday 6 November.")).toBeDefined();
  cleanup();

  renderForm({ intro: false });
  expect(screen.queryByText(/^Your visit to/)).toBeNull();
});

test("the rating is five stars, each named in words for screen readers, with none chosen yet", () => {
  renderForm();

  const ratings = within(screen.getByRole("group", { name: "How was it?" }));
  const radios = ratings.getAllByRole<HTMLInputElement>("radio");
  expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
    "1 of 5, Poor",
    "2 of 5, Fair",
    "3 of 5, Good",
    "4 of 5, Very good",
    "5 of 5, Excellent",
  ]);
  expect(radios.some((radio) => radio.checked)).toBe(false);
  expect(screen.queryByText(/ of 5 · /)).toBeNull();
});

test("the rating chosen is said back in words beside the stars, for the eye", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("radio", { name: "4 of 5, Very good" }));

  // Screen readers have already heard it in the radio's name.
  expect(screen.getByText("4 of 5 · Very good").getAttribute("aria-hidden")).toBe("true");
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

  await userEvent.click(screen.getByRole("radio", { name: "3 of 5, Good" }));
  await userEvent.keyboard("{ArrowDown}");

  expect(screen.getByRole<HTMLInputElement>("radio", { name: "4 of 5, Very good" }).checked).toBe(
    true,
  );
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

test("Later closes it", async () => {
  const { onClose, onPost } = renderForm();

  await userEvent.click(screen.getByRole("button", { name: "Later" }));

  expect(onClose).toHaveBeenCalled();
  expect(onPost).not.toHaveBeenCalled();
});

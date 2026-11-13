// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";

import { StarRating } from "@/features/reviews/components/StarRating";
import { RATING_CHOICES } from "@/features/reviews/reviews";

afterEach(cleanup);

test("five radios, each read out with its rating in words, from the worst to the best", () => {
  render(<StarRating legend="Your rating" chosen={undefined} name="rating" />);

  const group = screen.getByRole("group", { name: "Your rating" });
  expect(
    within(group)
      .getAllByRole("radio")
      .map((radio) => radio.getAttribute("aria-label")),
  ).toEqual([
    "1 of 5, Poor",
    "2 of 5, Fair",
    "3 of 5, Good",
    "4 of 5, Very good",
    "5 of 5, Excellent",
  ]);
});

test("each radio's words are the review form's own", () => {
  render(<StarRating legend="Your rating" chosen={undefined} name="rating" />);

  for (const { value, label } of RATING_CHOICES) {
    const radio = screen.getByRole<HTMLInputElement>("radio", { name: `${value} of 5, ${label}` });
    expect(radio.value).toBe(value);
  }
});

test("the rating chosen is said beside the stars", () => {
  render(<StarRating legend="Your rating" chosen="4" name="rating" />);

  // Screen readers hear the chosen radio itself, so the words are for the eye.
  const words = screen.getByText("4 of 5 · Very good");
  expect(words.getAttribute("aria-hidden")).toBe("true");
});

test("with nothing chosen, nothing is said", () => {
  render(<StarRating legend="Your rating" chosen={undefined} name="rating" />);

  expect(screen.queryByText(/of 5 ·/)).toBeNull();
});

test("an error is shown under the stars, and the group is described by it", () => {
  render(
    <StarRating legend="Your rating" chosen={undefined} name="rating" error="Choose a rating." />,
  );

  const group = screen.getByRole("group", { name: "Your rating" });
  const describedBy = group.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Choose a rating.");
  for (const radio of screen.getAllByRole("radio")) {
    expect(radio.getAttribute("aria-invalid")).toBe("true");
  }
});

test("without an error, nothing describes the group", () => {
  render(<StarRating legend="Your rating" chosen={undefined} name="rating" />);

  expect(screen.getByRole("group").hasAttribute("aria-describedby")).toBe(false);
  expect(screen.getAllByRole("radio")[0]?.hasAttribute("aria-invalid")).toBe(false);
});

test("with a plain name, the five are one radio group, and the form sends the one chosen", async () => {
  render(
    <form aria-label="Review">
      <StarRating legend="Your rating" chosen={undefined} name="rating" />
    </form>,
  );

  await userEvent.click(screen.getByRole("radio", { name: "3 of 5, Good" }));
  await userEvent.click(screen.getByRole("radio", { name: "5 of 5, Excellent" }));

  expect(
    screen.getAllByRole<HTMLInputElement>("radio").filter((radio) => radio.checked),
  ).toHaveLength(1);
  const form = screen.getByRole<HTMLFormElement>("form", { name: "Review" });
  expect(new FormData(form).get("rating")).toBe("5");
});

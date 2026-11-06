// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Button } from "@/components/Button";
import type { ButtonVariant } from "@/components/Button";

afterEach(cleanup);

const stopSubmit = (event: FormEvent): void => event.preventDefault();

test("a plain button doesn't submit the form around it", async () => {
  const onSubmit = vi.fn(stopSubmit);
  render(
    <form onSubmit={onSubmit}>
      <Button>Save</Button>
    </form>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(onSubmit).not.toHaveBeenCalled();
});

test("a submit button submits", async () => {
  const onSubmit = vi.fn(stopSubmit);
  render(
    <form onSubmit={onSubmit}>
      <Button type="submit">Save</Button>
    </form>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(onSubmit).toHaveBeenCalledOnce();
});

test("Enter and Space both press it", async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save</Button>);

  await userEvent.tab();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard(" ");

  expect(onClick).toHaveBeenCalledTimes(2);
});

describe("disabled", () => {
  test("it ignores clicks and leaves the Tab order", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });

    await userEvent.click(button);
    await userEvent.tab();

    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(button);
  });

  test.each<ButtonVariant>(["primary", "accent", "ghost", "light"])(
    "the %s variant's colors are replaced, not stacked",
    (variant) => {
      render(
        <Button disabled variant={variant}>
          Save
        </Button>,
      );

      const classes = screen.getByRole("button").className.split(" ");

      expect(classes.filter((name) => name.startsWith("bg-"))).toEqual(["bg-fill-slot"]);
      expect(classes.some((name) => name.startsWith("hover:"))).toBe(false);
      expect(classes.some((name) => name.startsWith("active:"))).toBe(false);
    },
  );

  test("a disabled link doesn't react to hover", () => {
    render(
      <Button disabled variant="link">
        Save
      </Button>,
    );

    const classes = screen.getByRole("button").className;

    expect(classes).toContain("text-ink-muted");
    expect(classes).not.toContain("hover:");
  });
});

describe("the link variant", () => {
  test("it's a real button, with no box around it", () => {
    render(<Button variant="link">Keep it</Button>);

    const classes = screen.getByRole("button", { name: "Keep it" }).className;

    expect(classes).toContain("underline");
    expect(classes).not.toContain("h-12");
  });

  test("it's tall enough to tap on phones", () => {
    render(<Button variant="link">Keep it</Button>);

    expect(screen.getByRole("button").className).toContain("min-h-touch");
  });

  test("an arrow adds to the look, not to the name", () => {
    render(
      <Button variant="link" arrow>
        All categories
      </Button>,
    );

    const button = screen.getByRole("button", { name: "All categories" });

    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("there's no arrow unless it's asked for", () => {
    render(<Button variant="link">All categories</Button>);

    expect(screen.getByRole("button").querySelector("svg")).toBeNull();
  });
});

test("primary warms to the accent on hover", () => {
  render(<Button>Book</Button>);

  expect(screen.getByRole("button").className).toContain("hover:bg-accent");
});

test("a loading button has a thin ring, unlike the classic look", () => {
  render(<Button loading>Book</Button>);

  const ring = screen.getByRole("button").querySelector(".animate-spin");

  expect(ring?.className).toContain("border-[1.5px]");
});

describe("loading", () => {
  test("it keeps its name and stays in the Tab order", async () => {
    render(<Button loading>Book</Button>);
    const button = screen.getByRole("button", { name: "Book" });

    await userEvent.tab();

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  test("it ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Book
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Book" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  test("a second submit can't get through, by click or by Enter in a field", async () => {
    const onSubmit = vi.fn(stopSubmit);
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button type="submit" loading>
          Book
        </Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Book" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

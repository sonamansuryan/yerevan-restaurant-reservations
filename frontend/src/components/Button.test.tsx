// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Button, LinkButton } from "@/components/Button";
import type { ButtonSize, ButtonVariant } from "@/components/Button";

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

  test.each<ButtonVariant>(["primary", "accent", "ghost", "danger", "success", "light"])(
    "the %s variant's colors are replaced, not stacked",
    (variant) => {
      render(
        <Button disabled variant={variant}>
          Save
        </Button>,
      );

      const classes = screen.getByRole("button").className.split(" ");

      expect(classes.filter((name) => name.startsWith("bg-"))).toEqual(["bg-fill-disabled"]);
      expect(classes.filter((name) => name.startsWith("text-ink"))).toEqual(["text-ink-muted"]);
      expect(classes).toContain("border-transparent");
      expect(classes).toContain("cursor-not-allowed");
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

  test("it's wine and bold, as every link is, and its underline darkens on hover", () => {
    render(<Button variant="link">Keep it</Button>);

    const classes = screen.getByRole("button").className.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "font-semibold",
        "text-accent",
        "decoration-accent/40",
        "hover:text-accent-hover",
        "hover:decoration-current",
      ]),
    );
  });
});

describe("the look", () => {
  const classesOf = (button: HTMLElement): string[] => button.className.split(" ");

  test("it rounds the corners and bolds the label, and keeps the variant's colors", () => {
    render(<Button variant="accent">Book this table</Button>);

    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(
      expect.arrayContaining(["h-11", "rounded-control", "font-semibold", "bg-accent"]),
    );
  });

  test.each<[ButtonSize, string]>([
    ["default", "h-11 rounded-control px-5 text-ui"],
    ["large", "h-13 rounded-cta px-6 text-body"],
    ["small", "h-9.5 rounded-control px-4 text-ui any-pointer-coarse:h-11"],
    ["compact", "h-9 rounded-chip px-3 text-meta any-pointer-coarse:h-11"],
  ])("the %s size is %s", (size, look) => {
    render(<Button size={size}>Confirm</Button>);

    expect(classesOf(screen.getByRole("button"))).toEqual(expect.arrayContaining(look.split(" ")));
  });

  test.each<ButtonSize>(["small", "compact"])(
    "%s is shorter with a mouse, and still tall enough to tap on a touch screen",
    (size) => {
      render(<Button size={size}>Cancel booking</Button>);

      expect(classesOf(screen.getByRole("button"))).toContain("any-pointer-coarse:h-11");
    },
  );

  test("primary is ink, and darkens on hover", () => {
    render(<Button>Book</Button>);

    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["bg-ink", "text-on-dark", "hover:bg-fill-primary-hover"]),
    );
  });

  test("an outline button is white, with a softer line", () => {
    render(<Button variant="ghost">Keep it</Button>);

    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["bg-surface-raised", "border-line-strong", "text-ink"]),
    );
  });

  test("danger is a white outline in wine, so cancelling is never mistaken for the way forward", () => {
    render(<Button variant="danger">Cancel reservation</Button>);

    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(
      expect.arrayContaining([
        "border-line-danger",
        "bg-surface-raised",
        "text-accent",
        "hover:border-accent",
      ]),
    );
    expect(classes).not.toContain("bg-accent");
  });

  test("success is filled green", () => {
    render(<Button variant="success">Mark arrived</Button>);

    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["bg-success-strong", "text-on-accent", "hover:bg-success"]),
    );
  });

  test("a LinkButton takes the same look", () => {
    render(
      <MemoryRouter>
        <Button>A button</Button>
        <LinkButton to="/">A link</LinkButton>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link").className).toBe(screen.getByRole("button").className);
  });

  test("the classic look is left as it was, for the protected states", () => {
    render(
      <Button variant="ghost" look="classic" size="small">
        Try again
      </Button>,
    );

    // It ignores the sizes and the new weight, which belong to the default look.
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(
      expect.arrayContaining([
        "h-11.5",
        "rounded-control",
        "px-5",
        "font-medium",
        "bg-transparent",
      ]),
    );
    expect(classes).not.toContain("font-semibold");
    expect(classes).not.toContain("h-9.5");
  });
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

describe("LinkButton", () => {
  test("it's a real link, so it can be opened in a new tab", () => {
    render(
      <MemoryRouter>
        <LinkButton to="/restaurants">Reserve a table</LinkButton>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Reserve a table" });

    expect(link.getAttribute("href")).toBe("/restaurants");
  });

  test("it opens the page without a full reload", async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LinkButton to="/next">Go</LinkButton>} />
          <Route path="/next" element={<p>The next page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Go" }));

    expect(screen.getByText("The next page")).toBeDefined();
  });

  test.each<ButtonVariant>(["primary", "accent", "ghost", "danger", "success", "light", "link"])(
    "the %s variant looks exactly like the same Button",
    (variant) => {
      render(
        <MemoryRouter>
          <Button variant={variant}>A button</Button>
          <LinkButton to="/" variant={variant}>
            A link
          </LinkButton>
        </MemoryRouter>,
      );

      const button = screen.getByRole("button", { name: "A button" });
      const link = screen.getByRole("link", { name: "A link" });

      expect(link.className).toBe(button.className);
    },
  );

  test("it's primary unless told otherwise", () => {
    render(
      <MemoryRouter>
        <LinkButton to="/">Go</LinkButton>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Go" }).className).toContain("bg-ink");
  });

  test("it can take extra classes, such as a full width", () => {
    render(
      <MemoryRouter>
        <LinkButton to="/" className="w-full">
          Go
        </LinkButton>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Go" }).className).toContain("w-full");
  });
});

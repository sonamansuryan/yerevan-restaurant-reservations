// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Badge } from "@/components/Badge";
import type { BadgeTone } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";

afterEach(cleanup);

describe("Badge", () => {
  test.each<[BadgeTone, string, string]>([
    ["neutral", "bg-neutral-soft", "text-ink-secondary"],
    ["success", "bg-success-soft", "text-success"],
    ["warning", "bg-warning-soft", "text-warning"],
    ["error", "bg-error-soft", "text-error"],
    ["info", "bg-info-soft", "text-info"],
  ])("the %s tone sets the word on its soft fill", (tone, fill, text) => {
    render(<Badge tone={tone}>Confirmed</Badge>);

    const pill = screen.getByText("Confirmed");
    expect(pill.className).toContain(fill);
    expect(pill.className).toContain(text);
  });

  test("it's neutral unless told otherwise, and the word alone carries the meaning", () => {
    render(<Badge tone="success">Confirmed</Badge>);

    expect(screen.getByText("Confirmed").querySelector("span")).toBeNull();
    cleanup();

    render(<Badge>Cancelled</Badge>);
    expect(screen.getByText("Cancelled").className).toContain("bg-neutral-soft");
  });
});

describe("Spinner", () => {
  test("screen readers hear that something is loading", () => {
    render(<Spinner />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
  });

  test("its label can say what's loading", () => {
    render(<Spinner label="Loading restaurants" />);

    expect(screen.getByRole("status", { name: "Loading restaurants" })).toBeDefined();
  });

  test("it can stay silent when nearby text already explains", () => {
    render(<Spinner label={null} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  test("it's the logo's dot, and it stops for people who ask for less motion", () => {
    render(<Spinner />);

    const classes = screen.getByRole("status").className;

    expect(classes).toContain("animate-breathe");
    expect(classes).toContain("motion-reduce:animate-none");
  });
});

describe("EmptyState", () => {
  test("it shows the title, the description and the next step", () => {
    render(
      <EmptyState
        title="No reservations yet"
        description="Find a table and it will appear here."
        action={{ label: "Find a table", onClick: vi.fn() }}
      />,
    );

    expect(screen.getByText("No reservations yet")).toBeDefined();
    expect(screen.getByText("Find a table and it will appear here.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Find a table" })).toBeDefined();
  });

  test("the title is enough", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByText("Nothing here")).toBeDefined();
  });
});

describe("ErrorState", () => {
  test("screen readers are told at once", () => {
    render(<ErrorState title="We couldn't load this page" />);

    expect(screen.getByRole("alert").textContent).toContain("We couldn't load this page");
  });

  test("it has sensible words by default", () => {
    render(<ErrorState />);

    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  test("it has no button when there's nothing to retry", () => {
    render(<ErrorState />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  test("Try again runs the retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("a retry already running can't be started twice", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} retrying />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).not.toHaveBeenCalled();
  });
});

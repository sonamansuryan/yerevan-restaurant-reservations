// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Account } from "@/components/account";
import { SiteHeader } from "@/components/SiteHeader";
import type { AuthUser } from "@/types/api";

const lilit: AuthUser = {
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};

/** Nobody signed in, unless the test says otherwise. */
function account(changes: Partial<Account> = {}): Account {
  return { user: null, onSignOut: vi.fn(), signingOut: false, signOutFailed: false, ...changes };
}

// jsdom has no showModal() or close(). Real focus, Esc and backdrop behavior is checked in a browser.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function renderAt(path = "/", shown: Account = account()): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader account={shown} />
    </MemoryRouter>,
  );
}

const link = (name: string): HTMLElement => screen.getByRole("link", { name });

test.each([
  ["Discover", "/restaurants"],
  ["For restaurants", "/register?role=owner"],
  ["Sign in", "/login"],
  ["Reserve a table", "/restaurants"],
  ["Seghan, home", "/"],
])("%s goes to %s", (name, href) => {
  renderAt();

  expect(link(name).getAttribute("href")).toBe(href);
});

test("the logo shows the lowercase wordmark, and is named Seghan for screen readers", () => {
  renderAt();

  expect(link("Seghan, home").textContent).toBe("seghan");
});

test("phones show the short label, and screen readers still hear all of it", () => {
  renderAt();

  const hidden = link("Reserve a table").querySelector(".max-md\\:sr-only");

  expect(hidden?.textContent).toBe("a table");
});

test("the page you're on is marked", () => {
  renderAt("/restaurants");

  expect(link("Discover").getAttribute("aria-current")).toBe("page");
  expect(link("Sign in").getAttribute("aria-current")).toBeNull();
});

test("a filter in the address doesn't lose the mark", () => {
  renderAt("/restaurants?district=KENTRON");

  expect(link("Discover").getAttribute("aria-current")).toBe("page");
});

test("nothing is marked on a page with no link in the header", () => {
  renderAt("/");

  expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
});

test("For restaurants isn't marked on the plain sign-up page", () => {
  renderAt("/register");

  expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
});

test("the current page's dot is decoration, hidden from screen readers", () => {
  renderAt("/restaurants");

  const dot = link("Discover").querySelector(".bg-accent");

  expect(dot?.getAttribute("aria-hidden")).toBe("true");
});

test("Menu is a button that says it opens a dialog", () => {
  renderAt();

  const menu = screen.getByRole("button", { name: "Menu" });

  expect(menu.getAttribute("aria-haspopup")).toBe("dialog");
});

test("Menu opens the mobile menu, and Close closes it", async () => {
  renderAt();

  await userEvent.click(screen.getByRole("button", { name: "Menu" }));

  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Menu" })).toBeDefined();

  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
});

describe("the account corner", () => {
  test("while the app is still checking, it shows neither Sign in nor Sign out", () => {
    renderAt("/", account({ user: undefined }));

    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  test("signed in, Sign out and the person's first name take the place of Sign in", () => {
    renderAt("/", account({ user: lilit }));

    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
    // The first name is for the eye. Screen readers hear the full sentence instead.
    expect(screen.getByText("Lilit").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Signed in as Lilit Harutyunyan.")).toBeDefined();
  });

  test("Sign out asks to sign out", async () => {
    const shown = account({ user: lilit });
    renderAt("/", shown);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(shown.onSignOut).toHaveBeenCalledOnce();
  });

  test("while signing out, Sign out says it's busy and ignores more clicks", async () => {
    const shown = account({ user: lilit, signingOut: true });
    renderAt("/", shown);
    const button = screen.getByRole("button", { name: "Sign out" });

    await userEvent.click(button);

    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(shown.onSignOut).not.toHaveBeenCalled();
  });

  test("a failed sign-out says so, in place of the name, and Sign out stays", () => {
    renderAt("/", account({ user: lilit, signOutFailed: true }));

    expect(screen.getByRole("alert").textContent).toBe("Couldn’t sign out");
    expect(screen.queryByText("Lilit")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
  });
});

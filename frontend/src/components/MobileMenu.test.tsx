// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Account } from "@/components/account";
import { MobileMenu } from "@/components/MobileMenu";
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

// Stands in for the browser's width query, so a test can pretend the screen grew.
let isWide = false;
const widthListeners = new Set<() => void>();

function growScreen(): void {
  isWide = true;
  widthListeners.forEach((listener) => listener());
}

beforeEach(() => {
  isWide = false;
  widthListeners.clear();
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return isWide;
    },
    addEventListener: (_type: string, listener: () => void) => widthListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => widthListeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function renderMenu(
  open = true,
  onClose = vi.fn(),
  path = "/",
  shown: Account = account(),
): typeof onClose {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileMenu open={open} onClose={onClose} account={shown} />
    </MemoryRouter>,
  );
  return onClose;
}

test("it opens as a modal, named Menu", () => {
  renderMenu();

  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog", { name: "Menu" })).toBeDefined();
});

test("it stays closed until asked", () => {
  renderMenu(false);

  expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
});

test("it closes when the parent says so", () => {
  const { rerender } = render(
    <MemoryRouter>
      <MobileMenu open onClose={vi.fn()} account={account()} />
    </MemoryRouter>,
  );

  rerender(
    <MemoryRouter>
      <MobileMenu open={false} onClose={vi.fn()} account={account()} />
    </MemoryRouter>,
  );

  expect(HTMLDialogElement.prototype.close).toHaveBeenCalledOnce();
});

describe("its contents", () => {
  test.each([
    ["Discover All of Yerevan", "/restaurants"],
    ["For restaurants List yours", "/register?role=owner"],
    ["Sign in Your reservations", "/login"],
    ["Kentron", "/restaurants?district=KENTRON"],
    ["Arabkir", "/restaurants?district=ARABKIR"],
    ["Nor Nork", "/restaurants?district=NOR_NORK"],
    ["Malatia-Sebastia", "/restaurants?district=MALATIA_SEBASTIA"],
    ["Reserve a table", "/restaurants"],
    ["Seghan, home", "/"],
  ])("%s goes to %s", (name, href) => {
    renderMenu();

    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  });

  test("screen readers skip the dotted lines", () => {
    renderMenu();

    const lines = screen.getByRole("dialog").querySelectorAll(".menu-leader");

    expect(lines).toHaveLength(3);
    lines.forEach((line) => expect(line.getAttribute("aria-hidden")).toBe("true"));
  });

  test("the neighborhoods have a heading that names their group", () => {
    renderMenu();

    expect(screen.getByRole("navigation", { name: "Neighborhoods" })).toBeDefined();
  });

  test("the page you're on is marked", () => {
    renderMenu(true, vi.fn(), "/restaurants");

    const current = screen.getAllByRole("link", { current: "page" });

    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("Discover");
  });

  test("For restaurants isn't marked on the plain sign-up page", () => {
    renderMenu(true, vi.fn(), "/register");

    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });
});

describe("ways to close it", () => {
  test("the Close button", async () => {
    const onClose = renderMenu();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test.each(["Discover All of Yerevan", "Kentron", "Reserve a table", "Seghan, home"])(
    "the link %s, as the page behind it changes",
    async (name) => {
      const onClose = renderMenu();

      await userEvent.click(screen.getByRole("link", { name }));

      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  test("the browser closing it, as Esc does", () => {
    const onClose = renderMenu();

    fireEvent(screen.getByRole("dialog"), new Event("close"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("the screen growing past phone width, which reveals the full header", () => {
    const onClose = renderMenu();

    growScreen();

    expect(onClose).toHaveBeenCalledOnce();
  });
});

test("it's left open when the width changes but the screen is still phone-sized", () => {
  const onClose = renderMenu();

  widthListeners.forEach((listener) => listener());

  expect(onClose).not.toHaveBeenCalled();
});

test("it only watches the width while it's open", () => {
  const { unmount } = render(
    <MemoryRouter>
      <MobileMenu open onClose={vi.fn()} account={account()} />
    </MemoryRouter>,
  );

  expect(widthListeners.size).toBe(1);

  unmount();

  expect(widthListeners.size).toBe(0);
});

test("a closed menu doesn't watch the width at all", () => {
  renderMenu(false);

  expect(window.matchMedia).not.toHaveBeenCalled();
});

describe("the account line", () => {
  test("while the app is still checking, the line waits", () => {
    renderMenu(true, vi.fn(), "/", account({ user: undefined }));

    expect(screen.queryByRole("link", { name: "Sign in Your reservations" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  test("signed in, it's Sign out, with the person's full name as its note", () => {
    renderMenu(true, vi.fn(), "/", account({ user: lilit }));

    expect(screen.queryByRole("link", { name: "Sign in Your reservations" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
    expect(screen.getByText("Lilit Harutyunyan").textContent).toBe(
      "Signed in as Lilit Harutyunyan",
    );
    expect(screen.getByRole("dialog").querySelectorAll(".menu-leader")).toHaveLength(3);
  });

  test("Sign out asks to sign out, and the menu waits until that's done", async () => {
    const shown = account({ user: lilit });
    const onClose = renderMenu(true, vi.fn(), "/", shown);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(shown.onSignOut).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("while signing out, Sign out says it's busy and ignores more clicks", async () => {
    const shown = account({ user: lilit, signingOut: true });
    renderMenu(true, vi.fn(), "/", shown);
    const button = screen.getByRole("button", { name: "Sign out" });

    await userEvent.click(button);

    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(shown.onSignOut).not.toHaveBeenCalled();
  });

  test("the menu closes once the person is signed out", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MobileMenu open onClose={onClose} account={account({ user: lilit })} />
      </MemoryRouter>,
    );

    rerender(
      <MemoryRouter>
        <MobileMenu open onClose={onClose} account={account({ user: null })} />
      </MemoryRouter>,
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("a failed sign-out says so, where the name was", () => {
    renderMenu(true, vi.fn(), "/", account({ user: lilit, signOutFailed: true }));

    expect(screen.getByRole("alert").textContent).toBe("Couldn’t sign out. Try again.");
    expect(screen.queryByText("Lilit Harutyunyan")).toBeNull();
  });
});

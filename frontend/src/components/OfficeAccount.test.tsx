// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

import type { Account } from "@/components/account";
import { OfficeAccount } from "@/components/OfficeAccount";
import type { AuthUser } from "@/types/api";

const ani: AuthUser = {
  id: "user-2",
  email: "ani@example.com",
  name: "Ani Sargsyan",
  phone: null,
  role: "OWNER",
};

/** Ani signed in, unless the test says otherwise. */
function account(changes: Partial<Account> = {}): Account {
  return { user: ani, onSignOut: vi.fn(), signingOut: false, signOutFailed: false, ...changes };
}

afterEach(cleanup);

test.each([
  ["while the app is still checking", undefined],
  ["with nobody signed in", null],
])("%s, it shows nothing", (_when, user) => {
  const { container } = render(<OfficeAccount account={account({ user })} />);

  expect(container.innerHTML).toBe("");
});

test("it shows the person's initial and name, and Sign out", () => {
  render(<OfficeAccount account={account()} />);

  // The name is there too, so the initial is only decoration.
  expect(screen.getByText("A").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Ani Sargsyan").textContent).toBe("Signed in as Ani Sargsyan");
  expect(screen.getByText("Signed in as").className).toContain("sr-only");
  expect(screen.getByRole("button", { name: "Sign out" })).toBeDefined();
});

test("Sign out asks to sign out", async () => {
  const shown = account();
  render(<OfficeAccount account={shown} />);

  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

  expect(shown.onSignOut).toHaveBeenCalledOnce();
});

test("while signing out, Sign out says it's busy and ignores more clicks", async () => {
  const shown = account({ signingOut: true });
  render(<OfficeAccount account={shown} />);
  const button = screen.getByRole("button", { name: "Sign out" });

  await userEvent.click(button);

  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(shown.onSignOut).not.toHaveBeenCalled();
});

test("a failed sign-out says so, and Sign out stays to try again", () => {
  render(<OfficeAccount account={account({ signOutFailed: true })} />);

  expect(screen.getByRole("alert").textContent).toBe("Couldn’t sign out");
  expect(screen.getByRole("button", { name: "Sign out" }).getAttribute("aria-busy")).toBeNull();
});

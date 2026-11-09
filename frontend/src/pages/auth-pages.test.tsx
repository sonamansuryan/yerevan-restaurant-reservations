// @vitest-environment jsdom
// Sign in and Create an account, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { routes } from "@/router";
import type { AuthUser } from "@/types/api";

type TestRouter = ReturnType<typeof createMemoryRouter>;

const lilit: AuthUser = {
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};

beforeEach(() => {
  // jsdom has no scrollTo(), which ScrollRestoration calls.
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const refusal = (status: number, code: string, message: string): Response =>
  json({ error: { code, message } }, status);

/**
 * Answers like our API. Nobody is signed in until a sign-in or sign-up works, and the session can't
 * be renewed. "refuses" makes sign-in say the password is wrong, and sign-up that the email is taken.
 */
function fakeApi(outcome: "works" | "refuses"): Mock {
  let signedIn: AuthUser | null = null;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me") {
      return Promise.resolve(
        signedIn ? json({ user: signedIn }) : refusal(401, "UNAUTHORIZED", "Please sign in."),
      );
    }
    if (url === "/api/auth/refresh") {
      return Promise.resolve(refusal(401, "SESSION_EXPIRED", "Your session has ended."));
    }
    if (url === "/api/health") return Promise.resolve(json({ status: "ok" }));
    if (url === "/api/auth/login") {
      if (outcome === "refuses") {
        return Promise.resolve(
          refusal(401, "INVALID_CREDENTIALS", "Incorrect email or password. Please try again."),
        );
      }
      signedIn = lilit;
      return Promise.resolve(json({ user: signedIn }));
    }
    if (url === "/api/auth/register") {
      if (outcome === "refuses") {
        return Promise.resolve(
          refusal(409, "EMAIL_TAKEN", "There’s already an account with this email."),
        );
      }
      const { name, email, role } = JSON.parse(String(init?.body)) as AuthUser;
      signedIn = { ...lilit, name, email, role };
      return Promise.resolve(json({ user: signedIn }, 201));
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function renderAt(path: string): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const main = (): ReturnType<typeof within> => within(screen.getByRole("main"));
const header = (): ReturnType<typeof within> => within(screen.getByRole("banner"));

async function signIn(): Promise<void> {
  await userEvent.type(await main().findByLabelText("Email"), "Lilit@Example.com");
  await userEvent.type(main().getByLabelText("Password"), "a long password");
  await userEvent.click(main().getByRole("button", { name: "Sign in" }));
}

async function createAccount(): Promise<void> {
  await userEvent.type(await main().findByLabelText("Your name"), "Ani Sargsyan");
  await userEvent.type(main().getByLabelText("Email"), "ani@example.com");
  await userEvent.type(main().getByLabelText("Password"), "a long password");
  await userEvent.click(main().getByRole("button", { name: "Create account" }));
}

test("signing in sends the details, puts the person in the header, and goes home", async () => {
  const fetch = fakeApi("works");
  const router = renderAt("/login");
  await waitFor(() => expect(document.title).toBe("Sign in · Seghan"));

  await signIn();

  expect(await header().findByRole("button", { name: "Sign out" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/");
  expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "lilit@example.com", password: "a long password" }),
  });
});

test("a wrong password keeps the page, and says so in the agreed words", async () => {
  fakeApi("refuses");
  const router = renderAt("/login");

  await signIn();

  expect((await main().findByRole("alert")).textContent).toBe(
    "Incorrect email or password. Please try again.",
  );
  expect(router.state.location.pathname).toBe("/login");
  expect(header().queryByRole("button", { name: "Sign out" })).toBeNull();
});

test("a restaurant's new account is sent as OWNER, and is signed in at once", async () => {
  const fetch = fakeApi("works");
  const router = renderAt("/register?role=owner");
  await waitFor(() => expect(document.title).toBe("Create an account · Seghan"));

  await createAccount();

  expect(await header().findByRole("button", { name: "Sign out" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/");
  const sent = fetch.mock.calls.find(([url]) => url === "/api/auth/register")?.[1] as RequestInit;
  expect(JSON.parse(String(sent.body))).toEqual({
    role: "OWNER",
    name: "Ani Sargsyan",
    email: "ani@example.com",
    password: "a long password",
  });
});

test("a taken email keeps the page, with a way to sign in instead", async () => {
  fakeApi("refuses");
  const router = renderAt("/register");

  await createAccount();

  expect((await main().findByRole("alert")).textContent).toBe(
    "There’s already an account with this email. Sign in instead",
  );
  expect(router.state.location.pathname).toBe("/register");
});

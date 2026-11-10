// @vitest-environment jsdom
// Sign in and Create an account, through the real routes, shell and hooks, with a fake API.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { returnPath, returnStateFor } from "@/features/auth/returnTo";
import { routes } from "@/router";
import type { AuthUser } from "@/types/api";

// Google's library, replaced by a button that hands the page a token straight away. Google's real
// script never loads. GoogleSignIn.test.tsx covers the button's other states.
vi.mock("@react-oauth/google", async () => {
  const { createElement } = await import("react");
  return {
    GoogleOAuthProvider: ({ children }: { children: ReactNode }): ReactNode => children,
    useGoogleOAuth: () => ({ scriptLoadedSuccessfully: true }),
    GoogleLogin: ({
      text,
      onSuccess,
    }: {
      text?: string;
      onSuccess: (answer: { credential: string }) => void;
    }): ReactNode =>
      createElement(
        "button",
        { type: "button", onClick: () => onSuccess({ credential: "header.payload.signature" }) },
        text === "signup_with" ? "Sign up with Google" : "Sign in with Google",
      ),
  };
});

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
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123456789012-fakeclientid.apps.googleusercontent.com");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const GOOGLE_EMAIL_TAKEN =
  "There’s already an account with this email. Sign in with your password instead.";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const refusal = (status: number, code: string, message: string): Response =>
  json({ error: { code, message } }, status);

/**
 * Answers like our API. Nobody is signed in until a sign-in or sign-up works, and the session can't
 * be renewed. "refuses" makes sign-in say the password is wrong, sign-up that the email is taken,
 * and Google sign-in that the Google account's email already has an account.
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
    if (url === "/api/auth/google") {
      if (outcome === "refuses") {
        return Promise.resolve(refusal(409, "GOOGLE_EMAIL_TAKEN", GOOGLE_EMAIL_TAKEN));
      }
      const { role = "CUSTOMER" } = JSON.parse(String(init?.body)) as Partial<AuthUser>;
      signedIn = { ...lilit, role };
      return Promise.resolve(json({ user: signedIn }, 201));
    }
    if (url === "/api/auth/logout") {
      signedIn = null;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return new Promise(() => {});
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** Opens the app at an address, with the state a guard would pass along, if any. */
function renderAt(entry: string | { pathname: string; state: unknown }): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const main = (): ReturnType<typeof within> => within(screen.getByRole("main"));
const header = (): ReturnType<typeof within> => within(screen.getByRole("banner"));
const alertTexts = (): (string | null)[] =>
  main()
    .getAllByRole("alert")
    .map((alert: HTMLElement) => alert.textContent);

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

test("a signed-out visitor to My reservations signs in, and is brought back there", async () => {
  fakeApi("works");
  const router = renderAt("/reservations");

  expect(await main().findByRole("heading", { level: 1, name: "Sign in" })).toBeDefined();
  await signIn();

  expect(await main().findByRole("heading", { level: 1, name: "My reservations" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/reservations");
});

test("switching to Create an account on the way there keeps the destination", async () => {
  fakeApi("works");
  const router = renderAt("/reservations");

  await userEvent.click(await main().findByRole("link", { name: "Create an account" }));
  await createAccount();

  expect(await main().findByRole("heading", { level: 1, name: "My reservations" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/reservations");
});

test("Sign in instead, offered when an email is taken, keeps the destination too", async () => {
  fakeApi("refuses");
  const state = returnStateFor({ pathname: "/reservations", search: "", hash: "" });
  const router = renderAt({ pathname: "/register", state });

  await createAccount();
  await userEvent.click(await main().findByRole("link", { name: "Sign in instead" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(returnPath(router.state.location.state)).toBe("/reservations");
});

test("signing out on My reservations goes home, not to Sign in", async () => {
  fakeApi("works");
  const router = renderAt("/reservations");
  await signIn();
  await main().findByRole("heading", { level: 1, name: "My reservations" });

  await userEvent.click(header().getByRole("button", { name: "Sign out" }));
  await header().findByRole("link", { name: "Sign in" });
  // Let any redirect still on its way arrive, so a wrong turn after home can't be missed.
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  // Someone who chose to sign out isn't sent to Sign in, as if their session had ended.
  expect(router.state.location.pathname).toBe("/");
  expect(router.state.location.state).toBeNull();
  expect(main().getByRole("heading", { level: 1 }).textContent).toBe("Seghan");
});

test("a guest who heads for the dashboard signs in, and is told it's for restaurants", async () => {
  fakeApi("works");
  const router = renderAt("/dashboard");

  await signIn();

  expect(
    await main().findByRole("heading", { level: 1, name: "This page is for restaurants" }),
  ).toBeDefined();
  expect(router.state.location.pathname).toBe("/dashboard");
});

test("signing in with Google sends Google's token, then goes home signed in", async () => {
  const fetch = fakeApi("works");
  const router = renderAt("/login");

  await userEvent.click(await main().findByRole("button", { name: "Sign in with Google" }));

  expect(await header().findByRole("button", { name: "Sign out" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/");
  expect(fetch).toHaveBeenCalledWith("/api/auth/google", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "header.payload.signature" }),
  });
});

test("Create an account sends the role chosen in the form along with Google's token", async () => {
  const fetch = fakeApi("works");
  renderAt("/register?role=owner");

  await userEvent.click(await main().findByRole("button", { name: "Sign up with Google" }));

  await header().findByRole("button", { name: "Sign out" });
  const sent = fetch.mock.calls.find(([url]) => url === "/api/auth/google")?.[1] as RequestInit;
  expect(JSON.parse(String(sent.body))).toEqual({
    credential: "header.payload.signature",
    role: "OWNER",
  });
});

test("changing the choice to a guest before using Google sends that instead", async () => {
  const fetch = fakeApi("works");
  renderAt("/register?role=owner");

  await userEvent.click(await main().findByRole("radio", { name: /A guest/ }));
  await userEvent.click(main().getByRole("button", { name: "Sign up with Google" }));

  await header().findByRole("button", { name: "Sign out" });
  const sent = fetch.mock.calls.find(([url]) => url === "/api/auth/google")?.[1] as RequestInit;
  expect(JSON.parse(String(sent.body))).toMatchObject({ role: "CUSTOMER" });
});

test("Google's refusal shows under its button, and the page stays", async () => {
  fakeApi("refuses");
  const router = renderAt("/login");

  await userEvent.click(await main().findByRole("button", { name: "Sign in with Google" }));

  const alert = await main().findByRole("alert");
  expect(alert.textContent).toBe(GOOGLE_EMAIL_TAKEN);
  expect(
    main().getByRole("button", { name: "Sign in with Google" }).compareDocumentPosition(alert),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(router.state.location.pathname).toBe("/login");
  expect(header().queryByRole("button", { name: "Sign out" })).toBeNull();
});

test("one message at a time: trying Google clears the form's old message", async () => {
  fakeApi("refuses");
  renderAt("/login");
  await signIn();
  await main().findByRole("alert");

  await userEvent.click(main().getByRole("button", { name: "Sign in with Google" }));

  await waitFor(() => expect(alertTexts()).toEqual([GOOGLE_EMAIL_TAKEN]));
});

test("one message at a time: sending the form clears Google's old message", async () => {
  fakeApi("refuses");
  renderAt("/register");
  await userEvent.click(await main().findByRole("button", { name: "Sign up with Google" }));
  await main().findByRole("alert");

  await createAccount();

  await waitFor(() =>
    expect(alertTexts()).toEqual(["There’s already an account with this email. Sign in instead"]),
  );
});

test("a signed-out visitor to My reservations signs in with Google, and comes back there", async () => {
  fakeApi("works");
  const router = renderAt("/reservations");

  await userEvent.click(await main().findByRole("button", { name: "Sign in with Google" }));

  expect(await main().findByRole("heading", { level: 1, name: "My reservations" })).toBeDefined();
  expect(router.state.location.pathname).toBe("/reservations");
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

import { GoogleSignIn } from "@/features/auth/components/GoogleSignIn";
import { ApiError } from "@/lib/api";

// Google's library, replaced: each test decides whether Google's script arrives, and what its
// button gives back. Google's real script never loads.
const google = vi.hoisted(() => ({
  script: "loads" as "loads" | "loading" | "fails",
  answer: {} as { credential?: string },
  buttons: [] as Record<string, unknown>[],
}));

interface FakeButtonProps {
  text?: string;
  onSuccess: (answer: { credential?: string }) => void;
  onError?: () => void;
}

vi.mock("@react-oauth/google", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    GoogleOAuthProvider({
      children,
      onScriptLoadError,
    }: {
      children: ReactNode;
      onScriptLoadError?: () => void;
    }): ReactNode {
      useEffect(() => {
        if (google.script === "fails") onScriptLoadError?.();
      }, [onScriptLoadError]);
      return children;
    },
    useGoogleOAuth: () => ({ scriptLoadedSuccessfully: google.script === "loads" }),
    // Like Google's library, it reports an answer without a token as an error.
    GoogleLogin(props: FakeButtonProps): ReactNode {
      google.buttons.push({ ...props });
      const answer = (): void => {
        if (google.answer.credential) props.onSuccess(google.answer);
        else props.onError?.();
      };
      const name = props.text === "signup_with" ? "Sign up with Google" : "Sign in with Google";
      return createElement("button", { type: "button", onClick: answer }, name);
    },
  };
});

const TOKEN = "header.payload.signature";
const NO_TOKEN = "We couldn’t sign you in with Google. Please try again.";

beforeEach(() => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "123456789012-fakeclientid.apps.googleusercontent.com");
  google.script = "loads";
  google.answer = { credential: TOKEN };
  google.buttons.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderGoogle(props: Partial<ComponentProps<typeof GoogleSignIn>> = {}): Mock {
  const onCredential = vi.fn();
  render(<GoogleSignIn text="signin_with" onCredential={onCredential} {...props} />);
  return onCredential;
}

const googleButton = (): HTMLElement => screen.getByRole("button", { name: "Sign in with Google" });

test("shows the divider, then Google's own button in its outline style", () => {
  renderGoogle();

  expect(screen.getByText("or")).toBeDefined();
  expect(googleButton()).toBeDefined();
  expect(google.buttons.at(-1)).toMatchObject({
    text: "signin_with",
    theme: "outline",
    size: "large",
    shape: "rectangular",
  });
});

test("on Create an account, Google's button says Sign up", () => {
  renderGoogle({ text: "signup_with" });

  expect(screen.getByRole("button", { name: "Sign up with Google" })).toBeDefined();
});

test("the token Google gives the page is passed on", async () => {
  const onCredential = renderGoogle();

  await userEvent.click(googleButton());

  expect(onCredential).toHaveBeenCalledOnce();
  expect(onCredential).toHaveBeenCalledWith(TOKEN);
});

test("without a Client ID, nothing shows: no divider and no button", () => {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "your-google-client-id");

  const { container } = render(<GoogleSignIn text="signin_with" onCredential={vi.fn()} />);

  expect(container.innerHTML).toBe("");
});

test("while Google's script loads, the divider shows and the button's space is kept", () => {
  google.script = "loading";
  renderGoogle();

  expect(screen.getByText("or")).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText("Google sign-in isn’t available right now.")).toBeNull();
  // The 40px space Google's button will take, so nothing below moves when it arrives.
  expect(screen.getByRole("status").parentElement?.className).toContain("h-10");
});

test("if Google's script can't load, the button's place says so", () => {
  google.script = "fails";
  renderGoogle();

  expect(screen.getByText("Google sign-in isn’t available right now.")).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

test("while the server checks, the button is hidden and the page says what's happening", () => {
  renderGoogle({ pending: true });

  expect(screen.getByRole("status").textContent).toBe("Signing in with Google…");
  expect(googleButton().closest(".invisible")).not.toBeNull();
});

test("on Create an account, it says Signing up", () => {
  renderGoogle({ text: "signup_with", pending: true });

  expect(screen.getByRole("status").textContent).toBe("Signing up with Google…");
});

test("the rest of the time, the status says nothing and the button can be used", () => {
  renderGoogle();

  expect(screen.getByRole("status").textContent).toBe("");
  expect(googleButton().closest(".invisible")).toBeNull();
});

test("the server's refusal shows under Google's button, in the server's words", () => {
  const taken = "There’s already an account with this email. Sign in with your password instead.";
  renderGoogle({ error: new ApiError(409, "GOOGLE_EMAIL_TAKEN", taken) });

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe(taken);
  expect(googleButton().compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test("a 400 has no field to show its message under, so the message shows here", () => {
  const fields = { credential: NO_TOKEN };
  renderGoogle({
    error: new ApiError(400, "VALIDATION_ERROR", "The request is invalid.", { fields }),
  });

  expect(screen.getByRole("alert").textContent).toBe(NO_TOKEN);
});

test("if Google answers without a token, nothing is sent and the page says so", async () => {
  google.answer = {};
  const onCredential = renderGoogle();

  await userEvent.click(googleButton());

  expect(screen.getByRole("alert").textContent).toBe(NO_TOKEN);
  expect(onCredential).not.toHaveBeenCalled();
});

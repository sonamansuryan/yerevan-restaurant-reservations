import { GoogleLogin, GoogleOAuthProvider, useGoogleOAuth } from "@react-oauth/google";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { FormNotice } from "@/components/FormNotice";
import { OrDivider } from "@/components/OrDivider";
import { Spinner } from "@/components/Spinner";
import { googleClientId } from "@/features/auth/google";
import { fieldMessages } from "@/features/auth/serverErrors";
import type { ApiError } from "@/lib/api";
import { cx } from "@/lib/cx";

/** Google's own words on its button. */
export type GoogleButtonText = "signin_with" | "signup_with";

/** Where Google's script is. Its button can only be drawn once the script has arrived. */
export type GoogleStatus = "loading" | "ready" | "unavailable";

interface GoogleSignInProps {
  /** "Sign in with Google" on Sign in, and "Sign up with Google" on Create an account. */
  text: GoogleButtonText;
  /** Receives the ID token that Google gives the page, to send to our server. */
  onCredential: (credential: string) => void;
  /** While our server checks the token. */
  pending?: boolean;
  /** What our server said, if it said no. */
  error?: ApiError | null;
}

// The server's words for the same problem (GOOGLE_TOKEN_INVALID).
const NO_TOKEN = "We couldn’t sign you in with Google. Please try again.";

/**
 * The "or" divider and Google's button, under the form on Sign in and Create an account. Google's
 * script loads only while this is on screen, so no other page runs it. Without a Client ID, none
 * of this shows, rather than a button that fails when it's clicked.
 */
export function GoogleSignIn(props: GoogleSignInProps): ReactElement | null {
  const clientId = googleClientId();
  const [scriptFailed, setScriptFailed] = useState(false);
  if (!clientId) return null;

  return (
    // In English, like the rest of Seghan, whatever the browser's language.
    <GoogleOAuthProvider
      clientId={clientId}
      locale="en"
      onScriptLoadError={() => setScriptFailed(true)}
    >
      <WithGoogleScript scriptFailed={scriptFailed} {...props} />
    </GoogleOAuthProvider>
  );
}

function WithGoogleScript({
  scriptFailed,
  ...props
}: GoogleSignInProps & { scriptFailed: boolean }): ReactElement {
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const status = scriptLoadedSuccessfully ? "ready" : scriptFailed ? "unavailable" : "loading";
  return <GoogleBlock status={status} {...props} />;
}

/**
 * What GoogleSignIn shows at each moment, given where Google's script is. It needs a
 * GoogleOAuthProvider around it. /design uses this to show every state.
 */
export function GoogleBlock({
  status,
  text,
  onCredential,
  pending = false,
  error = null,
}: GoogleSignInProps & { status: GoogleStatus }): ReactElement {
  const [slot, width] = useWidth<HTMLDivElement>();
  // Google's script ended without a token. It does that only when something went wrong at its end.
  const [noToken, setNoToken] = useState(false);

  // A 400 has no field to show its message under, so it goes here like any other refusal.
  const problem = error
    ? (Object.values(fieldMessages(error))[0] ?? error.message)
    : noToken
      ? NO_TOKEN
      : null;

  return (
    <div className="flex flex-col gap-6">
      <OrDivider />
      <div className="flex flex-col gap-4">
        {/* Google's button is 40px tall. Its space is kept from the start, so nothing jumps when
            the button arrives. */}
        <div ref={slot} className="relative h-10">
          {status === "ready" && (
            // Hidden but kept while our server checks, so it can't be clicked twice and comes
            // straight back if there's a problem.
            <div className={cx(pending && "invisible")}>
              <GoogleLogin
                text={text}
                theme="outline"
                size="large"
                shape="rectangular"
                logo_alignment="center"
                width={width}
                onSuccess={({ credential }) => {
                  setNoToken(!credential);
                  if (credential) onCredential(credential);
                }}
                onError={() => setNoToken(true)}
              />
            </div>
          )}
          {status === "unavailable" && (
            <p className="flex h-full items-center justify-center text-ui text-ink-secondary">
              Google sign-in isn’t available right now.
            </p>
          )}
          {/* Always there, even empty, so screen readers announce it when it fills in. */}
          <p
            role="status"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 text-ui text-ink-secondary"
          >
            {pending && (
              <>
                <Spinner label={null} />
                {text === "signup_with" ? "Signing up with Google…" : "Signing in with Google…"}
              </>
            )}
          </p>
        </div>
        {problem && <FormNotice tone="error">{problem}</FormNotice>}
      </div>
    </div>
  );
}

/**
 * An element's width in whole pixels, kept up to date. Google draws its button at a fixed width,
 * at most 400px, so it has to be told the space it has, and redrawn when that changes.
 */
function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number | undefined] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (space: number): void => {
      if (space > 0) setWidth(Math.min(400, Math.floor(space)));
    };

    // Measured straight away, before Google's script can arrive, so the button is drawn once, at
    // the right width. The observer then follows a turned phone or a resized window.
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

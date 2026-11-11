import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactElement, ReactNode } from "react";

import { GuestBookLines, RestaurantLines } from "@/features/auth/components/BookExtras";
import { GoogleBlock } from "@/features/auth/components/GoogleSignIn";
import {
  AccountCheckFailed,
  CheckingAccount,
  NotForThisAccount,
} from "@/features/auth/components/GuardStates";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { googleClientId } from "@/features/auth/google";
import { BookingScreens } from "@/features/design/components/BookingScreens";
import { BrowseScreens } from "@/features/design/components/BrowseScreens";
import { DashboardScreens } from "@/features/design/components/DashboardScreens";
import { HomeScreens } from "@/features/design/components/HomeScreens";
import { ReservationsScreens } from "@/features/design/components/ReservationsScreens";
import { RestaurantPageScreens } from "@/features/design/components/RestaurantPageScreens";
import { TablesAndBlocksScreens } from "@/features/design/components/TablesAndBlocksScreens";
import { Group, Section, Specimens } from "@/features/design/components/parts";
import { screenStates } from "@/features/design/tokens";
import { ApiError } from "@/lib/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};

// The server's answers, exactly as api.ts hands them to a form.
const wrongPassword = new ApiError(
  401,
  "INVALID_CREDENTIALS",
  "Incorrect email or password. Please try again.",
);
const tooManyTries = new ApiError(
  429,
  "TOO_MANY_REQUESTS",
  "Too many attempts. Please wait a minute and try again.",
);
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);
const emailTaken = new ApiError(409, "EMAIL_TAKEN", "There’s already an account with this email.");
const googleEmailTaken = new ApiError(
  409,
  "GOOGLE_EMAIL_TAKEN",
  "There’s already an account with this email. Sign in with your password instead.",
);
const googleEmailUnverified = new ApiError(
  403,
  "GOOGLE_EMAIL_UNVERIFIED",
  "Google hasn’t verified this email address yet. Please verify it with Google first.",
);
const googleTokenInvalid = new ApiError(
  401,
  "GOOGLE_TOKEN_INVALID",
  "We couldn’t sign you in with Google. Please try again.",
);

const typed = { email: "lilit@example.com", password: "a long password" };

// One specimen per state in tokens.ts. A missing one is a type error. The live one shows the
// whole right page, with Google's button when there's a Client ID.
const signIn = (google?: ReactNode): Record<StateOf<"signIn">, ReactElement> => ({
  "Ready (live)": <SignInForm onSubmit={ignore} google={google} />,
  "Field errors": (
    <SignInForm onSubmit={ignore} defaultValues={{ email: "lilit@" }} validateOnMount />
  ),
  Sending: <SignInForm onSubmit={ignore} defaultValues={typed} pending />,
  "Wrong email or password": (
    <SignInForm onSubmit={ignore} defaultValues={typed} error={wrongPassword} />
  ),
  "Too many tries": <SignInForm onSubmit={ignore} defaultValues={typed} error={tooManyTries} />,
  "No connection": <SignInForm onSubmit={ignore} defaultValues={typed} error={noConnection} />,
});

const filledIn = { name: "Ani Sargsyan", ...typed };

const signUp = (google?: ReactNode): Record<StateOf<"signUp">, ReactElement> => ({
  "A guest (live)": <SignUpForm defaultRole="CUSTOMER" onSubmit={ignore} google={google} />,
  "A restaurant": <SignUpForm defaultRole="OWNER" onSubmit={ignore} />,
  "Field errors": (
    <SignUpForm
      defaultRole="CUSTOMER"
      onSubmit={ignore}
      defaultValues={{ email: "ani@example", password: "short" }}
      validateOnMount
    />
  ),
  Sending: <SignUpForm defaultRole="CUSTOMER" onSubmit={ignore} defaultValues={filledIn} pending />,
  "Email taken": (
    <SignUpForm
      defaultRole="CUSTOMER"
      onSubmit={ignore}
      defaultValues={filledIn}
      error={emailTaken}
    />
  ),
});

const leftPage: Record<StateOf<"leftPage">, ReactElement> = {
  "A guest, before typing": <GuestBookLines name="" />,
  "A guest, with a name": <GuestBookLines name="Lilit Harutyunyan" />,
  "A long name": <GuestBookLines name="Հովհաննեսյանց Մկրտչյան-Շահումյան" />,
  "A restaurant": <RestaurantLines />,
};

// Google's part of the page, on Sign in. Google draws the button itself, so these need its script,
// which the GoogleOAuthProvider below loads once for the whole section.
const google: Record<StateOf<"google">, ReactElement> = {
  "Ready (live)": <GoogleBlock status="ready" text="signin_with" onCredential={ignore} />,
  Loading: <GoogleBlock status="loading" text="signin_with" onCredential={ignore} />,
  Sending: <GoogleBlock status="ready" text="signin_with" onCredential={ignore} pending />,
  "Email taken": (
    <GoogleBlock status="ready" text="signin_with" onCredential={ignore} error={googleEmailTaken} />
  ),
  "Email not verified": (
    <GoogleBlock
      status="ready"
      text="signin_with"
      onCredential={ignore}
      error={googleEmailUnverified}
    />
  ),
  "Couldn’t sign in": (
    <GoogleBlock
      status="ready"
      text="signin_with"
      onCredential={ignore}
      error={googleTokenInvalid}
    />
  ),
  "Google can’t load": (
    <GoogleBlock status="unavailable" text="signin_with" onCredential={ignore} />
  ),
};

// What a guarded page shows instead of itself. Each sits in a column, as on the page.
const guard: Record<StateOf<"guard">, ReactElement> = {
  // Centred, as on the page, where the dot is all there is.
  "Checking your account": (
    <div className="flex min-h-40 items-center justify-center">
      <CheckingAccount />
    </div>
  ),
  "Not for this account": (
    <div className="flex flex-col items-center gap-6">
      <NotForThisAccount title="This page is for restaurants" name="Lilit Harutyunyan" />
    </div>
  ),
  "Couldn’t check": <AccountCheckFailed onRetry={ignore} retrying={false} />,
};

export function ScreensSection(): ReactElement {
  const clientId = googleClientId();
  const googleButton = clientId ? (
    <GoogleBlock status="ready" text="signin_with" onCredential={ignore} />
  ) : undefined;
  const googleSignUp = clientId ? (
    <GoogleBlock status="ready" text="signup_with" onCredential={ignore} />
  ) : undefined;

  const groups = (
    <>
      <Group
        title="Sign in"
        note="The right page of /login. The live one includes Google's button, and its states are under Sign in with Google."
      >
        <Specimens specimens={signIn(googleButton)} rightPage />
      </Group>
      <Group
        title="Create an account"
        note="The right page of /register. Switching between guest and restaurant keeps what's typed."
      >
        <Specimens specimens={signUp(googleSignUp)} rightPage />
      </Group>
      <Group
        title="Create an account, the left page"
        note="Under the sentence. A guest's name is written into the book as it's typed, and a restaurant sees what its dashboard holds."
      >
        <Specimens specimens={leftPage} />
      </Group>
      <Group
        title="Sign in with Google"
        note="Under the main button on both pages. On Create an account it says Sign up with Google. Google draws the button itself, so only the space and words around it are ours. The live one opens Google's window, and sends nothing."
      >
        {clientId ? (
          <Specimens specimens={google} rightPage />
        ) : (
          <p className="text-ui text-ink-secondary">
            Google's button needs VITE_GOOGLE_CLIENT_ID in frontend/.env.
          </p>
        )}
      </Group>
      <Group
        title="Pages that need an account"
        note="What My reservations and the dashboard show instead of themselves. Someone signed out never sees these: they're sent to Sign in, and brought back afterwards."
      >
        <Specimens specimens={guard} />
      </Group>
      <HomeScreens />
      <BrowseScreens />
      <RestaurantPageScreens />
      <BookingScreens />
      <ReservationsScreens />
      <DashboardScreens />
      <TablesAndBlocksScreens />
    </>
  );

  return (
    <Section
      id="screens"
      title="Screens"
      intro="Each feature's screens in their key states, with sample data. The live ones check what you type, and send nothing. To see a whole page at any width, choose it under Responsive."
    >
      {clientId ? (
        // One script for the whole section, however many of Google's buttons it shows.
        <GoogleOAuthProvider clientId={clientId} locale="en">
          {groups}
        </GoogleOAuthProvider>
      ) : (
        groups
      )}
    </Section>
  );
}

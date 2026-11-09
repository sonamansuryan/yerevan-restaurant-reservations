import type { ReactElement } from "react";

import { GuestBookLines, RestaurantLines } from "@/features/auth/components/BookExtras";
import {
  AccountCheckFailed,
  CheckingAccount,
  NotForThisAccount,
} from "@/features/auth/components/GuardStates";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { Group, Section } from "@/features/design/components/parts";
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

const typed = { email: "lilit@example.com", password: "a long password" };

// One specimen per state in tokens.ts. A missing one is a type error.
const signIn: Record<StateOf<"signIn">, ReactElement> = {
  "Ready (live)": <SignInForm onSubmit={ignore} />,
  "Field errors": (
    <SignInForm onSubmit={ignore} defaultValues={{ email: "lilit@" }} validateOnMount />
  ),
  Sending: <SignInForm onSubmit={ignore} defaultValues={typed} pending />,
  "Wrong email or password": (
    <SignInForm onSubmit={ignore} defaultValues={typed} error={wrongPassword} />
  ),
  "Too many tries": <SignInForm onSubmit={ignore} defaultValues={typed} error={tooManyTries} />,
  "No connection": <SignInForm onSubmit={ignore} defaultValues={typed} error={noConnection} />,
};

const filledIn = { name: "Ani Sargsyan", ...typed };

const signUp: Record<StateOf<"signUp">, ReactElement> = {
  "A guest (live)": <SignUpForm defaultRole="CUSTOMER" onSubmit={ignore} />,
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
};

const leftPage: Record<StateOf<"leftPage">, ReactElement> = {
  "A guest, before typing": <GuestBookLines name="" />,
  "A guest, with a name": <GuestBookLines name="Lilit Harutyunyan" />,
  "A long name": <GuestBookLines name="Հովհաննեսյանց Մկրտչյան-Շահումյան" />,
  "A restaurant": <RestaurantLines />,
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

function Specimens({ specimens }: { specimens: Record<string, ReactElement> }): ReactElement {
  return (
    <div className="grid gap-x-16 gap-y-12 xl:grid-cols-2">
      {Object.entries(specimens).map(([label, specimen]) => (
        <div key={label} className="flex max-w-105 flex-col gap-4">
          <p className="text-caption text-ink-muted">{label}</p>
          {/* A state that isn't live stands for one moment, so it can't be clicked or reached
              with Tab. */}
          <div inert={!label.endsWith("(live)")}>{specimen}</div>
        </div>
      ))}
    </div>
  );
}

export function ScreensSection(): ReactElement {
  return (
    <Section
      id="screens"
      title="Screens"
      intro="Each feature's screens in their key states, with sample data. The live ones check what you type, and send nothing. To see a whole page at any width, choose it under Responsive."
    >
      <Group title="Sign in" note="The right page of /login.">
        <Specimens specimens={signIn} />
      </Group>
      <Group
        title="Create an account"
        note="The right page of /register. Switching between guest and restaurant keeps what's typed."
      >
        <Specimens specimens={signUp} />
      </Group>
      <Group
        title="Create an account, the left page"
        note="Under the sentence. A guest's name is written into the book as it's typed, and a restaurant sees what its dashboard holds."
      >
        <Specimens specimens={leftPage} />
      </Group>
      <Group
        title="Pages that need an account"
        note="What My reservations and the dashboard show instead of themselves. Someone signed out never sees these: they're sent to Sign in, and brought back afterwards."
      >
        <Specimens specimens={guard} />
      </Group>
    </Section>
  );
}

import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Spinner } from "@/components/Spinner";

// What a guarded page shows instead of itself. These hold only the content, so /design can show
// them as they are. RequireAuth sets each one in a page, with its title and heading.

/** While the app asks who's signed in: the breathing wine dot, and nothing decided yet. */
export function CheckingAccount(): ReactElement {
  return <Spinner label="Checking your account" />;
}

/**
 * Someone signed in, on a page for another kind of account. EmptyState keeps its protected look,
 * and only the words are passed in, as the error page does with ErrorState.
 */
export function NotForThisAccount({ title, name }: { title: string; name: string }): ReactElement {
  return (
    <>
      <EmptyState
        title={title}
        description={`You’re signed in as ${name}.`}
        className="w-full max-w-120"
      />
      <LinkButton to="/" variant="link">
        Back to home
      </LinkButton>
    </>
  );
}

/**
 * The server couldn't say who's signed in. Guessing either way would be wrong, so this asks again.
 * The description doesn't add "Please try again.": the button already says so.
 */
export function AccountCheckFailed({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}): ReactElement {
  return (
    <ErrorState
      title="Our apologies"
      description="We couldn’t check your account."
      onRetry={onRetry}
      retrying={retrying}
      className="w-full max-w-120"
    />
  );
}

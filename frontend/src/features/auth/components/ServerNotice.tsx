import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { fieldMessages } from "@/features/auth/serverErrors";
import type { ApiError } from "@/lib/api";

/**
 * The server's answer when it's about the whole form: a wrong password, too many tries, a taken
 * email, or no connection. The words are the agreed ones, sent by the server, or by api.ts when no
 * answer came. A problem with one field shows under that field instead.
 */
export function ServerNotice({ error }: { error: ApiError | null }): ReactElement | null {
  if (!error || Object.keys(fieldMessages(error)).length > 0) return null;

  return (
    <FormNotice tone="error">
      {error.message}
      {error.code === "EMAIL_TAKEN" && (
        <>
          {" "}
          <LinkButton variant="link" to="/login">
            Sign in instead
          </LinkButton>
        </>
      )}
    </FormNotice>
  );
}

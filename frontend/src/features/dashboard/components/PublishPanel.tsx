import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { FormPart } from "@/features/dashboard/components/FormPart";
import { PublishedBadge } from "@/features/dashboard/components/PublishedBadge";
import type { ApiError } from "@/lib/api";

interface PublishPanelProps {
  isPublished: boolean;
  /** Seghan has hidden it from guests. The owner's choice applies again once Seghan shows it. */
  hiddenBySeghan?: boolean;
  /** Asks for the other state: publishing a draft, or unpublishing a published restaurant. */
  onChange: (isPublished: boolean) => void;
  pending?: boolean;
  /** What the server said, such as "Add a table before you publish." (409 NOT_READY_TO_PUBLISH). */
  error?: ApiError | null;
  headingLevel?: 3 | 4;
}

/**
 * Whether guests can see the restaurant, and the one button that changes it. The server decides
 * whether it's ready, so its words explain what's missing.
 */
export function PublishPanel({
  isPublished,
  hiddenBySeghan = false,
  onChange,
  pending = false,
  error = null,
  headingLevel = 3,
}: PublishPanelProps): ReactElement {
  return (
    <FormPart title="Visibility" headingLevel={headingLevel} className="max-w-160">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1">
          <PublishedBadge isPublished={isPublished} hiddenBySeghan={hiddenBySeghan} />
          <p className="text-ui text-ink-secondary">
            {hiddenBySeghan
              ? "Seghan has hidden it, so guests can’t find or book it. Its bookings stay as they are. Your choice here applies again once Seghan shows it."
              : isPublished
                ? "Guests can find it and book a table."
                : "Only you can see it. To publish it, it needs a table and opening hours."}
          </p>
        </div>
        <Button variant="ghost" loading={pending} onClick={() => onChange(!isPublished)}>
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
      </div>
      {error && <FormNotice tone="error">{error.message}</FormNotice>}
    </FormPart>
  );
}

import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";

/** Said once, on a new restaurant's Information page: it's saved, and what comes next. */
export function JustAddedNotice({ restaurantId }: { restaurantId: string }): ReactElement {
  return (
    <FormNotice tone="success" className="max-w-160">
      Restaurant added. Next, set its opening hours.{" "}
      <LinkButton variant="link" to={`/dashboard/${restaurantId}/hours`}>
        Set opening hours
      </LinkButton>
    </FormNotice>
  );
}

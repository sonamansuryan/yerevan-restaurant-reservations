import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";

/** Whether guests can see a restaurant: Published, or a Draft only its owner sees. */
export function PublishedBadge({ isPublished }: { isPublished: boolean }): ReactElement {
  return isPublished ? (
    <Badge tone="success">Published</Badge>
  ) : (
    <Badge tone="neutral">Draft</Badge>
  );
}

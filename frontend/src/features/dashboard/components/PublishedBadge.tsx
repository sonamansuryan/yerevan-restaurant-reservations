import type { ReactElement } from "react";

import { Badge } from "@/components/Badge";

/**
 * Whether guests can see a restaurant: Published, or a Draft only its owner sees. Hidden by Seghan
 * wins over both, because then guests can't see it whatever the owner chooses.
 */
export function PublishedBadge({
  isPublished,
  hiddenBySeghan = false,
}: {
  isPublished: boolean;
  hiddenBySeghan?: boolean;
}): ReactElement {
  if (hiddenBySeghan) return <Badge tone="warning">Hidden by Seghan</Badge>;
  return isPublished ? (
    <Badge tone="success">Published</Badge>
  ) : (
    <Badge tone="neutral">Draft</Badge>
  );
}

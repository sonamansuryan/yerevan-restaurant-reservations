import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

/** The page's width and side margins. The header, content and footer share it, so they line up. */
export function PageContainer({ className, ...rest }: ComponentProps<"div">): ReactElement {
  return (
    <div
      {...rest}
      className={cx("mx-auto w-full max-w-page px-gutter-sm md:px-gutter", className)}
    />
  );
}

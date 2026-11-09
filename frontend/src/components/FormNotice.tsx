import type { ComponentProps, ReactElement } from "react";

import { cx } from "@/lib/cx";

interface FormNoticeProps extends ComponentProps<"div"> {
  tone?: "error" | "success";
}

/**
 * News about a whole form, such as a wrong password, rather than one field: a dot and words on a
 * soft tint, like Badge's note in the margin. An error is an alert, so screen readers say it at
 * once. Good news is a polite status. EmptyState and ErrorState stay out of this on purpose.
 */
export function FormNotice({
  tone = "error",
  className,
  children,
  ...rest
}: FormNoticeProps): ReactElement {
  return (
    <div
      {...rest}
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex gap-3 rounded-control px-4 py-3 text-ui text-ink",
        tone === "error" ? "bg-error-soft" : "bg-success-soft",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "mt-2 size-1.5 flex-none rounded-pill",
          tone === "error" ? "bg-error" : "bg-success",
        )}
      />
      <p>{children}</p>
    </div>
  );
}

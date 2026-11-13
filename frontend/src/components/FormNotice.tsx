import type { ComponentProps, ReactElement } from "react";

import { AlertIcon, CheckIcon } from "@/components/icons";
import { cx } from "@/lib/cx";

interface FormNoticeProps extends ComponentProps<"div"> {
  tone?: "error" | "success";
}

/**
 * News about a whole form, such as a wrong password, rather than one field: an icon and words on a
 * soft tint. The words carry the meaning, and the icon is only a cue. An error is an alert, so
 * screen readers say it at once. Good news is a polite status. EmptyState and ErrorState stay out
 * of this on purpose.
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
        "flex gap-2.5 rounded-hero px-4 py-3 text-ui text-ink",
        tone === "error" ? "bg-error-soft" : "bg-success-soft",
        className,
      )}
    >
      {tone === "error" ? (
        <AlertIcon className="mt-px flex-none text-error" />
      ) : (
        <CheckIcon strokeWidth="2.2" className="mt-px flex-none text-success" />
      )}
      <p>{children}</p>
    </div>
  );
}

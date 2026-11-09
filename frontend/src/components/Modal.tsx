import { useEffect, useId, useRef } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import { CloseIcon } from "@/components/icons";

interface ModalProps {
  open: boolean;
  /** Called however the modal is dismissed: Esc, the close button or a click on the backdrop. */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * The action buttons. List the safe choice first, as phones stack them in reverse. Without a
   * footer, a close button appears instead, so there's always a visible way out.
   */
  footer?: ReactNode;
}

/**
 * Built on the native <dialog>. showModal() gives us the hard parts for free: keyboard focus stays
 * inside, Esc closes it, the page behind can't be reached, and focus returns to the opener.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // The `open` attribute shows a dialog without any of that behavior, so React can't just set it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The backdrop belongs to the dialog element, and the content below fills it, so a press whose
  // target is the dialog itself landed on the backdrop. This uses mousedown, not click, because a
  // drag that starts in a text field and ends outside would otherwise close the modal.
  function handleMouseDown(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={handleMouseDown}
      className="modal-sheet m-auto w-[calc(100%-2rem)] max-w-120 rounded-card bg-surface-raised text-ink shadow-float max-md:mb-0 max-md:w-full max-md:max-w-full max-md:rounded-b-none"
    >
      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-logo">
            {title}
          </h2>
          {!footer && (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mt-2 -mr-2.5 grid size-touch flex-none place-items-center rounded-pill text-ink-muted transition-[background-color,color] hover:bg-fill-hover hover:text-ink"
            >
              <CloseIcon width="18" height="18" strokeWidth="1.6" />
            </button>
          )}
        </div>
        <div className="mt-3 text-body text-ink-secondary">{children}</div>
        {footer && (
          <div className="mt-8 flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end md:gap-6">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}

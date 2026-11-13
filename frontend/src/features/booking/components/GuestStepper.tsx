import { useId } from "react";
import type { ReactElement } from "react";

import { MinusIcon, PlusIcon } from "@/components/icons";
import { GUEST_COUNTS, guestsLabel } from "@/features/booking/booking";

interface GuestStepperProps {
  guests: number;
  onChange: (guests: number) => void;
}

const FEWEST = GUEST_COUNTS[0] ?? 1;
const MOST = GUEST_COUNTS.at(-1) ?? 20;

// A round button, 40px as in the export, and 44px wherever there's a touch screen.
const step =
  "grid size-10 place-items-center rounded-pill bg-fill-hover text-ink transition-[background-color,color] duration-button hover:bg-line-soft disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink-muted any-pointer-coarse:size-11";

/**
 * The party, as the export's booking panel asks for it: "Guests" on the left, and on the right a
 * pill with fewer and more around the number. One to twenty guests: a bigger group calls the
 * restaurant. The number is read out as it changes.
 */
export function GuestStepper({ guests, onChange }: GuestStepperProps): ReactElement {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <span id={labelId} className="text-ui font-semibold text-ink">
        Guests
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex items-center gap-1 rounded-pill border border-line p-1"
      >
        <button
          type="button"
          aria-label="Fewer guests"
          disabled={guests <= FEWEST}
          onClick={() => onChange(guests - 1)}
          className={step}
        >
          <MinusIcon width="18" height="18" />
        </button>
        <output aria-live="polite" className="min-w-18 text-center text-ui font-semibold">
          {guestsLabel(guests)}
        </output>
        <button
          type="button"
          aria-label="More guests"
          disabled={guests >= MOST}
          onClick={() => onChange(guests + 1)}
          className={step}
        >
          <PlusIcon width="18" height="18" />
        </button>
      </div>
    </div>
  );
}

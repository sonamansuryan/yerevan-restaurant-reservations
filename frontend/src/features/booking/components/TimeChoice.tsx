import { useId } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { SlotButton } from "@/components/SlotButton";
import { Spinner } from "@/components/Spinner";
import { coursesOf, guestsLabel } from "@/features/booking/booking";
import type { AvailabilityState } from "@/features/booking/components/BookingWidget";

interface TimeChoiceProps {
  availability: AvailabilityState;
  guests: number;
  chosen: string | null;
  onChoose: (time: string) => void;
}

/** The day's times, in courses. A time with no table free for the party is shown, but can't be chosen. */
export function TimeChoice({
  availability,
  guests,
  chosen,
  onChoose,
}: TimeChoiceProps): ReactElement {
  const labelId = useId();
  const { data, failed, retrying, onRetry } = availability;

  let times: ReactElement;
  if (failed) {
    times = (
      <div className="flex flex-wrap items-baseline gap-x-4">
        <p className="text-ui text-ink-secondary">We couldn’t load the times.</p>
        <Button variant="link" loading={retrying} onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (!data) {
    times = (
      <p role="status" className="flex items-center gap-3 text-ui text-ink-muted">
        <Spinner label={null} />
        Finding free tables
      </p>
    );
  } else if (data.slots.length === 0) {
    times = (
      <p className="text-ui text-ink-secondary">No times to book on this day. Try another date.</p>
    );
  } else {
    const full = data.slots.every((slot) => slot.tables.length === 0);
    times = (
      <>
        {coursesOf(data.slots).map(({ name, slots }) => (
          <div key={slots[0]?.startsAt}>
            {name && <p className="mb-2 text-eyebrow text-ink-muted uppercase">{name}</p>}
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => (
                <SlotButton
                  key={slot.startsAt}
                  selected={slot.starts === chosen}
                  disabled={slot.tables.length === 0}
                  onClick={() => onChoose(slot.starts)}
                >
                  {slot.starts}
                  {slot.tables.length === 0 && <span className="sr-only">, full</span>}
                </SlotButton>
              ))}
            </div>
          </div>
        ))}
        {full && (
          <p className="text-ui text-ink-secondary">
            No table for {guestsLabel(guests)} is free on this day. Try another date.
          </p>
        )}
      </>
    );
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-4">
      <p id={labelId} className="text-meta font-medium text-ink-secondary">
        Time
      </p>
      {times}
    </div>
  );
}

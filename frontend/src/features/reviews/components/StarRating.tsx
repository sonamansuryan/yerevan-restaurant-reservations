import { useId } from "react";
import type { ComponentProps, ReactElement } from "react";

import { FieldError } from "@/components/Field";
import { StarIcon } from "@/components/icons";
import { RATING_CHOICES } from "@/features/reviews/reviews";

interface StarRatingProps extends Omit<ComponentProps<"input">, "type" | "value"> {
  legend: string;
  /** The rating chosen so far, "1" to "5", so the stars up to it fill. */
  chosen: string | undefined;
  error?: string;
}

/**
 * A rating as five stars, as the export asks for it: the stars up to the one chosen fill in, and the
 * rating is said beside them in words, such as "4 of 5 · Very good". They're five real radios, kept
 * out of sight, so the arrow keys move between them and each is read out in words. The other props,
 * such as register("rating"), go to every radio, which is how a radio group works.
 */
export function StarRating({ legend, chosen, error, ...rest }: StarRatingProps): ReactElement {
  const errorId = useId();
  const stars = Number(chosen) || 0;
  const words = RATING_CHOICES.find((choice) => choice.value === chosen)?.label;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="flex min-w-0 flex-col">
      <legend className="mb-2 text-input font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => {
            const choice = RATING_CHOICES.find(({ value }) => value === String(star));
            return (
              <label
                key={star}
                className="grid size-11 cursor-pointer place-items-center rounded-card transition-[scale] duration-150 hover:scale-110 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent motion-reduce:hover:scale-100"
              >
                <input
                  {...rest}
                  type="radio"
                  value={String(star)}
                  aria-label={`${star} of 5, ${choice?.label ?? ""}`}
                  aria-invalid={error ? true : undefined}
                  className="sr-only"
                />
                {star <= stars ? (
                  <StarIcon width="26" height="26" className="text-star" />
                ) : (
                  <StarIcon
                    width="26"
                    height="26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="text-star"
                  />
                )}
              </label>
            );
          })}
        </div>
        {words && (
          <span aria-hidden="true" className="text-ui text-ink-secondary">
            {stars} of 5 · {words}
          </span>
        )}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </fieldset>
  );
}

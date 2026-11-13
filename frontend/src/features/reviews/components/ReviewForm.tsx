import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/Button";
import { ChoiceLines } from "@/components/ChoiceLines";
import { Textarea } from "@/components/Textarea";
import { ServerNotice } from "@/features/auth/components/ServerNotice";
import { useServerFieldErrors } from "@/features/auth/hooks/useServerFieldErrors";
import { RATING_CHOICES, reviewSchema, toNewReview } from "@/features/reviews/reviews";
import type { NewReview, ReviewFields, ReviewValues } from "@/features/reviews/reviews";
import type { ApiError } from "@/lib/api";

const REVIEW_FIELDS = ["rating", "comment"] as const;

interface ReviewFormProps {
  /** The visit in words, such as "Lori Smokehouse on Friday 6 November". */
  visit: string;
  /** True while the review is being sent. */
  sending?: boolean;
  /** Why the server refused it, or couldn't be reached. The form stays, with what was written. */
  error?: ApiError | null;
  onPost: (review: NewReview) => void;
  /** Closes the form without posting. */
  onClose: () => void;
  /** For /design: values to start with, and showing their problems at once. */
  defaultValues?: Partial<ReviewFields>;
  validateOnMount?: boolean;
}

/**
 * A guest's review of one visit: a rating in words, from Excellent to Poor, and their own words if
 * they want. Other guests see it with their first name, so the hint says so before they write.
 */
export function ReviewForm({
  visit,
  sending = false,
  error = null,
  onPost,
  onClose,
  defaultValues,
  validateOnMount = false,
}: ReviewFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors },
  } = useForm<ReviewFields, unknown, ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { comment: "", ...defaultValues },
  });

  useServerFieldErrors(error, setError, REVIEW_FIELDS);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onPost(toNewReview(values)))}
      className="flex flex-col gap-6"
    >
      <p>Your visit to {visit}.</p>
      <ServerNotice error={error} />
      <ChoiceLines
        legend="Your rating"
        options={RATING_CHOICES}
        error={errors.rating?.message}
        {...register("rating")}
      />
      <Textarea
        label="Your review"
        rows={4}
        hint={errors.comment ? undefined : "Optional. Other guests see it with your first name."}
        error={errors.comment?.message}
        {...register("comment")}
      />
      {/* As in the other questions: the safe choice first, as phones stack them in reverse. */}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end md:gap-6">
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <Button type="submit" loading={sending}>
          Post review
        </Button>
      </div>
    </form>
  );
}

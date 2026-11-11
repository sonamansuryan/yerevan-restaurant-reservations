import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";
import { cancelReasonSchema } from "@/features/dashboard/bookingChanges";
import type { CancelReasonFields } from "@/features/dashboard/bookingChanges";
import type { OwnerReservation } from "@/types/api";

interface CancelBookingFormProps {
  booking: OwnerReservation;
  /** Cancels it, with the reason, or none when it was left empty. */
  onSubmit: (reason: string | undefined) => void;
  /** Keeps the booking as it is. */
  onKeep: () => void;
}

/**
 * The question before a restaurant cancels a booking, with room for a reason. The guest sees the
 * reason in My reservations, so it's optional, short and kind.
 */
export function CancelBookingForm({
  booking,
  onSubmit,
  onKeep,
}: CancelBookingFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelReasonFields, unknown, { reason: string }>({
    resolver: zodResolver(cancelReasonSchema),
    defaultValues: { reason: "" },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(({ reason }) => onSubmit(reason || undefined))}
      className="flex flex-col gap-6"
    >
      <p>
        {booking.guest.name}’s table at {booking.starts} will be offered to other guests.
      </p>
      <Textarea
        label="Reason for the guest"
        rows={3}
        hint={errors.reason ? undefined : "Optional. They’ll see it in My reservations."}
        error={errors.reason?.message}
        {...register("reason")}
      />
      {/* As in the other questions: the safe choice first, as phones stack them in reverse. */}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end md:gap-6">
        <Button variant="ghost" onClick={onKeep}>
          Keep it
        </Button>
        <Button type="submit">Cancel booking</Button>
      </div>
    </form>
  );
}

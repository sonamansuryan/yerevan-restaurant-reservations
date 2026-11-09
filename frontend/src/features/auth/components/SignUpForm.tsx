import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button, LinkButton } from "@/components/Button";
import { ChoiceLines } from "@/components/ChoiceLines";
import { Input } from "@/components/Input";
import { PasswordField } from "@/components/PasswordField";
import { ServerNotice } from "@/features/auth/components/ServerNotice";
import { useServerFieldErrors } from "@/features/auth/hooks/useServerFieldErrors";
import { signUpSchema } from "@/features/auth/schemas";
import type { SignUpFields, SignUpRequest, SignUpRole } from "@/features/auth/schemas";
import type { ApiError } from "@/lib/api";

const FIELDS = ["role", "name", "email", "password"] as const;

const roles = [
  { value: "CUSTOMER", label: "A guest", note: "Book tables" },
  { value: "OWNER", label: "A restaurant", note: "Manage bookings" },
];

/** The two things the left page shows while someone fills in the form. */
export interface SignUpDraft {
  role: SignUpRole;
  name: string;
}

interface SignUpFormProps {
  defaultRole: SignUpRole;
  onSubmit: (request: SignUpRequest) => void;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** Hears the role and name as they change, so the left page can follow them. */
  onDraftChange?: (draft: SignUpDraft) => void;
  /** For /design: values to start with, and showing their problems at once. */
  defaultValues?: Partial<SignUpFields>;
  validateOnMount?: boolean;
}

/**
 * The sign-up form. Switching between guest and restaurant keeps everything typed so far. Like
 * the sign-in form, it checks the fields itself first and receives the server's state as props.
 */
export function SignUpForm({
  defaultRole,
  onSubmit,
  pending = false,
  error = null,
  onDraftChange,
  defaultValues,
  validateOnMount = false,
}: SignUpFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    control,
    formState: { errors },
  } = useForm<SignUpFields, unknown, SignUpRequest>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: defaultRole, name: "", email: "", password: "", ...defaultValues },
  });

  const role = useWatch({ control, name: "role" });
  const name = useWatch({ control, name: "name" });
  useEffect(() => {
    onDraftChange?.({ role, name });
  }, [role, name, onDraftChange]);

  useServerFieldErrors(error, setError, FIELDS);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  return (
    // noValidate: the browser's own bubbles would come before these messages, in its own words.
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <ServerNotice error={error} />
      <ChoiceLines
        legend="I’m joining as"
        options={roles}
        error={errors.role?.message}
        {...register("role")}
      />
      <Input
        label="Your name"
        autoComplete="name"
        // Only a guest's name goes on a booking. A problem takes the hint's place.
        hint={
          role === "CUSTOMER" && !errors.name ? "Restaurants see this on your booking." : undefined
        }
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordField
        label="Password"
        autoComplete="new-password"
        hint={errors.password ? undefined : "At least 8 characters."}
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Create account
      </Button>
      <p className="text-ui text-ink-secondary">
        Already have an account?{" "}
        <LinkButton variant="link" to="/login">
          Sign in
        </LinkButton>
      </p>
    </form>
  );
}

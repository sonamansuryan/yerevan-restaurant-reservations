import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router";

import { Button, LinkButton } from "@/components/Button";
import { StoreIcon } from "@/components/icons";
import { Input } from "@/components/Input";
import { PasswordField } from "@/components/PasswordField";
import { ServerNotice } from "@/features/auth/components/ServerNotice";
import { useServerFieldErrors } from "@/features/auth/hooks/useServerFieldErrors";
import { signInSchema } from "@/features/auth/schemas";
import type { SignInFields, SignInRequest } from "@/features/auth/schemas";
import type { ApiError } from "@/lib/api";

const FIELDS = ["email", "password"] as const;

interface SignInFormProps {
  onSubmit: (request: SignInRequest) => void;
  pending?: boolean;
  /** What the server said last, if it said no. */
  error?: ApiError | null;
  /** For /design: values to start with, and showing their problems at once. */
  defaultValues?: Partial<SignInFields>;
  validateOnMount?: boolean;
  /** Another way in, shown above the form: Google's button and the "or with email" divider. */
  google?: ReactNode;
}

/**
 * The sign-in form. It checks the fields itself first, so a problem shows at once, under its field,
 * and focus moves to the first one. It receives the server's state as props, so /design can show
 * every state without a server.
 */
export function SignInForm({
  onSubmit,
  pending = false,
  error = null,
  defaultValues,
  validateOnMount = false,
  google,
}: SignInFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors },
  } = useForm<SignInFields, unknown, SignInRequest>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", ...defaultValues },
  });

  useServerFieldErrors(error, setError, FIELDS);
  useEffect(() => {
    if (validateOnMount) void trigger();
  }, [validateOnMount, trigger]);

  // Where a guard sent this person from, if it did, passed on to Create an account so they still
  // come back after signing up.
  const { state: returnState } = useLocation();

  return (
    // Google's part sits outside the <form>, because it isn't part of what the form sends.
    <div className="flex flex-col gap-5">
      {google}
      {/* noValidate: the browser's own bubbles would come before these messages, in its own words. */}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <ServerNotice error={error} />
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" variant="accent" size="large" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>
      {/* As in the export: owners sign in here too, with the same form. */}
      <div className="flex items-center gap-3 rounded-hero border border-dashed border-line-strong p-4">
        <StoreIcon width="18" height="18" className="flex-none text-ink-secondary" />
        <p className="text-ui leading-copy text-ink-body">
          Restaurant owner? You sign in here too. New to Seghan?{" "}
          <LinkButton
            variant="link"
            to="/register?role=owner"
            state={returnState}
            className="min-h-0"
          >
            List your restaurant
          </LinkButton>
        </p>
      </div>
    </div>
  );
}

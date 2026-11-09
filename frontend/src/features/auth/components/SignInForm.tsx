import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";

import { Button, LinkButton } from "@/components/Button";
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

  return (
    // noValidate: the browser's own bubbles would come before these messages, in its own words.
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
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
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Sign in
      </Button>
      <p className="text-ui text-ink-secondary">
        New to Seghan?{" "}
        <LinkButton variant="link" to="/register">
          Create an account
        </LinkButton>
      </p>
    </form>
  );
}

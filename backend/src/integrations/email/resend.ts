// Email through Resend. This is the only code that talks to Resend, so tests replace it.
import { Resend } from "resend";

import { env } from "../../config/env.ts";

const resend = new Resend(env.RESEND_API_KEY);

/** How long Resend gets to answer before the email counts as not sent. */
export const SEND_TIMEOUT_MS = 10_000;

/** One email: the same words as HTML, and as plain text for mail apps that don't show HTML. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Resend refused the email, such as for a bad sender address or a used-up quota. */
export class EmailNotSentError extends Error {
  /** Resend's own name for the problem, such as "validation_error". Never the address. */
  readonly code: string;

  constructor(code: string) {
    super(`Resend didn't send the email: ${code}`);
    this.name = "EmailNotSentError";
    this.code = code;
  }
}

/**
 * Sends one email from EMAIL_FROM. It throws if Resend refuses it, can't be reached, or takes
 * longer than SEND_TIMEOUT_MS. The key makes a repeat harmless: Resend sends one email per key
 * within a day, however often it's asked.
 */
export async function sendEmail(message: EmailMessage, idempotencyKey: string): Promise<void> {
  const { error } = await resend.emails.send(
    {
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    },
    { idempotencyKey, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
  if (error) throw new EmailNotSentError(error.name);
}

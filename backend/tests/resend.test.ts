// The one module that talks to Resend (src/integrations/email/resend.ts), with Resend's own package
// replaced: what it sends, and that a refusal or a network failure is thrown for the caller to log.
// Every other test replaces this module itself (tests/setup/outside-services.ts).
import { afterEach, expect, test, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());

vi.unmock("../src/integrations/email/resend.ts");
vi.mock("resend", () => ({
  Resend: vi.fn(function (this: unknown) {
    return { emails: { send: resendSend } };
  }),
}));

const { EmailNotSentError, SEND_TIMEOUT_MS, sendEmail } =
  await import("../src/integrations/email/resend.ts");

const message = {
  to: "lilit@example.com",
  subject: "Booking confirmed: Lori Smokehouse, Saturday 14 November",
  html: "<p>Hello Lilit,</p>",
  text: "Hello Lilit,",
};

afterEach(() => {
  resendSend.mockReset();
});

test("sends from EMAIL_FROM, with the key that makes a repeat harmless, and a time limit", async () => {
  resendSend.mockResolvedValue({ data: { id: "email-1" }, error: null, headers: null });

  await sendEmail(message, "confirmed/booking-1");

  expect(resendSend).toHaveBeenCalledWith(
    { from: "Test <test@example.com>", ...message },
    { idempotencyKey: "confirmed/booking-1", signal: expect.any(AbortSignal) },
  );
  expect(SEND_TIMEOUT_MS).toBe(10_000);
});

test("a refusal is thrown with Resend's own name for it, and never the address", async () => {
  resendSend.mockResolvedValue({
    data: null,
    error: { name: "validation_error", message: "Invalid `to` field", statusCode: 422 },
    headers: null,
  });

  const thrown = await sendEmail(message, "confirmed/booking-1").catch((error: unknown) => error);

  expect(thrown).toBeInstanceOf(EmailNotSentError);
  expect(thrown).toMatchObject({ name: "EmailNotSentError", code: "validation_error" });
  expect(String((thrown as Error).message)).not.toContain("lilit@example.com");
});

test("a network failure, or no answer in time, is thrown too", async () => {
  resendSend.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

  await expect(sendEmail(message, "confirmed/booking-1")).rejects.toThrow("timed out");
});

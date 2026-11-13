// The emails a guest gets about a booking (PROJECT_PLAN.md 9.3): when it's saved, confirmed or
// cancelled. Each goes out after the change is saved, in the background, so the guest's request
// never waits for Resend, and a failed email is logged without failing anything.
import { env } from "../../config/env.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { sendEmail } from "../../integrations/email/resend.ts";
import type { EmailMessage } from "../../integrations/email/resend.ts";
import { logger } from "../../lib/logger.ts";
import { prisma } from "../../lib/prisma.ts";
import { localClockTime, localDate } from "../../lib/time.ts";

/** What happened to the booking. Arrivals and no-shows send nothing. */
export type BookingEmail =
  "REQUESTED" | "CONFIRMED" | "CANCELLED_BY_GUEST" | "CANCELLED_BY_RESTAURANT";

/** The booking as an email shows it, on the restaurant's clock and calendar. */
export interface BookingDetails {
  guestName: string;
  restaurantName: string;
  restaurantAddress: string;
  /** YYYY-MM-DD, the day it starts on. */
  date: string;
  starts: string;
  ends: string;
  partySize: number;
  table: string;
  specialRequests: string | null;
  cancellationReason: string | null;
}

// The date is already the restaurant's own, so it's printed as it is, in UTC, with no zone math.
const dayName = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Saturday 14 November", and with the year added by hand, as the app writes dates. */
function dayWords(date: string, withYear: boolean): string {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  const words = dayName.format(new Date(Date.UTC(year, month - 1, day)));
  return withYear ? `${words} ${year}` : words;
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;
const guestsWords = (count: number): string => (count === 1 ? "1 guest" : `${count} guests`);
// One line, whatever an owner typed into the name: a line break can't reach the subject.
const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

interface Words {
  subject: string;
  heading: string;
  /** The opening lines, before the booking itself. */
  lines: string[];
  link: { label: string; path: string };
}

function wordsFor(email: BookingEmail, booking: BookingDetails): Words {
  const restaurant = oneLine(booking.restaurantName);
  const when = `${restaurant}, ${dayWords(booking.date, false)}`;
  const yourBookings = { label: "See your reservations", path: "/reservations" };
  const anotherTable = { label: "Find another table", path: "/restaurants" };

  switch (email) {
    case "REQUESTED":
      return {
        subject: `Booking requested: ${when}`,
        heading: "Your booking is requested",
        lines: [
          `We’ve sent your booking to ${restaurant}. We’ll email you again once they confirm it.`,
        ],
        link: yourBookings,
      };
    case "CONFIRMED":
      return {
        subject: `Booking confirmed: ${when}`,
        heading: "Your table is confirmed",
        lines: [`${restaurant} has confirmed your booking.`],
        link: yourBookings,
      };
    case "CANCELLED_BY_GUEST":
      return {
        subject: `Booking cancelled: ${when}`,
        heading: "Your booking is cancelled",
        lines: [`You cancelled your booking at ${restaurant}, so the table is free for others.`],
        link: anotherTable,
      };
    case "CANCELLED_BY_RESTAURANT":
      return {
        subject: `Booking cancelled: ${when}`,
        heading: "Your booking is cancelled",
        lines: [
          `${restaurant} cancelled your booking.`,
          ...(booking.cancellationReason ? [`Their reason: ${booking.cancellationReason}`] : []),
        ],
        link: anotherTable,
      };
  }
}

/** The booking itself, as label and value pairs, the same in both versions of the email. */
function detailLines(booking: BookingDetails): [string, string][] {
  return [
    ["Day", dayWords(booking.date, true)],
    ["Time", `${booking.starts} to ${booking.ends}`],
    ["Table", `${booking.table}, for ${guestsWords(booking.partySize)}`],
    ["Where", `${oneLine(booking.restaurantName)}, ${booking.restaurantAddress}`],
    ...(booking.specialRequests
      ? [["Your note", booking.specialRequests] as [string, string]]
      : []),
  ];
}

/**
 * One email about a booking, as HTML and plain text. Everything a person typed, such as names,
 * notes and reasons, is escaped in the HTML, so it can only ever show as text.
 */
export function bookingEmail(
  email: BookingEmail,
  booking: BookingDetails,
  appUrl: string = env.APP_URL,
): Omit<EmailMessage, "to"> {
  const words = wordsFor(email, booking);
  const greeting = `Hello ${firstName(booking.guestName)},`;
  const details = detailLines(booking);
  const linkUrl = new URL(words.link.path, appUrl).toString();

  const text = [
    greeting,
    ...words.lines,
    details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    `${words.link.label}: ${linkUrl}`,
    "Seghan\nRestaurant reservations across Yerevan.",
  ].join("\n\n");

  // Seghan's paper, ink and wine, with a serif heading. Inline styles, as mail apps need them.
  const serif = "Georgia, 'Times New Roman', serif";
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fbfaf7;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#17140f;">
      <p style="margin:0 0 32px;font-family:${serif};font-size:24px;">seghan<span style="color:#7a1e2c;">.</span></p>
      <h1 style="margin:0 0 16px;font-family:${serif};font-size:28px;font-weight:normal;line-height:1.2;">${escapeHtml(words.heading)}</h1>
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      ${words.lines.map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`).join("\n      ")}
      <table role="presentation" style="width:100%;margin:24px 0;border-collapse:collapse;border-top:1px solid #e4dfd6;">
        ${details
          .map(
            ([label, value]) =>
              `<tr><td style="padding:10px 16px 10px 0;border-bottom:1px solid #e4dfd6;color:#6f6a60;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:10px 0;border-bottom:1px solid #e4dfd6;vertical-align:top;">${escapeHtml(value)}</td></tr>`,
          )
          .join("\n        ")}
      </table>
      <p style="margin:0 0 32px;"><a href="${escapeHtml(linkUrl)}" style="color:#7a1e2c;">${escapeHtml(words.link.label)}</a></p>
      <p style="margin:0;font-size:13px;color:#6f6a60;">Seghan · Restaurant reservations across Yerevan.</p>
    </div>
  </body>
</html>`;

  return { subject: words.subject, html, text };
}

const emailFields = {
  partySize: true,
  startsAt: true,
  endsAt: true,
  specialRequests: true,
  cancellationReason: true,
  user: { select: { name: true, email: true } },
  restaurant: { select: { name: true, address: true, timezone: true } },
  table: { select: { label: true } },
} satisfies Prisma.ReservationSelect;

/** Reads the booking as it is now, and sends the guest the email about what just happened. */
export async function sendBookingEmail(email: BookingEmail, reservationId: string): Promise<void> {
  const row = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: emailFields,
  });
  // Bookings are never deleted, so this can't happen. If it ever does, there's no one to tell.
  if (!row) return;

  const timeZone = row.restaurant.timezone;
  const message = bookingEmail(email, {
    guestName: row.user.name,
    restaurantName: row.restaurant.name,
    restaurantAddress: row.restaurant.address,
    date: localDate(row.startsAt, timeZone),
    starts: localClockTime(row.startsAt, timeZone),
    ends: localClockTime(row.endsAt, timeZone),
    partySize: row.partySize,
    table: row.table.label,
    specialRequests: row.specialRequests,
    cancellationReason: row.cancellationReason,
  });
  // One email per booking and event, even if this ever runs twice.
  await sendEmail({ to: row.user.email, ...message }, `${email.toLowerCase()}/${reservationId}`);
  logger.info({ kind: email, reservationId }, "Booking email sent");
}

/**
 * Emails the guest about a change to their booking that has just been saved. It returns at once:
 * the email goes out in the background, and a failure is only logged (general-rules.md: emails go
 * out after the commit, and a failed one never fails the request). The log names the booking and
 * the kind of email, never the address.
 */
export function emailGuest(email: BookingEmail, reservationId: string): void {
  void sendBookingEmail(email, reservationId).catch((err: unknown) => {
    logger.warn({ err, kind: email, reservationId }, "Booking email not sent");
  });
}

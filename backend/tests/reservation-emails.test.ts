// The emails a guest gets about a booking (src/modules/reservations/reservation-emails.ts): what
// each one says, that everything typed is escaped, and that sending happens in the background and
// can only ever be logged, never thrown. Resend itself is replaced (tests/setup/outside-services.ts),
// and so is Prisma here. tests/db/emails.test.ts sends them after real bookings on PostgreSQL.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { sendEmail } from "../src/integrations/email/resend.ts";
import { EmailNotSentError } from "../src/integrations/email/resend.ts";
import { logger } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  bookingEmail,
  emailGuest,
  sendBookingEmail,
} from "../src/modules/reservations/reservation-emails.ts";
import type { BookingDetails } from "../src/modules/reservations/reservation-emails.ts";

vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { reservation: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));

const send = vi.mocked(sendEmail);
const findBooking = vi.mocked(prisma.reservation.findUnique);
const ID = "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a";
const APP = "https://seghan.example";

const lilitsBooking: BookingDetails = {
  guestName: "Lilit Harutyunyan",
  restaurantName: "Lori Smokehouse",
  restaurantAddress: "52 Komitas Avenue, Yerevan",
  date: "2026-11-14",
  starts: "19:00",
  ends: "21:00",
  partySize: 2,
  table: "T2",
  specialRequests: "A table by the window, please.",
  cancellationReason: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("what each email says", () => {
  test("requested: the restaurant has it, and the guest will hear again once it's confirmed", () => {
    const { subject, text } = bookingEmail("REQUESTED", lilitsBooking, APP);

    expect(subject).toBe("Booking requested: Lori Smokehouse, Saturday 14 November");
    expect(text).toBe(
      [
        "Hello Lilit,",
        "We’ve sent your booking to Lori Smokehouse. We’ll email you again once they confirm it.",
        [
          "Day: Saturday 14 November 2026",
          "Time: 19:00 to 21:00",
          "Table: T2, for 2 guests",
          "Where: Lori Smokehouse, 52 Komitas Avenue, Yerevan",
          "Your note: A table by the window, please.",
        ].join("\n"),
        "See your reservations: https://seghan.example/reservations",
        "Seghan\nRestaurant reservations across Yerevan.",
      ].join("\n\n"),
    );
  });

  test("confirmed", () => {
    const { subject, html, text } = bookingEmail("CONFIRMED", lilitsBooking, APP);

    expect(subject).toBe("Booking confirmed: Lori Smokehouse, Saturday 14 November");
    expect(text).toContain("Lori Smokehouse has confirmed your booking.");
    expect(html).toContain(">Your table is confirmed</h1>");
    expect(html).toContain('href="https://seghan.example/reservations"');
  });

  test("cancelled by the guest: the way to another table", () => {
    const { subject, text } = bookingEmail("CANCELLED_BY_GUEST", lilitsBooking, APP);

    expect(subject).toBe("Booking cancelled: Lori Smokehouse, Saturday 14 November");
    expect(text).toContain(
      "You cancelled your booking at Lori Smokehouse, so the table is free for others.",
    );
    expect(text).toContain("Find another table: https://seghan.example/restaurants");
  });

  test("cancelled by the restaurant, with its reason when it gave one", () => {
    const withReason = bookingEmail(
      "CANCELLED_BY_RESTAURANT",
      { ...lilitsBooking, cancellationReason: "We’re closed for a private event that night." },
      APP,
    );
    const without = bookingEmail("CANCELLED_BY_RESTAURANT", lilitsBooking, APP);

    expect(withReason.text).toContain(
      "Lori Smokehouse cancelled your booking.\n\nTheir reason: We’re closed for a private event that night.",
    );
    expect(without.text).toContain("Lori Smokehouse cancelled your booking.");
    expect(without.text).not.toContain("Their reason");
  });

  test("one guest, no note, and a booking from another year", () => {
    const { text } = bookingEmail(
      "CONFIRMED",
      { ...lilitsBooking, partySize: 1, specialRequests: null, date: "2027-01-02" },
      APP,
    );

    expect(text).toContain("Table: T2, for 1 guest");
    expect(text).toContain("Day: Saturday 2 January 2027");
    expect(text).not.toContain("Your note");
  });

  test("everything typed is only ever text in the HTML, and the subject stays one line", () => {
    const { subject, html } = bookingEmail(
      "CANCELLED_BY_RESTAURANT",
      {
        ...lilitsBooking,
        guestName: "<b>Lilit</b>",
        restaurantName: "Lori\nSmokehouse <img src=x onerror=alert(1)>",
        specialRequests: '"Window" & <script>alert(1)</script>',
        cancellationReason: "<a href='https://evil.example'>Click</a>",
      },
      APP,
    );

    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a href='https://evil.example'>");
    expect(html).toContain("&quot;Window&quot; &amp; &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Hello &lt;b&gt;Lilit&lt;/b&gt;,");
  });
});

describe("sending one", () => {
  const row = {
    partySize: 2,
    // 23:30 to 01:30 in Yerevan: the day is the evening it starts, on the restaurant's calendar.
    startsAt: new Date("2026-11-14T19:30:00.000Z"),
    endsAt: new Date("2026-11-14T21:30:00.000Z"),
    specialRequests: null,
    cancellationReason: null,
    user: { name: "Lilit Harutyunyan", email: "lilit@example.com" },
    restaurant: {
      name: "Tsiran Wine Room",
      address: "31 Saryan Street, Yerevan",
      timezone: "Asia/Yerevan",
    },
    table: { label: "B1" },
  };

  beforeEach(() => {
    findBooking.mockResolvedValue(row as never);
  });

  test("the guest gets it at their own address, on the restaurant's clock, once per booking and kind", async () => {
    await sendBookingEmail("CONFIRMED", ID);

    expect(findBooking).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
    expect(send).toHaveBeenCalledTimes(1);
    const [message, key] = send.mock.calls[0]!;
    expect(message.to).toBe("lilit@example.com");
    expect(message.subject).toBe("Booking confirmed: Tsiran Wine Room, Saturday 14 November");
    expect(message.text).toContain("Time: 23:30 to 01:30");
    expect(key).toBe(`confirmed/${ID}`);
  });

  test("the outside service is replaced in every test, so none can send a real email", () => {
    expect(vi.isMockFunction(sendEmail)).toBe(true);
  });
});

describe("emailGuest, after a change is saved", () => {
  beforeEach(() => {
    findBooking.mockResolvedValue({
      partySize: 2,
      startsAt: new Date("2026-11-14T15:00:00.000Z"),
      endsAt: new Date("2026-11-14T17:00:00.000Z"),
      specialRequests: null,
      cancellationReason: null,
      user: { name: "Lilit Harutyunyan", email: "lilit@example.com" },
      restaurant: {
        name: "Lori Smokehouse",
        address: "52 Komitas Avenue, Yerevan",
        timezone: "Asia/Yerevan",
      },
      table: { label: "T2" },
    } as never);
  });

  test("returns at once: the email goes out in the background", async () => {
    // Resend never answers.
    send.mockReturnValue(new Promise(() => {}));

    expect(emailGuest("REQUESTED", ID)).toBeUndefined();

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  test("a refused email is logged by kind and booking, without the address, and never thrown", async () => {
    const warn = vi.spyOn(logger, "warn");
    send.mockRejectedValue(new EmailNotSentError("validation_error"));

    emailGuest("CANCELLED_BY_GUEST", ID);

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    const [fields, message] = warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(message).toBe("Booking email not sent");
    expect(fields).toMatchObject({ kind: "CANCELLED_BY_GUEST", reservationId: ID });
    expect(fields["err"]).toBeInstanceOf(EmailNotSentError);
    expect(JSON.stringify(fields)).not.toContain("lilit@example.com");
  });

  test("so is a failure to read the booking", async () => {
    const warn = vi.spyOn(logger, "warn");
    findBooking.mockRejectedValue(new Error("connection lost"));

    emailGuest("CONFIRMED", ID);

    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(send).not.toHaveBeenCalled();
  });
});

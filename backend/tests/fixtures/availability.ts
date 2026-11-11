// What GET /api/restaurants/:slug/availability returns, for tests that replace the service.
import type { Availability } from "../../src/modules/availability/availability.service.ts";

/** Lori Smokehouse on the demo Saturday, for two: T1 is booked at 19:00 and free again at 21:00. */
export const availabilityReply: Availability = {
  date: "2026-11-14",
  partySize: 2,
  bookingWindow: { first: "2026-11-11", last: "2027-01-10" },
  slots: [
    {
      startsAt: "2026-11-14T15:00:00.000Z",
      endsAt: "2026-11-14T17:00:00.000Z",
      starts: "19:00",
      ends: "21:00",
      tables: [
        { id: "5e4d3c2b-1a09-4f87-8654-3210fedcba98", label: "T2", zone: "INDOOR", capacity: 4 },
        { id: "9a897867-5645-4b43-8a98-76543210fedc", label: "P1", zone: "TERRACE", capacity: 4 },
      ],
    },
    {
      startsAt: "2026-11-14T17:00:00.000Z",
      endsAt: "2026-11-14T19:00:00.000Z",
      starts: "21:00",
      ends: "23:00",
      tables: [
        { id: "4f3e2d1c-0b9a-4876-9543-210fedcba987", label: "T1", zone: "INDOOR", capacity: 4 },
      ],
    },
  ],
};

// The public demo (PROJECT_PLAN.md 10.2), with PUBLIC_DEMO on: the photos can't be changed, so no
// visitor can put files in Seghan's Cloudinary account, and no email ever reaches Resend. With it
// off, as locally, photos.test.ts and resend.test.ts test the same code.
import request from "supertest";
import type { Response } from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { sendEmail } from "../src/integrations/email/resend.ts";
import { logger } from "../src/lib/logger.ts";
import { prisma } from "../src/lib/prisma.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import {
  deletePhoto,
  getPhotos,
  makeCover,
  permitUpload,
  savePhoto,
} from "../src/modules/photos/photos.service.ts";
import { sendBookingEmail } from "../src/modules/reservations/reservation-emails.ts";
import { ownedRow } from "./fixtures/restaurants.ts";
import { ani } from "./fixtures/users.ts";

// vi.hoisted runs before the imports above, so env.ts reads the switch when the app loads.
const resendSend = vi.hoisted(() => {
  vi.stubEnv("PUBLIC_DEMO", "true");
  return vi.fn();
});

// The real email module this time, with Resend's own package replaced, so any send would show.
vi.unmock("../src/integrations/email/resend.ts");
vi.mock("resend", () => ({
  Resend: vi.fn(function (this: unknown) {
    return { emails: { send: resendSend } };
  }),
}));
// The ownership check asks the database whether the restaurant is the owner's: here only Ani's is.
// A booking's email reads the booking from it too.
vi.mock("../src/lib/prisma.ts", () => ({
  prisma: { restaurant: { findUnique: vi.fn() }, reservation: { findUnique: vi.fn() } },
  isDatabaseReachable: vi.fn(),
}));
vi.mock("../src/modules/photos/photos.service.ts", () => ({
  getPhotos: vi.fn(),
  permitUpload: vi.fn(),
  savePhoto: vi.fn(),
  makeCover: vi.fn(),
  deletePhoto: vi.fn(),
}));

const ANIS = ownedRow().id;
const DAVITS = "e5b8a7c6-9f0d-4e1b-8c23-4d5e6f708192";
const PHOTO = "0f9c1d2e-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const photos = (restaurantId: string): string => `/api/owner/restaurants/${restaurantId}/photos`;

// The four photo changes, each with what the input check would accept.
const changes = [
  ["post", "/signature", undefined],
  [
    "post",
    "",
    {
      publicId: `seghan/restaurants/${ANIS}/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d`,
      version: 1731240000,
      signature: "a".repeat(40),
    },
  ],
  ["patch", `/${PHOTO}`, { isCover: true }],
  ["delete", `/${PHOTO}`, undefined],
] as const;

beforeEach(() => {
  vi.mocked(prisma.restaurant.findUnique).mockImplementation((({
    where,
  }: {
    where: { id: string; ownerId: string };
  }) =>
    Promise.resolve(where.id === ANIS && where.ownerId === ani.id ? { id: ANIS } : null)) as never);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

async function call(
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: object,
  user?: SessionUser,
): Promise<Response> {
  let req = request(app)[method](path);
  if (user) req = req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return body ? req.send(body) : req;
}

describe("photos in the public demo", () => {
  test("each of the four changes answers 403 DEMO_READ_ONLY, and none reaches the service", async () => {
    for (const [method, path, body] of changes) {
      const reply = await call(method, `${photos(ANIS)}${path}`, body, ani);

      expect(reply.status).toBe(403);
      expect(reply.body).toEqual({
        error: { code: "DEMO_READ_ONLY", message: "Photos can’t be changed in the demo." },
      });
    }
    expect(permitUpload).not.toHaveBeenCalled();
    expect(savePhoto).not.toHaveBeenCalled();
    expect(makeCover).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  test("nothing about a change is checked first: a broken one gets the same 403, not a 400", async () => {
    const reply = await call("post", photos(ANIS), { publicId: "not one of ours" }, ani);

    expect(reply.status).toBe(403);
    expect(reply.body.error.code).toBe("DEMO_READ_ONLY");
  });

  test("the photos can still be read, and the answer says they're read-only", async () => {
    const cover = {
      id: PHOTO,
      url: "https://res.cloudinary.com/test-cloud/image/upload/v1731240000/seghan/cover",
      isCover: true,
      sortOrder: 0,
    };
    vi.mocked(getPhotos).mockResolvedValue([cover]);

    const reply = await call("get", photos(ANIS), undefined, ani);

    expect(reply.status).toBe(200);
    // So the photo manager offers no changes (10.3), instead of offering ones that answer 403.
    expect(reply.body).toEqual({ photos: [cover], readOnly: true });
  });

  test("the checks before it come first: someone else's restaurant is a 404, signed out a 401", async () => {
    for (const [method, path, body] of changes) {
      const theirs = await call(method, `${photos(DAVITS)}${path}`, body, ani);
      expect(theirs.status).toBe(404);
      expect(theirs.body.error.code).toBe("RESTAURANT_NOT_FOUND");

      expect((await call(method, `${photos(ANIS)}${path}`, body)).status).toBe(401);
    }
  });
});

describe("email in the public demo", () => {
  const BOOKING = "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a";

  test("sendEmail answers false and never calls Resend", async () => {
    const sent = await sendEmail(
      { to: "lilit@example.com", subject: "Booking confirmed", html: "<p>Hi</p>", text: "Hi" },
      `confirmed/${BOOKING}`,
    );

    expect(sent).toBe(false);
    expect(resendSend).not.toHaveBeenCalled();
  });

  test("a booking's email is skipped, logged as skipped, and never reaches Resend", async () => {
    vi.mocked(prisma.reservation.findUnique).mockResolvedValue({
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
    const info = vi.spyOn(logger, "info");

    await sendBookingEmail("CONFIRMED", BOOKING);

    expect(resendSend).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      { kind: "CONFIRMED", reservationId: BOOKING },
      "Booking email skipped: the public demo sends none",
    );
  });
});

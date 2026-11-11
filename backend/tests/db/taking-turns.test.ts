// Database tests 6 and 8 (PROJECT_PLAN.md §5.4), on real PostgreSQL: changes that would break each
// other if they crossed take turns, because they lock the same rows in the same order. Each pair
// is sent at once through the API, and only one of the two can win. A race can play out
// differently each time, so each runs more than once. Run with: npm run test:db -w backend
import request from "supertest";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../src/app.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { addDays, localDate } from "../../src/lib/time.ts";
import { ACCESS_COOKIE } from "../../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../../src/modules/auth/token.service.ts";
import { addRestaurant, emptyTestDatabase } from "./test-database.ts";
import type { TestRestaurant } from "./test-database.ts";

// A week from today in Yerevan: always more than an hour away, and within the 60 days.
const DATE = addDays(localDate(new Date(), "Asia/Yerevan"), 7);
const ROUNDS = [1, 2, 3, 4];

let lori: TestRestaurant;

beforeEach(async () => {
  await emptyTestDatabase();
  lori = await addRestaurant();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const cookie = async (id: string, role: "CUSTOMER" | "OWNER"): Promise<string> =>
  `${ACCESS_COOKIE}=${await signAccessToken({ id, role })}`;

/** "201 done", or "409 TABLE_BLOCKED": what a request ended in. */
const outcome = ({ status, body }: request.Response): string =>
  `${status} ${(body as { error?: { code: string } }).error?.code ?? "done"}`;

describe("database test 6: a booking and a block made at the same moment never both succeed", () => {
  const blocks = {
    "a block on the table": () => ({
      tableId: lori.t1,
      from: `${DATE}T18:00`,
      to: `${DATE}T22:00`,
    }),
    "a block on the whole restaurant": () => ({ date: DATE }),
  };
  const cases = Object.keys(blocks).flatMap((kind) => ROUNDS.map((round) => [kind, round]));

  test.each(cases)("%s, round %i", async (kind) => {
    const [guest, owner] = await Promise.all([
      cookie(lori.guestId, "CUSTOMER"),
      cookie(lori.ownerId, "OWNER"),
    ]);

    const [booking, block] = await Promise.all([
      request(app)
        .post("/api/reservations")
        .set("Cookie", guest)
        .send({ tableId: lori.t1, date: DATE, time: "19:00", partySize: 2 }),
      request(app)
        .post(`/api/owner/restaurants/${lori.restaurantId}/blocks`)
        .set("Cookie", owner)
        .send(blocks[kind as keyof typeof blocks]()),
    ]);

    // Whichever goes second sees the first, and is refused with the reason.
    expect(["201 done / 409 BLOCK_HAS_BOOKINGS", "409 TABLE_BLOCKED / 201 done"]).toContain(
      `${outcome(booking)} / ${outcome(block)}`,
    );
    const [bookings, blocksSaved] = await Promise.all([
      prisma.reservation.count(),
      prisma.blockedPeriod.count(),
    ]);
    expect(bookings + blocksSaved).toBe(1);
  });
});

describe("database test 8: publishing and switching off the last active table at once never leave it published without one", () => {
  test.each(ROUNDS)("round %i", async () => {
    // Lori, not published yet, with one active table and her hours: ready to publish.
    await prisma.restaurant.update({
      where: { id: lori.restaurantId },
      data: { isPublished: false },
    });
    await prisma.table.update({ where: { id: lori.t2 }, data: { isActive: false } });
    const owner = await cookie(lori.ownerId, "OWNER");

    const [publish, switchOff] = await Promise.all([
      request(app)
        .patch(`/api/owner/restaurants/${lori.restaurantId}`)
        .set("Cookie", owner)
        .send({ isPublished: true }),
      request(app)
        .patch(`/api/owner/restaurants/${lori.restaurantId}/tables/${lori.t1}`)
        .set("Cookie", owner)
        .send({ isActive: false }),
    ]);

    expect(["200 done / 409 LAST_ACTIVE_TABLE", "409 NOT_READY_TO_PUBLISH / 200 done"]).toContain(
      `${outcome(publish)} / ${outcome(switchOff)}`,
    );
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: lori.restaurantId },
      select: { isPublished: true },
    });
    const activeTables = await prisma.table.count({
      where: { restaurantId: lori.restaurantId, isActive: true },
    });
    expect(restaurant.isPublished && activeTables === 0).toBe(false);
  });
});

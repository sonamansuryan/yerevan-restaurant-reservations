// Reviews (src/modules/reviews/reviews.service.ts), with Prisma replaced: which visits can be
// reviewed, that the restaurant's average and count change in the same transaction after its row
// is locked, and what a stranger sees of a review. tests/db/reviews.test.ts runs the same on real
// PostgreSQL, including reviews posted at the same moment.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Prisma } from "../src/generated/prisma/client.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { prisma } from "../src/lib/prisma.ts";
import { createReview, listReviews } from "../src/modules/reviews/reviews.service.ts";
import { prismaError } from "./fixtures/prisma-errors.ts";
import { guestReservation } from "./fixtures/reservations.ts";
import { sessionUser } from "./fixtures/users.ts";

vi.mock("../src/lib/prisma.ts", () => {
  const client = {
    reservation: { findUnique: vi.fn() },
    review: { create: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    restaurant: { findUnique: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
    // A transaction's work gets the client itself as `tx`. A list of reads simply runs.
    $transaction: vi.fn((work: unknown) =>
      typeof work === "function" ? work(client) : Promise.all(work as Promise<unknown>[]),
    ),
  };
  return { prisma: client, isDatabaseReachable: vi.fn() };
});

const findBooking = vi.mocked(prisma.reservation.findUnique);
const create = vi.mocked(prisma.review.create);
const aggregate = vi.mocked(prisma.review.aggregate);
const findReviews = vi.mocked(prisma.review.findMany);
const countReviews = vi.mocked(prisma.review.count);
const findRestaurant = vi.mocked(prisma.restaurant.findUnique);
const updateRestaurant = vi.mocked(prisma.restaurant.update);
const queryRaw = vi.mocked(prisma.$queryRaw);
const transaction = vi.mocked(prisma.$transaction);

const GUEST = sessionUser.id;
const ID = guestReservation.id;
const LORI = "5e4d3c2b-1a09-4f8e-9d7c-6b5a4f3e2d1c";
const WRITTEN = new Date("2026-11-14T18:30:00.000Z");

beforeEach(() => {
  findBooking.mockResolvedValue({ status: "ARRIVED", restaurantId: LORI } as never);
  create.mockResolvedValue({
    id: "review-1",
    rating: 5,
    comment: "The trout was perfect.",
    createdAt: WRITTEN,
  } as never);
  // Two reviews now: a 4 from before, and this 5.
  aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

const post = (rating = 5, comment: string | null = "The trout was perfect.") =>
  createReview(GUEST, ID, { rating, comment });

/** The SQL text of a tagged $queryRaw call, without its values. */
const sqlOf = (call: unknown[] | undefined): string =>
  ((call?.[0] as TemplateStringsArray | undefined) ?? []).join("?");

describe("createReview", () => {
  test("saves the review of the guest's visit, and answers it", async () => {
    const review = await post();

    expect(findBooking).toHaveBeenCalledWith({
      where: { id: ID, userId: GUEST },
      select: { status: true, restaurantId: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        reservationId: ID,
        restaurantId: LORI,
        userId: GUEST,
        rating: 5,
        comment: "The trout was perfect.",
      },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    expect(review).toEqual({
      id: "review-1",
      rating: 5,
      comment: "The trout was perfect.",
      createdAt: "2026-11-14T18:30:00.000Z",
    });
  });

  test("a review without words saves none", async () => {
    await createReview(GUEST, ID, { rating: 4 });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({ rating: 4, comment: null });
  });

  test("the restaurant's average and count are recounted from its reviews, in the same transaction", async () => {
    await post();

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(aggregate).toHaveBeenCalledWith({
      where: { restaurantId: LORI },
      _avg: { rating: true },
      _count: { _all: true },
    });
    expect(updateRestaurant).toHaveBeenCalledWith({
      where: { id: LORI },
      data: { avgRating: 4.5, reviewCount: 2 },
    });
  });

  test("the restaurant's row is locked before the review is saved, so each count includes every review before it", async () => {
    await post();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(sqlOf(queryRaw.mock.calls[0])).toBe(
      'SELECT 1 FROM "Restaurant" WHERE "id" = ? FOR NO KEY UPDATE',
    );
    expect(queryRaw.mock.calls[0]?.[1]).toBe(LORI);
    const [locked] = queryRaw.mock.invocationCallOrder;
    const [saved] = create.mock.invocationCallOrder;
    const [counted] = aggregate.mock.invocationCallOrder;
    expect(locked).toBeLessThan(saved ?? 0);
    expect(saved).toBeLessThan(counted ?? 0);
  });

  test("someone else's booking, or one that doesn't exist, is a 404, and nothing is locked or written", async () => {
    findBooking.mockResolvedValue(null);

    await expect(post()).rejects.toEqual(new NotFoundError("RESERVATION_NOT_FOUND"));
    expect(queryRaw).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  test("only a visit the restaurant marked arrived can be reviewed", async () => {
    for (const status of ["PENDING", "CONFIRMED", "NO_SHOW", "CANCELLED"] as const) {
      findBooking.mockResolvedValueOnce({ status, restaurantId: LORI } as never);

      await expect(post(), status).rejects.toEqual(new ConflictError("NOT_VISITED"));
    }
    expect(queryRaw).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("a visit already reviewed is a 409 ALREADY_REVIEWED, and the average isn't touched", async () => {
    // The database keeps one review per booking.
    create.mockRejectedValue(prismaError("P2002", "23505"));

    await expect(post()).rejects.toEqual(new ConflictError("ALREADY_REVIEWED"));
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  test("any other database error is passed on as it is, to become a 500", async () => {
    const refusal = prismaError("P2039", "23514");
    create.mockRejectedValue(refusal);

    await expect(post()).rejects.toBe(refusal);
  });
});

describe("listReviews", () => {
  const firstPage = { page: 1, pageSize: 10 };

  beforeEach(() => {
    findRestaurant.mockResolvedValue({ id: LORI, timezone: "Asia/Yerevan" } as never);
    findReviews.mockResolvedValue([
      {
        id: "review-1",
        rating: 5,
        comment: "The trout was perfect.",
        createdAt: WRITTEN,
        user: { name: "Lilit Harutyunyan" },
      },
    ] as never);
    countReviews.mockResolvedValue(1);
  });

  const askedFor = (): Record<string, unknown> =>
    findReviews.mock.calls[0]?.[0] as Record<string, unknown>;

  test("a published restaurant's reviews, newest first, a page at a time", async () => {
    countReviews.mockResolvedValue(23);

    const list = await listReviews("lori-smokehouse", { page: 3, pageSize: 10 });

    expect(findRestaurant).toHaveBeenCalledWith({
      where: { slug: "lori-smokehouse", isPublished: true, hiddenAt: null },
      select: { id: true, timezone: true },
    });
    expect(askedFor()).toMatchObject({
      where: { restaurantId: LORI },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 20,
      take: 10,
    });
    expect(countReviews).toHaveBeenCalledWith({ where: { restaurantId: LORI } });
    expect(list.meta).toEqual({ page: 3, pageSize: 10, total: 23 });
  });

  test("the page and the total are read at one moment", async () => {
    await listReviews("lori-smokehouse", firstPage);

    expect(transaction).toHaveBeenCalledWith(expect.any(Array), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  test("a stranger sees the rating, the words, the first name and the day, and nothing else", async () => {
    const { data } = await listReviews("lori-smokehouse", firstPage);

    expect(askedFor()["select"]).toEqual({
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { name: true } },
    });
    expect(data).toEqual([
      {
        id: "review-1",
        rating: 5,
        comment: "The trout was perfect.",
        author: "Lilit",
        date: "2026-11-14",
        createdAt: "2026-11-14T18:30:00.000Z",
      },
    ]);
  });

  test("the day is the restaurant's: 01:30 in Yerevan is the next day, though still the evening before in UTC", async () => {
    findReviews.mockResolvedValue([
      {
        id: "review-1",
        rating: 4,
        comment: null,
        createdAt: new Date("2026-11-14T21:30:00.000Z"),
        user: { name: "Aram" },
      },
    ] as never);

    const [review] = (await listReviews("lori-smokehouse", firstPage)).data;

    expect(review).toMatchObject({ date: "2026-11-15", author: "Aram", comment: null });
  });

  test("a name with extra spaces still gives just the first name", async () => {
    findReviews.mockResolvedValue([
      {
        id: "r",
        rating: 3,
        comment: null,
        createdAt: WRITTEN,
        user: { name: "  Ani   Petrosyan " },
      },
    ] as never);

    const [review] = (await listReviews("lori-smokehouse", firstPage)).data;

    expect(review?.author).toBe("Ani");
  });

  test("a restaurant that doesn't exist, or isn't published, is a 404, and no reviews are read", async () => {
    findRestaurant.mockResolvedValue(null);

    await expect(listReviews("davtashen-test-kitchen", firstPage)).rejects.toEqual(
      new NotFoundError("RESTAURANT_NOT_FOUND"),
    );
    expect(findReviews).not.toHaveBeenCalled();
  });
});

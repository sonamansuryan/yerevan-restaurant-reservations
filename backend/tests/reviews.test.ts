// Reviews over HTTP, with the service replaced: a guest posting one at
// /api/reservations/:reservationId/review, and anyone reading a restaurant's at
// /api/restaurants/:slug/reviews. Who may, the input checks and the replies. The transaction is in
// reviews.service.test.ts, and runs on real PostgreSQL in tests/db/reviews.test.ts.
import request from "supertest";
import type { Response } from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { ConflictError, NotFoundError } from "../src/lib/errors.ts";
import { ACCESS_COOKIE } from "../src/modules/auth/auth.cookies.ts";
import { signAccessToken } from "../src/modules/auth/token.service.ts";
import type { SessionUser } from "../src/modules/auth/token.service.ts";
import { createReview, listReviews } from "../src/modules/reviews/reviews.service.ts";
import type { GuestReview, ReviewList } from "../src/modules/reviews/reviews.service.ts";
import { prismaError } from "./fixtures/prisma-errors.ts";
import { guestReservation } from "./fixtures/reservations.ts";
import { ani, sessionUser } from "./fixtures/users.ts";

vi.mock("../src/modules/reviews/reviews.service.ts", () => ({
  createReview: vi.fn(),
  listReviews: vi.fn(),
}));

const post = vi.mocked(createReview);
const list = vi.mocked(listReviews);

afterEach(() => {
  vi.resetAllMocks();
});

const ID = guestReservation.id;

const posted: GuestReview = {
  id: "7c6b5a49-3827-4615-a4b3-c2d1e0f9a8b7",
  rating: 5,
  comment: "The trout was perfect.",
  createdAt: "2026-11-14T18:30:00.000Z",
};

async function review(id: string, body: object, user?: SessionUser): Promise<Response> {
  const req = request(app).post(`/api/reservations/${id}/review`);
  if (user) req.set("Cookie", `${ACCESS_COOKIE}=${await signAccessToken(user)}`);
  return req.send(body);
}

describe("POST /api/reservations/:reservationId/review", () => {
  test("a guest reviews their visit, and gets the review back", async () => {
    post.mockResolvedValue(posted);

    const reply = await review(ID, { rating: 5, comment: "The trout was perfect." }, sessionUser);

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({ review: posted });
    expect(post).toHaveBeenCalledWith(sessionUser.id, ID, {
      rating: 5,
      comment: "The trout was perfect.",
    });
  });

  test("the guest is whoever is signed in, and the body can't name anyone or anything else", async () => {
    post.mockResolvedValue(posted);

    await review(
      ID,
      { rating: 4, userId: "someone-else", restaurantId: "another-place", reservationId: "x" },
      sessionUser,
    );

    expect(post).toHaveBeenCalledWith(sessionUser.id, ID, { rating: 4 });
  });

  test("words are trimmed, and blank words count as none", async () => {
    post.mockResolvedValue(posted);

    await review(ID, { rating: 3, comment: "  Lovely terrace.  " }, sessionUser);
    await review(ID, { rating: 3, comment: "   " }, sessionUser);

    expect(post).toHaveBeenNthCalledWith(1, sessionUser.id, ID, {
      rating: 3,
      comment: "Lovely terrace.",
    });
    expect(post).toHaveBeenNthCalledWith(2, sessionUser.id, ID, { rating: 3, comment: null });
  });

  test("1000 characters of words are fine", async () => {
    post.mockResolvedValue(posted);

    const reply = await review(ID, { rating: 5, comment: "ա".repeat(1000) }, sessionUser);

    expect(reply.status).toBe(201);
  });

  test.each<[string, object, Record<string, string>]>([
    ["no rating", {}, { rating: "Choose a rating from 1 to 5." }],
    ["a rating of 0", { rating: 0 }, { rating: "Choose a rating from 1 to 5." }],
    ["a rating of 6", { rating: 6 }, { rating: "Choose a rating from 1 to 5." }],
    ["half a point", { rating: 4.5 }, { rating: "Choose a rating from 1 to 5." }],
    ["a rating in words", { rating: "5" }, { rating: "Choose a rating from 1 to 5." }],
    [
      "words far too long",
      { rating: 5, comment: "a".repeat(1001) },
      { comment: "Use 1000 characters or fewer." },
    ],
    [
      "words that aren't text",
      { rating: 5, comment: 42 },
      { comment: "Use 1000 characters or fewer." },
    ],
  ])("%s is a 400 under its field, before the database is asked", async (_c, body, fields) => {
    const reply = await review(ID, body, sessionUser);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual(fields);
    expect(post).not.toHaveBeenCalled();
  });

  test("a booking id that isn't a UUID is a 400, before the database is asked", async () => {
    const reply = await review("booking-1", { rating: 5 }, sessionUser);

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({ reservationId: "Choose a booking." });
    expect(post).not.toHaveBeenCalled();
  });

  test("only guests review: signed out is a 401, and an owner a 403", async () => {
    expect((await review(ID, { rating: 5 })).status).toBe(401);
    expect((await review(ID, { rating: 5 }, ani)).status).toBe(403);
    expect(post).not.toHaveBeenCalled();
  });

  test("a refusal reaches the guest as it is", async () => {
    const refusals: [Error, number, string][] = [
      [new NotFoundError("RESERVATION_NOT_FOUND"), 404, "We couldn’t find this booking."],
      [
        new ConflictError("NOT_VISITED"),
        409,
        "You can review a visit once the restaurant has marked you as arrived.",
      ],
      [new ConflictError("ALREADY_REVIEWED"), 409, "You’ve already reviewed this visit."],
    ];

    for (const [error, status, message] of refusals) {
      post.mockRejectedValueOnce(error);

      const reply = await review(ID, { rating: 5 }, sessionUser);

      expect(reply.status).toBe(status);
      expect(reply.body.error.message).toBe(message);
    }
  });

  test("any other database error is a 500, never a 409", async () => {
    // A CHECK refusal, such as a rating the database won't take, is a fault in our code.
    post.mockRejectedValue(prismaError("P2039", "23514"));

    const reply = await review(ID, { rating: 5 }, sessionUser);

    expect(reply.status).toBe(500);
  });
});

describe("GET /api/restaurants/:slug/reviews", () => {
  const page: ReviewList = {
    data: [
      {
        id: posted.id,
        rating: 5,
        comment: "The trout was perfect.",
        author: "Lilit",
        date: "2026-11-14",
        createdAt: posted.createdAt,
      },
    ],
    meta: { page: 1, pageSize: 10, total: 1 },
  };
  const read = (path: string): request.Test => request(app).get(path);

  test("anyone reads a restaurant's reviews, newest first, 10 to a page", async () => {
    list.mockResolvedValue(page);

    const reply = await read("/api/restaurants/lori-smokehouse/reviews");

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(page);
    expect(list).toHaveBeenCalledWith("lori-smokehouse", { page: 1, pageSize: 10 });
  });

  test("another page and size are asked for in the address, and capitals still find it", async () => {
    list.mockResolvedValue(page);

    await read("/api/restaurants/Lori-Smokehouse/reviews?page=2&pageSize=5&rating=5");

    expect(list).toHaveBeenCalledWith("lori-smokehouse", { page: 2, pageSize: 5 });
  });

  test("an unknown page or size is a 400 under its field", async () => {
    const reply = await read("/api/restaurants/lori-smokehouse/reviews?page=0&pageSize=51");

    expect(reply.status).toBe(400);
    expect(reply.body.error.details.fields).toEqual({
      page: "Choose a page from 1.",
      pageSize: "Choose a page size from 1 to 50.",
    });
    expect(list).not.toHaveBeenCalled();
  });

  test("a restaurant that doesn't exist, or isn't published, is a 404", async () => {
    list.mockRejectedValue(new NotFoundError("RESTAURANT_NOT_FOUND"));

    const reply = await read("/api/restaurants/davtashen-test-kitchen/reviews");

    expect(reply.status).toBe(404);
    expect(reply.body.error.code).toBe("RESTAURANT_NOT_FOUND");
  });
});

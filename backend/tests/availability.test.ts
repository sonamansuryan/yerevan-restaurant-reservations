// GET /api/restaurants/:slug/availability, with the service replaced: these tests cover the
// address, the input checks and the replies. The reads are in availability.service.test.ts.
import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

import { app } from "../src/app.ts";
import { NotFoundError } from "../src/lib/errors.ts";
import { getAvailability } from "../src/modules/availability/availability.service.ts";
import { availabilityReply } from "./fixtures/availability.ts";

vi.mock("../src/modules/availability/availability.service.ts", () => ({
  getAvailability: vi.fn(),
}));

const availability = vi.mocked(getAvailability);

afterEach(() => {
  availability.mockReset();
});

const ask = (path: string): request.Test => request(app).get(`/api/restaurants/${path}`);

describe("GET /api/restaurants/:slug/availability", () => {
  test("answers anyone, signed in or not, with the times and the free tables", async () => {
    availability.mockResolvedValue(availabilityReply);

    const reply = await ask("lori-smokehouse/availability?date=2026-11-14&partySize=2");

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(availabilityReply);
    expect(availability).toHaveBeenCalledWith("lori-smokehouse", {
      date: "2026-11-14",
      partySize: 2,
    });
  });

  test("finds the restaurant whatever the case of its address, and drops anything else asked", async () => {
    availability.mockResolvedValue(availabilityReply);

    await ask(
      "Lori-Smokehouse/availability?date=2026-11-14&partySize=02&isPublished=false&now=2020-01-01",
    );

    expect(availability).toHaveBeenCalledWith("lori-smokehouse", {
      date: "2026-11-14",
      partySize: 2,
    });
  });

  test("a missing or impossible date is a 400 under date, and nothing is read", async () => {
    for (const date of ["", "&date=", "&date=2026-02-30", "&date=14/11/2026", "&date=tomorrow"]) {
      const reply = await ask(`lori-smokehouse/availability?partySize=2${date}`);

      expect(reply.status, date).toBe(400);
      expect(reply.body.error.details.fields, date).toEqual({
        date: "Choose a date, such as 2026-11-20.",
      });
    }
    expect(availability).not.toHaveBeenCalled();
  });

  test("a party that isn't a whole number from 1 to 50 is a 400 under partySize", async () => {
    for (const partySize of [
      "",
      "&partySize=",
      "&partySize=0",
      "&partySize=51",
      "&partySize=2.5",
      "&partySize=two",
    ]) {
      const reply = await ask(`lori-smokehouse/availability?date=2026-11-14${partySize}`);

      expect(reply.status, partySize).toBe(400);
      expect(reply.body.error.details.fields, partySize).toEqual({
        partySize: "Choose how many guests, from 1 to 50.",
      });
    }
    expect(availability).not.toHaveBeenCalled();
  });

  test("a restaurant that doesn't exist or isn't published is a 404", async () => {
    availability.mockRejectedValue(new NotFoundError("RESTAURANT_NOT_FOUND"));

    const reply = await ask("davtashen-test-kitchen/availability?date=2026-11-14&partySize=2");

    expect(reply.status).toBe(404);
    expect(reply.body).toMatchObject({
      error: { code: "RESTAURANT_NOT_FOUND", message: "We couldn’t find this restaurant." },
    });
  });

  test("an address below it answers 404, without reading anything", async () => {
    const reply = await ask("lori-smokehouse/availability/extra?date=2026-11-14&partySize=2");

    expect(reply.status).toBe(404);
    expect(availability).not.toHaveBeenCalled();
  });
});

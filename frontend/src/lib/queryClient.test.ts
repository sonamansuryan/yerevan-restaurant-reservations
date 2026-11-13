import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";

import { adminKeys } from "@/features/admin/admin";
import { ownerKeys } from "@/features/dashboard/queryKeys";
import { ApiError } from "@/lib/api";
import {
  ME_QUERY_KEY,
  forgetPrivateData,
  forgetWhenAnotherPersonSignsIn,
  queryClient,
} from "@/lib/queryClient";
import type { AuthUser } from "@/types/api";

const lilit: AuthUser = {
  id: "user-1",
  email: "lilit@example.com",
  name: "Lilit Harutyunyan",
  phone: null,
  role: "CUSTOMER",
};

const sessionEnded = new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");

afterEach(() => {
  queryClient.clear();
});

test("the app shares one query client", () => {
  expect(queryClient).toBeInstanceOf(QueryClient);
});

test("a 401 that reaches a query means nobody is signed in any more", async () => {
  queryClient.setQueryData(ME_QUERY_KEY, lilit);

  await queryClient
    .fetchQuery({ queryKey: ["private"], queryFn: () => Promise.reject(sessionEnded) })
    .catch(() => {});

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull();
});

test("so does a 401 that reaches a mutation", async () => {
  queryClient.setQueryData(ME_QUERY_KEY, lilit);

  await new MutationObserver(queryClient, { mutationFn: () => Promise.reject(sessionEnded) })
    .mutate()
    .catch(() => {});

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toBeNull();
});

test("forgetting private data drops an owner's, a guest's bookings and favorites, and an admin's lists, and keeps what anyone can see", () => {
  const day = ["owner", "reservations", "r-1", "2026-11-13", 1];
  // A restaurant's numbers, and all of Seghan's (9.6).
  queryClient.setQueryData(ownerKeys.analytics("r-1", 30), { bookings: 4 });
  queryClient.setQueryData(adminKeys.analytics(7), { bookings: 40 });
  queryClient.setQueryData(["reservations", "upcoming", 1], { data: [] });
  queryClient.setQueryData(["reservations", "past", 2], { data: [] });
  queryClient.setQueryData(["owner", "restaurants"], { data: [] });
  queryClient.setQueryData(day, { data: [] });
  queryClient.setQueryData(["favorites", "list", 1], { data: [] });
  queryClient.setQueryData(["favorites", "restaurant", "lori-smokehouse"], { saved: true });
  queryClient.setQueryData(["admin", "users", { page: 1 }], { data: [] });
  queryClient.setQueryData(["admin", "restaurants", { show: "hidden", page: 1 }], { data: [] });
  queryClient.setQueryData(["restaurants", { page: 1 }], { data: [] });
  queryClient.setQueryData(ME_QUERY_KEY, lilit);

  forgetPrivateData(queryClient);

  expect(queryClient.getQueryData(["owner", "restaurants"])).toBeUndefined();
  expect(queryClient.getQueryData(day)).toBeUndefined();
  expect(queryClient.getQueryData(["reservations", "upcoming", 1])).toBeUndefined();
  expect(queryClient.getQueryData(["reservations", "past", 2])).toBeUndefined();
  expect(queryClient.getQueryData(["favorites", "list", 1])).toBeUndefined();
  expect(queryClient.getQueryData(["favorites", "restaurant", "lori-smokehouse"])).toBeUndefined();
  expect(queryClient.getQueryData(["admin", "users", { page: 1 }])).toBeUndefined();
  expect(
    queryClient.getQueryData(["admin", "restaurants", { show: "hidden", page: 1 }]),
  ).toBeUndefined();
  expect(queryClient.getQueryData(ownerKeys.analytics("r-1", 30))).toBeUndefined();
  expect(queryClient.getQueryData(adminKeys.analytics(7))).toBeUndefined();
  expect(queryClient.getQueryData(["restaurants", { page: 1 }])).toEqual({ data: [] });
  // Who's signed in is set by whoever knows, not forgotten here.
  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(lilit);
});

test("any other failure leaves the session alone", async () => {
  queryClient.setQueryData(ME_QUERY_KEY, lilit);
  const unavailable = new ApiError(503, "SERVER_UNAVAILABLE", "Try again.");

  await queryClient
    .fetchQuery({ queryKey: ["broken"], queryFn: () => Promise.reject(unavailable) })
    .catch(() => {});

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(lilit);
});

describe("when another person signs in", () => {
  const aram: AuthUser = {
    ...lilit,
    id: "user-2",
    email: "aram@example.com",
    name: "Aram Petrosyan",
  };
  const bookings = ["reservations", "upcoming", 1];
  const watching: (() => void)[] = [];

  /** A client of its own, so what the watcher remembers can't leak from one test to the next. */
  function watchedClient(): QueryClient {
    const client = new QueryClient();
    watching.push(forgetWhenAnotherPersonSignsIn(client));
    return client;
  }

  afterEach(() => {
    for (const stop of watching.splice(0)) stop();
  });

  test("an account changed in another tab: the last person's data goes as soon as this tab hears", () => {
    const client = watchedClient();
    client.setQueryData(ME_QUERY_KEY, lilit);
    client.setQueryData(bookings, { data: ["Lilit's table"] });
    client.setQueryData(["favorites", "list", 1], { data: ["Lilit's favorite"] });

    client.setQueryData(ME_QUERY_KEY, aram);

    expect(client.getQueryData(bookings)).toBeUndefined();
    expect(client.getQueryData(["favorites", "list", 1])).toBeUndefined();
  });

  test("the app's own client watches, so every page is covered", () => {
    queryClient.setQueryData(ME_QUERY_KEY, lilit);
    queryClient.setQueryData(bookings, { data: ["Lilit's table"] });

    queryClient.setQueryData(ME_QUERY_KEY, aram);

    expect(queryClient.getQueryData(bookings)).toBeUndefined();
  });

  test("signed out in between, it still goes once someone else is signed in", () => {
    const client = watchedClient();
    client.setQueryData(ME_QUERY_KEY, lilit);
    client.setQueryData(bookings, { data: ["Lilit's table"] });

    client.setQueryData(ME_QUERY_KEY, null);
    client.setQueryData(ME_QUERY_KEY, aram);

    expect(client.getQueryData(bookings)).toBeUndefined();
  });

  test("the same person again keeps what's theirs, and so does the first answer", () => {
    const client = watchedClient();
    client.setQueryData(bookings, { data: ["Lilit's table"] });

    client.setQueryData(ME_QUERY_KEY, lilit);
    client.setQueryData(ME_QUERY_KEY, null);
    client.setQueryData(ME_QUERY_KEY, { ...lilit });

    expect(client.getQueryData(bookings)).toEqual({ data: ["Lilit's table"] });
  });

  test("a list on screen empties at once, then shows the new person's own", async () => {
    const client = watchedClient();
    client.setQueryData(ME_QUERY_KEY, lilit);
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ data: ["Lilit's table"] })
      .mockResolvedValue({ data: ["Aram's table"] });
    const observer = new QueryObserver(client, { queryKey: bookings, queryFn });
    const stop = observer.subscribe(() => {});
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ data: ["Lilit's table"] }),
    );

    client.setQueryData(ME_QUERY_KEY, aram);

    expect(observer.getCurrentResult().data).toBeUndefined();
    await vi.waitFor(() =>
      expect(observer.getCurrentResult().data).toEqual({ data: ["Aram's table"] }),
    );
    expect(queryFn).toHaveBeenCalledTimes(2);
    stop();
  });
});

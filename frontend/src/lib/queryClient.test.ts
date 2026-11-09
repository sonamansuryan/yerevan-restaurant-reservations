import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, test } from "vitest";

import { ApiError } from "@/lib/api";
import { ME_QUERY_KEY, queryClient } from "@/lib/queryClient";
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

test("any other failure leaves the session alone", async () => {
  queryClient.setQueryData(ME_QUERY_KEY, lilit);
  const unavailable = new ApiError(503, "SERVER_UNAVAILABLE", "Try again.");

  await queryClient
    .fetchQuery({ queryKey: ["broken"], queryFn: () => Promise.reject(unavailable) })
    .catch(() => {});

  expect(queryClient.getQueryData(ME_QUERY_KEY)).toEqual(lilit);
});

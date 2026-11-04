import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";

import { queryClient } from "@/lib/queryClient";

test("the app shares one query client", () => {
  expect(queryClient).toBeInstanceOf(QueryClient);
});

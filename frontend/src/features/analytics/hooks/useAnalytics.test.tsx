// @vitest-environment jsdom
// What stays on screen while the next numbers load: the last period's of the same place, faded,
// but never another restaurant's.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";

import { useRestaurantAnalytics } from "@/features/analytics/hooks/useRestaurantAnalytics";
import { useSeghanAnalytics } from "@/features/analytics/hooks/useSeghanAnalytics";
import { loriAnalytics, seghanAnalytics } from "@/features/design/samples";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Answers only the paths given, and leaves every other request waiting. */
function answering(replies: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url in replies
        ? Promise.resolve(new Response(JSON.stringify({ analytics: replies[url] })))
        : new Promise(() => {}),
    ),
  );
}

function wrapper({ children }: { children: ReactNode }): ReactElement {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/somewhere"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

test("another period of the same restaurant keeps the last numbers on screen, marked as updating", async () => {
  answering({ "/api/owner/restaurants/lori/analytics?days=30": loriAnalytics[30] });
  const { result } = renderHook(() => useRestaurantAnalytics("lori"), { wrapper });
  await waitFor(() => expect(result.current.report.data).toEqual(loriAnalytics[30]));

  act(() => result.current.onDaysChange(7));

  await waitFor(() => expect(result.current.days).toBe(7));
  expect(result.current.report.data).toEqual(loriAnalytics[30]);
  expect(result.current.report.updating).toBe(true);
});

test("another restaurant's numbers never stand in for this one's while they load", async () => {
  answering({ "/api/owner/restaurants/lori/analytics?days=30": loriAnalytics[30] });
  const { result, rerender } = renderHook(({ id }) => useRestaurantAnalytics(id), {
    wrapper,
    initialProps: { id: "lori" },
  });
  await waitFor(() => expect(result.current.report.data).toEqual(loriAnalytics[30]));

  rerender({ id: "nurr" });

  expect(result.current.report.data).toBeUndefined();
  expect(result.current.report.updating).toBe(false);
});

test("Seghan's numbers ask for the period in the address, and keep the last while the next loads", async () => {
  answering({ "/api/admin/analytics?days=30": seghanAnalytics });
  const { result } = renderHook(() => useSeghanAnalytics(), { wrapper });
  await waitFor(() => expect(result.current.report.data).toEqual(seghanAnalytics));

  act(() => result.current.onDaysChange(90));

  await waitFor(() => expect(result.current.days).toBe(90));
  expect(result.current.report).toMatchObject({ data: seghanAnalytics, updating: true });
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    "/api/admin/analytics?days=30",
    "/api/admin/analytics?days=90",
  ]);
});

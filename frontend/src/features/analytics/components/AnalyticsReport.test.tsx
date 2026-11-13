// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AnalyticsReport } from "@/features/analytics/components/AnalyticsReport";
import type { AnalyticsReportState } from "@/features/analytics/components/AnalyticsReport";
import { MostBooked } from "@/features/analytics/components/MostBooked";
import {
  firstWeekAnalytics,
  loriAnalytics,
  quietAnalytics,
  seghanAnalytics,
} from "@/features/design/samples";
import type { Analytics, AnalyticsDays, SeghanAnalytics } from "@/types/api";

afterEach(cleanup);

function state<T extends Analytics>(
  data: T | undefined,
  change: Partial<AnalyticsReportState<T>> = {},
): AnalyticsReportState<T> {
  return { data, failed: false, retrying: false, onRetry: vi.fn(), updating: false, ...change };
}

function renderReport(
  report: AnalyticsReportState<Analytics>,
  days: AnalyticsDays = 30,
): { onDaysChange: ReturnType<typeof vi.fn> } {
  const onDaysChange = vi.fn();
  render(<AnalyticsReport days={days} onDaysChange={onDaysChange} report={report} />);
  return { onDaysChange };
}

const part = (title: string): HTMLElement =>
  screen.getByRole("heading", { level: 3, name: title }).closest("section") as HTMLElement;

describe("the numbers", () => {
  test("the days counted, then the figures, then each status and each rating as bars", () => {
    renderReport(state(loriAnalytics[30]));

    expect(screen.getByRole("status").textContent).toBe(
      "13 October – 11 November, by the day each booking is for",
    );
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Bookings",
      "Guests",
      "Cancellations",
      "No-shows",
      "Rating",
    ]);
    expect(
      within(part("Bookings by status"))
        .getAllByRole("listitem")
        .map((line) => line.textContent),
    ).toEqual(["Pending15%", "Confirmed314%", "Arrived1362%", "No-show15%", "Cancelled314%"]);
    expect(within(part("Ratings")).getAllByRole("listitem")).toHaveLength(5);
  });

  test("with no reviews yet, the ratings say so instead of drawing five empty bars", () => {
    renderReport(state(firstWeekAnalytics), 7);

    expect(within(part("Ratings")).queryByRole("list")).toBeNull();
    expect(within(part("Ratings")).getByText(/No reviews of these bookings yet/)).toBeDefined();
  });

  test("anything only these numbers have comes last, such as the admin's most booked", () => {
    render(
      <AnalyticsReport<SeghanAnalytics>
        days={30}
        onDaysChange={vi.fn()}
        report={state(seghanAnalytics)}
        more={(numbers) => <MostBooked restaurants={numbers.restaurants} />}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 3 }).map((one) => one.textContent)).toEqual([
      "Bookings by status",
      "Ratings",
      "Most booked",
    ]);
    expect(
      within(part("Most booked"))
        .getAllByRole("listitem")
        .map((line) => line.textContent),
    ).toEqual([
      "Lori Smokehouse21",
      "Kond House14",
      "Nurr12",
      "Tsiran Wine Room6",
      "Tbilisi Courtyard3",
    ]);
  });
});

describe("the period", () => {
  test("it's chosen from the three offered, and applies at once", async () => {
    const { onDaysChange } = renderReport(state(loriAnalytics[30]));
    const period = screen.getByLabelText("Period");

    expect(
      within(period)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["The last 7 days", "The last 30 days", "The last 90 days"]);
    expect((period as HTMLSelectElement).value).toBe("30");

    await userEvent.selectOptions(period, "The last 7 days");

    expect(onDaysChange).toHaveBeenCalledWith(7);
  });

  test("while the next period loads, the last one stays on screen, faded and marked busy", () => {
    renderReport(state(loriAnalytics[30], { updating: true }), 7);

    const busy = screen.getByText("Bookings").closest("[aria-busy]");
    expect(busy?.getAttribute("aria-busy")).toBe("true");
    expect(busy?.className).toContain("opacity-60");
    // The days still say which numbers are on screen.
    expect(screen.getByRole("status").textContent).toContain("13 October – 11 November");
  });
});

describe("its other states", () => {
  test("no bookings in these days: the one next step is a longer look back", async () => {
    const { onDaysChange } = renderReport(state(quietAnalytics()));

    expect(screen.getByText("No bookings in these days")).toBeDefined();
    expect(screen.queryByRole("term")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show the last 90 days" }));

    expect(onDaysChange).toHaveBeenCalledWith(90);
  });

  test("no bookings even in 90 days: there's no longer look back to offer", () => {
    renderReport(state(quietAnalytics({ days: 90, from: "2026-08-14", to: "2026-11-11" })), 90);

    expect(screen.getByText("No bookings in these days")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("loading: the period can already be changed, and the days wait for the numbers", () => {
    renderReport(state(undefined));

    expect(screen.getByRole("status", { name: "Loading the numbers" })).toBeDefined();
    expect(screen.getByLabelText("Period")).toBeDefined();
    expect(screen.queryByText(/by the day each booking is for/)).toBeNull();
  });

  test("couldn't load: Try again asks once more", async () => {
    const onRetry = vi.fn();
    renderReport(state(undefined, { failed: true, onRetry }));

    expect(screen.getByText("We couldn’t load the numbers.")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

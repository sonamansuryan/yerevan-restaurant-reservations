// @vitest-environment jsdom
// The admin's reservations and users: lines to read, and their filters.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AdminReservations } from "@/features/admin/components/AdminReservations";
import type { AdminReservationsProps } from "@/features/admin/components/AdminReservations";
import { AdminUsers } from "@/features/admin/components/AdminUsers";
import type { AdminUsersProps } from "@/features/admin/components/AdminUsers";
import type { AdminListState } from "@/features/admin/components/AdminListBody";
import { adminReservations, adminUsers } from "@/features/design/samples";

afterEach(cleanup);

function loaded<T>(data: T[], total = data.length): AdminListState<T> {
  return {
    data: { data, meta: { page: 1, pageSize: 20, total } },
    failed: false,
    retrying: false,
    onRetry: vi.fn(),
    updating: false,
  };
}

const lines = (): HTMLElement[] => within(screen.getByRole("region")).getAllByRole("listitem");

describe("reservations", () => {
  function renderPart(change: Partial<AdminReservationsProps> = {}): AdminReservationsProps {
    const props: AdminReservationsProps = {
      filters: { page: 1 },
      onFiltersChange: vi.fn(),
      list: loaded(adminReservations),
      hrefFor: (page) => `?page=${page}`,
      today: "2026-11-12",
      ...change,
    };
    render(
      <MemoryRouter>
        <AdminReservations {...props} />
      </MemoryRouter>,
    );
    return props;
  }

  test("each on its restaurant's day and clock, with the guest, table and status", () => {
    renderPart();

    expect(screen.getByRole("region", { name: "Reservations" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("5 bookings");
    const [late] = lines();
    // Ending after midnight, on the restaurant's clock.
    expect(late!.textContent).toBe(
      "Saturday 14 November23:30–01:30, 23:30 to 01:30PendingLori SmokehouseLilit Harutyunyan · lilit@example.comTable T4 · 4 guests",
    );
  });

  test("a cancelled one is crossed out, and its badge says it in words", () => {
    renderPart();

    const cancelled = lines()[2]!;
    expect(within(cancelled).getByText("Cancelled")).toBeDefined();
    expect(within(cancelled).getByText("Nurr").className).toContain("line-through");
  });

  test("there's nothing to press on a line", () => {
    renderPart();

    for (const line of lines()) expect(within(line).queryByRole("button")).toBeNull();
  });

  test("status applies at once; a whole day too, and clearing it", async () => {
    const props = renderPart({ filters: { q: "lori", page: 2 } });

    await userEvent.selectOptions(screen.getByLabelText("Status"), "No-show");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-11-14" } });

    expect(vi.mocked(props.onFiltersChange).mock.calls).toEqual([
      [{ q: "lori", status: "NO_SHOW", page: 1 }],
      [{ q: "lori", date: "2026-11-14", page: 1 }],
    ]);
    cleanup();

    const dated = renderPart({ filters: { date: "2026-11-14", page: 1 } });
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "" } });
    expect(dated.onFiltersChange).toHaveBeenCalledWith({ date: undefined, page: 1 });
  });

  test("none yet, and none matching", () => {
    renderPart({ list: loaded([]) });
    expect(screen.getByText("No reservations yet")).toBeDefined();
    cleanup();

    renderPart({ filters: { status: "ARRIVED", page: 1 }, list: loaded([]) });
    expect(screen.getByText("No reservations match")).toBeDefined();
    expect(screen.getByText("Try a different search, status or day.")).toBeDefined();
  });
});

describe("users", () => {
  function renderPart(change: Partial<AdminUsersProps> = {}): AdminUsersProps {
    const props: AdminUsersProps = {
      filters: { page: 1 },
      onFiltersChange: vi.fn(),
      list: loaded(adminUsers),
      hrefFor: (page) => `?page=${page}`,
      today: "2026-11-12",
      ...change,
    };
    render(
      <MemoryRouter>
        <AdminUsers {...props} />
      </MemoryRouter>,
    );
    return props;
  }

  test("each with their role and what they've done, and when they joined", () => {
    renderPart();

    expect(screen.getByRole("status").textContent).toBe("6 users");
    const text = lines().map((line) => line.textContent);
    expect(text[0]).toBe(
      "Davit Hakobyandavit.owner@example.com1 restaurant · Joined Wednesday 11 NovemberOwner",
    );
    expect(text[3]).toBe(
      "Lilit Harutyunyanlilit@example.com3 bookings · Joined Monday 2 NovemberGuest",
    );
    // An admin has neither, and an earlier year is written out.
    expect(text[5]).toBe("Demo Adminadmin@example.comJoined Saturday 20 December 2025Admin");
  });

  test("role applies at once, and the search when it's sent", async () => {
    const props = renderPart({ filters: { role: "OWNER", page: 3 } });

    await userEvent.selectOptions(screen.getByLabelText("Role"), "Admins");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "demo{Enter}");

    expect(vi.mocked(props.onFiltersChange).mock.calls).toEqual([
      [{ role: "ADMIN", page: 1 }],
      [{ role: "OWNER", q: "demo", page: 1 }],
    ]);
  });

  test("an unknown role is never sent: Everyone clears it", async () => {
    const props = renderPart({ filters: { role: "CUSTOMER", page: 1 } });

    await userEvent.selectOptions(screen.getByLabelText("Role"), "Everyone");

    expect(props.onFiltersChange).toHaveBeenCalledWith({ role: undefined, page: 1 });
  });

  test("none matching offers Clear filters", async () => {
    const props = renderPart({ filters: { q: "nobody", page: 1 }, list: loaded([]) });

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByText("No users match")).toBeDefined();
    expect(props.onFiltersChange).toHaveBeenCalledWith({ page: 1 });
  });
});

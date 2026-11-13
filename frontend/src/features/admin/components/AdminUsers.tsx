import type { ReactElement } from "react";
import type { To } from "react-router";

import { Select } from "@/components/Select";
import {
  ROLE_CHOICES,
  ROLE_LABELS,
  USER_ROLES,
  isFiltered,
  oneOf,
  restaurantsWords,
  usersWords,
} from "@/features/admin/admin";
import type { AdminUserFilters } from "@/features/admin/admin";
import { AdminFilterBar } from "@/features/admin/components/AdminFilterBar";
import { AdminListBody } from "@/features/admin/components/AdminListBody";
import type { AdminListState, AdminListWords } from "@/features/admin/components/AdminListBody";
import { bookingsWords } from "@/features/reservations/reservations";
import { cx } from "@/lib/cx";
import { formatDayHeading, yerevanToday } from "@/lib/time";
import type { AdminUser } from "@/types/api";

const words: AdminListWords = {
  label: "Users",
  loading: "Loading the users",
  what: "the users",
  count: usersWords,
  none: {
    title: "No users yet",
    description: "People appear here as soon as they create an account.",
  },
  noMatch: {
    title: "No users match",
    description: "Try a different search, or show everyone.",
  },
};

/** What someone has done on Seghan: a guest's bookings, or an owner's restaurants. */
function activityWords(user: AdminUser): string | null {
  if (user.role === "CUSTOMER") return bookingsWords(user.reservations);
  if (user.role === "OWNER") return restaurantsWords(user.restaurants);
  return null;
}

function UserLine({ user, today }: { user: AdminUser; today: string }): ReactElement {
  const activity = activityWords(user);
  // The day in Yerevan, with its year when it isn't this year's.
  const joined = `Joined ${formatDayHeading(yerevanToday(new Date(user.createdAt)), today)}`;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-line py-4">
      <div className="min-w-0">
        <p className="font-display text-title-xs break-words">{user.name}</p>
        <p className="mt-0.5 text-meta break-words text-ink-secondary">{user.email}</p>
        <p className="text-meta text-ink-secondary">
          {activity ? `${activity} · ${joined}` : joined}
        </p>
      </div>
      <p className="text-ui font-medium text-ink-secondary">{ROLE_LABELS[user.role]}</p>
    </li>
  );
}

export interface AdminUsersProps {
  filters: AdminUserFilters;
  onFiltersChange: (filters: AdminUserFilters) => void;
  list: AdminListState<AdminUser>;
  hrefFor: (page: number) => To;
  /** Today in Yerevan, so a day this year is shown without its year. */
  today: string;
  className?: string;
}

/**
 * Everyone with an account, the newest first, to look through: guests, restaurant owners and
 * Seghan's own team, each with what they've done here. Accounts are their owners' own, so there's
 * nothing to change here.
 */
export function AdminUsers({
  filters,
  onFiltersChange,
  list,
  hrefFor,
  today,
  className,
}: AdminUsersProps): ReactElement {
  const change = (next: Partial<AdminUserFilters>): void =>
    onFiltersChange({ ...filters, ...next, page: 1 });

  return (
    <div className={cx("flex flex-col gap-8", className)}>
      <AdminFilterBar
        key={filters.q ?? ""}
        label="Users"
        q={filters.q}
        placeholder="Name or email"
        onSearch={(q) => change({ q })}
        choices={1}
      >
        <Select
          label="Role"
          value={filters.role ?? ""}
          onChange={(event) => change({ role: oneOf(USER_ROLES, event.target.value) })}
        >
          <option value="">Everyone</option>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_CHOICES[role]}
            </option>
          ))}
        </Select>
      </AdminFilterBar>

      <AdminListBody
        list={list}
        words={words}
        filtered={isFiltered(filters)}
        onClearFilters={() => onFiltersChange({ page: 1 })}
        onFirstPage={() => onFiltersChange({ ...filters, page: 1 })}
        hrefFor={hrefFor}
      >
        {(users) => (
          <ul className="border-t border-line">
            {users.map((user) => (
              <UserLine key={user.id} user={user} today={today} />
            ))}
          </ul>
        )}
      </AdminListBody>
    </div>
  );
}

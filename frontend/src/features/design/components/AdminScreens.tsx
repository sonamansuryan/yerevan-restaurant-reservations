import { useState } from "react";
import type { ReactElement } from "react";

import type { AdminRestaurantFilters } from "@/features/admin/admin";
import { AdminNav } from "@/features/admin/components/AdminNav";
import type { AdminListState } from "@/features/admin/components/AdminListBody";
import { AdminReservations } from "@/features/admin/components/AdminReservations";
import type { AdminReservationsProps } from "@/features/admin/components/AdminReservations";
import { AdminRestaurants } from "@/features/admin/components/AdminRestaurants";
import type { AdminRestaurantsProps } from "@/features/admin/components/AdminRestaurants";
import { AdminUsers } from "@/features/admin/components/AdminUsers";
import type { AdminUsersProps } from "@/features/admin/components/AdminUsers";
import { Group, Specimens } from "@/features/design/components/parts";
import {
  adminReservations,
  adminRestaurants,
  adminUsers,
  dolmamaListed,
  hiddenTbilisi,
} from "@/features/design/samples";
import type { screenStates } from "@/features/design/tokens";
import { ApiError } from "@/lib/api";
import type { AdminRestaurant } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
const TODAY = "2026-11-11";
const NOW = "2026-11-11T08:00:00.000Z";
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);

function loaded<T>(data: T[], total = data.length, page = 1): AdminListState<T> {
  return {
    data: { data, meta: { page, pageSize: 20, total } },
    failed: false,
    retrying: false,
    onRetry: ignore,
    updating: false,
  };
}
const loading: AdminListState<never> = { ...loaded([]), data: undefined };
const failed: AdminListState<never> = { ...loading, failed: true };

const lori = adminRestaurants[1]!;
const hiddenLori: AdminRestaurant = { ...lori, hiddenAt: NOW };
const shownTbilisi: AdminRestaurant = { ...hiddenTbilisi, hiddenAt: null };
const replaced = (one: AdminRestaurant): AdminRestaurant[] =>
  adminRestaurants.map((each) => (each.id === one.id ? one : each));

/** The restaurants part as the page shows it, with anything changed for a state. */
function restaurants(change: Partial<AdminRestaurantsProps> = {}): ReactElement {
  return (
    <AdminRestaurants
      filters={{ page: 1 }}
      onFiltersChange={ignore}
      list={loaded(adminRestaurants)}
      hrefFor={() => ({ hash: "#screens" })}
      today={TODAY}
      changingId={null}
      changed={null}
      refusal={null}
      onHide={ignore}
      onShow={ignore}
      {...change}
    />
  );
}

/**
 * Hide asks first, as on the page, then marks the line here instead of sending anything, and Show
 * again clears it. The search and Show filter the samples here too.
 */
function LiveRestaurants(): ReactElement {
  const [rows, setRows] = useState(adminRestaurants);
  const [changed, setChanged] = useState<AdminRestaurant | null>(null);
  const [filters, setFilters] = useState<AdminRestaurantFilters>({ page: 1 });

  function change(one: AdminRestaurant, hiddenAt: string | null): void {
    const done = { ...one, hiddenAt };
    setRows((all) => all.map((each) => (each.id === done.id ? done : each)));
    setChanged(done);
  }

  const shown = rows.filter(
    (one) =>
      (!filters.q || one.name.toLowerCase().includes(filters.q.toLowerCase())) &&
      (filters.show === undefined ||
        (filters.show === "hidden"
          ? one.hiddenAt !== null
          : one.hiddenAt === null && one.isPublished === (filters.show === "published"))),
  );

  return restaurants({
    filters,
    onFiltersChange: (next) => {
      setFilters(next);
      setChanged(null);
    },
    list: loaded(shown),
    changed,
    onHide: (one) => change(one, NOW),
    onShow: (one) => change(one, null),
  });
}

const restaurantStates: Record<StateOf<"adminRestaurants">, ReactElement> = {
  "Every restaurant (live)": <LiveRestaurants />,
  Hiding: restaurants({ changingId: lori.id }),
  Hidden: restaurants({ list: loaded(replaced(hiddenLori)), changed: hiddenLori }),
  "Shown again": restaurants({ list: loaded(replaced(shownTbilisi)), changed: shownTbilisi }),
  "Shown again, a draft": restaurants({
    list: loaded(replaced({ ...shownTbilisi, isPublished: false })),
    changed: { ...shownTbilisi, isPublished: false },
  }),
  "Couldn’t change": restaurants({ refusal: noConnection }),
  "Only the hidden ones": restaurants({
    filters: { show: "hidden", page: 1 },
    list: loaded([hiddenTbilisi]),
  }),
  // A real restaurant listed from public data (9.7), owned by the account nobody signs in to.
  "With a demo listing": restaurants({
    list: loaded([dolmamaListed, ...adminRestaurants.slice(0, 2)]),
  }),
  "No restaurants match": restaurants({
    filters: { q: "khorovats", show: "draft", page: 1 },
    list: loaded([]),
  }),
  "No restaurants yet": restaurants({ list: loaded([]) }),
  Loading: restaurants({ list: loading }),
  "Couldn’t load": restaurants({ list: failed }),
  "Past the last page": restaurants({ filters: { page: 3 }, list: loaded([], 26, 3) }),
};

function reservations(change: Partial<AdminReservationsProps> = {}): ReactElement {
  return (
    <AdminReservations
      filters={{ page: 1 }}
      onFiltersChange={ignore}
      list={loaded(adminReservations)}
      hrefFor={() => ({ hash: "#screens" })}
      today={TODAY}
      {...change}
    />
  );
}

const noShow = adminReservations.filter(({ status }) => status === "NO_SHOW");

const reservationStates: Record<StateOf<"adminReservations">, ReactElement> = {
  "Every booking": reservations(),
  "One day’s no-shows": reservations({
    filters: { status: "NO_SHOW", date: "2026-11-09", page: 1 },
    list: loaded(noShow),
  }),
  "No reservations match": reservations({
    filters: { q: "Gyumri", status: "ARRIVED", page: 1 },
    list: loaded([]),
  }),
  "No reservations yet": reservations({ list: loaded([]) }),
  Loading: reservations({ list: loading }),
  "Couldn’t load": reservations({ list: failed }),
};

function users(change: Partial<AdminUsersProps> = {}): ReactElement {
  return (
    <AdminUsers
      filters={{ page: 1 }}
      onFiltersChange={ignore}
      list={loaded(adminUsers)}
      hrefFor={() => ({ hash: "#screens" })}
      today={TODAY}
      {...change}
    />
  );
}

const userStates: Record<StateOf<"adminUsers">, ReactElement> = {
  Everyone: users(),
  "Owners only": users({
    filters: { role: "OWNER", page: 1 },
    list: loaded(adminUsers.filter(({ role }) => role === "OWNER")),
  }),
  "No users match": users({ filters: { q: "gor@", page: 1 }, list: loaded([]) }),
  Loading: users({ list: loading }),
  "Couldn’t load": users({ list: failed }),
};

// The parts' links start at this page's address, so the first, Restaurants, shows as open.
const header: Record<StateOf<"adminHeader">, ReactElement> = {
  "Restaurants open": <AdminNav headingLevel={4} sectionsBase="/design" specimen />,
};

/** Seghan's admin area, /admin, for admins only: everyone else is told it's for Seghan's team. */
export function AdminScreens(): ReactElement {
  return (
    <>
      <Group
        title="The admin area"
        note="For Seghan's team only, from the Admin link in the main links. Anyone else signed in is told the page is for Seghan's team, and the API refuses them too. The same back office as the dashboard: the dark menu beside each part, and its rows in white panels, with the search and filters in the address, as on Browse, so Back and shared links work."
      >
        <Specimens wide specimens={header} />
      </Group>
      <Group
        title="Restaurants"
        note="/admin: every restaurant, drafts included, by name, with its owner and what guests see. Hide asks first, because guests lose the restaurant at once: they can't find, open, book or save it, whatever its owner chooses, while its bookings stay. Show again happens at once, and the owner's own choice, published or a draft, applies again. The notice says what happened, since the line may leave a filtered list. In the live one, the question opens over the page, and both change the line here without sending anything."
      >
        <Specimens wide specimens={restaurantStates} />
      </Group>
      <Group
        title="Reservations"
        note="/admin/reservations: every booking, the latest start first, on its restaurant's day and clock. Only to look through: guests and restaurants change their own. A day is a Yerevan day; a status or a whole date applies at once, and the search when it's sent."
      >
        <Specimens wide specimens={reservationStates} />
      </Group>
      <Group
        title="Users"
        note="/admin/users: everyone with an account, the newest first, with a guest's bookings or an owner's restaurants. Only to look through: no password, Google id or session ever leaves the server."
      >
        <Specimens wide specimens={userStates} />
      </Group>
    </>
  );
}

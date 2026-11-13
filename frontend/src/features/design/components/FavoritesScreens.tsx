import { useState } from "react";
import type { ReactElement } from "react";

import { LinkButton } from "@/components/Button";
import { Group, Specimens } from "@/features/design/components/parts";
import { sampleRestaurants } from "@/features/design/samples";
import type { screenStates } from "@/features/design/tokens";
import { returnStateFor } from "@/features/auth/returnTo";
import { MyFavorites } from "@/features/favorites/components/MyFavorites";
import type {
  FavoriteChange,
  FavoriteListState,
  MyFavoritesProps,
} from "@/features/favorites/components/MyFavorites";
import { SaveRestaurant } from "@/features/favorites/components/SaveRestaurant";
import type { SaveViewer } from "@/features/favorites/components/SaveRestaurant";
import { ApiError } from "@/lib/api";
import type { RestaurantSummary } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
const noConnection = new ApiError(
  0,
  "NETWORK_ERROR",
  "We can't reach the server right now. Please try again.",
);

/** The top of a restaurant's page, as there: the way back, and saving it. */
function Top({ viewer }: { viewer: SaveViewer }): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <LinkButton variant="link" to="/design">
        All restaurants
      </LinkButton>
      <SaveRestaurant name="Lori Smokehouse" viewer={viewer} />
    </div>
  );
}

const guest = (change: Partial<Extract<SaveViewer, { kind: "guest" }>> = {}): SaveViewer => ({
  kind: "guest",
  saved: false,
  saving: false,
  error: null,
  onToggle: ignore,
  ...change,
});

/** Saving and unsaving here only, as the page would after the server said yes. */
function LiveSave(): ReactElement {
  const [saved, setSaved] = useState(false);
  return <Top viewer={guest({ saved, onToggle: () => setSaved(!saved) })} />;
}

const saveRestaurant: Record<StateOf<"saveRestaurant">, ReactElement> = {
  "Signed out": (
    <Top
      viewer={{
        kind: "signedOut",
        signIn: returnStateFor({ pathname: "/restaurants/lori-smokehouse", search: "", hash: "" }),
      }}
    />
  ),
  "Not saved (live)": <LiveSave />,
  Checking: <Top viewer={guest({ saved: undefined })} />,
  Saving: <Top viewer={guest({ saving: true })} />,
  Saved: <Top viewer={guest({ saved: true })} />,
  "Couldn’t save": <Top viewer={guest({ error: noConnection })} />,
};

// Lilit's favorites: four of the demo restaurants, the last saved first.
const favorites = [2, 3, 1, 5].flatMap((index) => sampleRestaurants[index] ?? []);
const nurr = favorites[0]!;

function loaded(data: RestaurantSummary[], total = data.length, at = 1): FavoriteListState {
  return {
    data: { data, meta: { page: at, pageSize: 12, total } },
    failed: false,
    retrying: false,
    onRetry: ignore,
  };
}

/** My favorites as the page shows it, with anything changed for a state. */
function screen(change: Partial<MyFavoritesProps> = {}): ReactElement {
  return (
    <MyFavorites
      page={1}
      list={loaded(favorites)}
      hrefFor={() => ({ hash: "#screens" })}
      changingSlug={null}
      changed={null}
      refusal={null}
      onRemove={ignore}
      onUndo={ignore}
      onFindARestaurant={ignore}
      onFirstPage={ignore}
      cardHeading="h4"
      {...change}
    />
  );
}

/** Taking one out removes its card here, and Undo puts it back where it was. */
function LiveFavorites(): ReactElement {
  const [shown, setShown] = useState(favorites);
  const [changed, setChanged] = useState<FavoriteChange | null>(null);
  return screen({
    list: loaded(shown),
    changed,
    onRemove: (restaurant) => {
      setShown((all) => all.filter(({ slug }) => slug !== restaurant.slug));
      setChanged({ restaurant, saved: false });
    },
    onUndo: (restaurant) => {
      // Saved again, so it's now the last saved, at the top, as the page puts it.
      setShown((all) => [restaurant, ...all.filter(({ slug }) => slug !== restaurant.slug)]);
      setChanged({ restaurant, saved: true });
    },
  });
}

const withoutNurr = favorites.slice(1);

const myFavorites: Record<StateOf<"myFavorites">, ReactElement> = {
  "Saved restaurants (live)": <LiveFavorites />,
  Removing: screen({ changingSlug: nurr.slug }),
  "Removed, with Undo": screen({
    list: loaded(withoutNurr),
    changed: { restaurant: nurr, saved: false },
  }),
  "Back in favorites": screen({ changed: { restaurant: nurr, saved: true } }),
  "Couldn’t remove": screen({ refusal: noConnection }),
  "No favorites yet": screen({ list: loaded([]) }),
  Loading: screen({ list: { data: undefined, failed: false, retrying: false, onRetry: ignore } }),
  "Couldn’t load": screen({
    list: { data: undefined, failed: true, retrying: false, onRetry: ignore },
  }),
  "Past the last page": screen({ page: 3, list: loaded([], 14, 3) }),
};

/** Favorites: saving a restaurant from its page, and the guest's My favorites, /favorites. */
export function FavoritesScreens(): ReactElement {
  return (
    <>
      <Group
        title="Saving a restaurant"
        note="At the top of a restaurant's page, opposite All restaurants. A guest gets the Save toggle; someone signed out is offered Sign in to save, and comes back to the page afterwards. Owners and admins have no favorites, so nothing shows for them, nor while the app checks who's signed in."
      >
        <Specimens specimens={saveRestaurant} />
      </Group>
      <Group
        title="My favorites"
        note="For guests only, linked from the main links and the footer. The restaurants a guest saved, the last saved first, as cards like Browse's, each keeping its Saved toggle. Pressing it takes the restaurant out, and the notice offers Undo, which saves it again, so it comes back at the top. In the live one, both happen here without sending anything."
      >
        <Specimens wide specimens={myFavorites} />
      </Group>
    </>
  );
}

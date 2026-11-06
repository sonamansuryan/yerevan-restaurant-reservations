import { useEffect } from "react";

import { forceStates } from "@/features/design/tools";

/** Turns on the frozen examples, and keeps them working while index.css is being edited. */
export function useForcedStates(): void {
  // Saving the CSS replaces the sheet, and the copied rules with it, so they're made again.
  useEffect(() => {
    forceStates();
    import.meta.hot?.on("vite:afterUpdate", forceStates);
    return () => import.meta.hot?.off("vite:afterUpdate", forceStates);
  }, []);
}

// A new restaurant's dashboard opens with this in the history state, so its Information page can
// say it was added and what comes next. State, not the address, so a bookmark never repeats it.

export const JUST_ADDED = { justAdded: true } as const;

/** Whether the page was opened straight after adding the restaurant. */
export function wasJustAdded(state: unknown): boolean {
  return typeof state === "object" && state !== null && "justAdded" in state;
}

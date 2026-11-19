---
description: Adds or changes a screen in Seghan's React frontend, in order - components with every state in /design, the data hook, the page and the tests. Use when a task needs a new or changed page, component or UI state.
---

## Where things stand

!`ls frontend/src/features frontend/src/pages`

## First

Agree the screen's layout and its states, which can be a quick browser preview. A significant UI/UX change needs approval before it's built. The rules are in `.claude/rules/frontend.md`; this skill is the order of work.

## Steps

Copy the shape of a small feature: `frontend/src/features/favorites/`.

1. **Response types** come from `frontend/src/types/api.ts`, which the backend change fills in (the `new-endpoint` skill).
2. **Components** in `features/<name>/components/`: they get their data and state as props, so every state can be shown. Reuse `frontend/src/components/` first; a new visual pattern becomes a shared component there.
3. **`/design`:** add the screen in its states (loading, empty, error, field errors, sending, success, not allowed, and its own errors) to a `*Screens.tsx` in `features/design/components/`, listed in `ScreensSection.tsx`, with sample data from `features/design/samples.ts`. A new token or shared component also goes in `features/design/tokens.ts`.
4. **Data:** query keys and addresses in `features/<name>/<name>.ts`, like `favoriteKeys` in `favorites.ts`. The hook in `features/<name>/hooks/` uses TanStack Query, sends requests through `lib/api.ts`, and invalidates its keys after a change.
5. **Page** in `frontend/src/pages/`: thin, joining the hook to the components. A new address goes in `frontend/src/router.tsx`.

## Checks

- **Component tests** beside each component, starting with `// @vitest-environment jsdom`.
- **Accessibility:** labels, visible focus, keyboard use, `alt` text, 44 px targets and 4.5:1 contrast.
- **In the browser,** with the `browser-check` skill, on its own ports. Show a significant change there before it's approved.
- Then `npm run typecheck`, `npm run lint` and `npm test`.

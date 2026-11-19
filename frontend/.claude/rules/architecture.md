---
paths:
  - "**/*"
---

# Frontend: architecture

The frontend's own rules: React, the Seghan design and `/design`. They add to the shared rules in `.claude/rules/general-rules.md`, and each one loads when Claude reads or edits a file in `frontend/` that it applies to.

- **Where things live:**
  - `src/main.tsx` · `src/router.tsx` · `src/index.css` (the design tokens)
  - `src/lib/`: api.ts (every request) · queryClient.ts · cx.ts · images.ts · time.ts
  - `src/components/`: shared UI, including EmptyState and ErrorState
  - `src/features/<name>/`: components/ and hooks/ per feature; `design/` is the /design page
  - `src/pages/`: one per address, kept thin
  - `src/types/api.ts`: API response types
- **Pages stay thin;** logic lives in `features/*/hooks`. Feature components receive their data and state as props, so `/design` can show every state.
- **Server data** goes through TanStack Query, with keys like `["availability", slug, date, partySize]`. Invalidate after changes, and never copy server data into `useState`.
- **Requests:** every request goes through `lib/api.ts`, which sends cookies and types the reply. On a `401`, it refreshes once and retries.

## Version gotchas

- **React Router 8:** import from `react-router`. Only `RouterProvider` comes from `react-router/dom`.

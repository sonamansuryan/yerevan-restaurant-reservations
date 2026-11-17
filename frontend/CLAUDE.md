# Frontend rules

The frontend's own rules: React, the Seghan design and `/design`. They add to the shared rules in `.claude/rules/general-rules.md`, and load when Claude reads or edits a file in `frontend/`.

## Where things live

- `src/main.tsx` · `src/router.tsx` · `src/index.css` (the design tokens)
- `src/lib/`: api.ts (every request) · queryClient.ts · cx.ts · images.ts · time.ts
- `src/components/`: shared UI, including EmptyState and ErrorState
- `src/features/<name>/`: components/ and hooks/ per feature; `design/` is the /design page
- `src/pages/`: one per address, kept thin
- `src/types/api.ts`: API response types

## Code

- **Pages stay thin;** logic lives in `features/*/hooks`. Feature components receive their data and state as props, so `/design` can show every state.
- **Server data** goes through TanStack Query, with keys like `["availability", slug, date, partySize]`. Invalidate after changes, and never copy server data into `useState`.
- **Requests:** every request goes through `lib/api.ts`, which sends cookies and types the reply. On a `401`, it refreshes once and retries.
- **Forms** use React Hook Form with Zod. Every field has a visible label and error message.
- **Styling:** Tailwind, mobile-first. Extract a component instead of repeating long class lists.
- **Accessibility:** semantic HTML, labels, visible focus, keyboard-friendly pickers, `alt` text, 44 px touch targets and 4.5:1 text contrast.
- **States:** every request shows loading, empty and error states. On `409 SLOT_TAKEN`, refetch availability and tell the person the table was just taken.
- **Images** use Cloudinary URLs with `f_auto,q_auto` and a width.

## UI/UX: the Seghan design

**Direction:**
- **Feel:** Seghan should feel like a good restaurant: warm, welcoming and confident. (*Seghan* is Armenian for table.)
- **The look** is the approved design (`PROJECT_PLAN.md` §6): warm off-white pages and white cards with soft corners, Bricolage Grotesque for the logo and every heading, Inter for text, and one wine for the brand and the booking actions.
- **The logo** is a wine square holding a table with a covered dish, then lowercase `seghan`. The favicon is the same mark.
- **Focus:** each screen has one clear next step.
- **Motion** is subtle, and stops for people who ask for less.
- **Details:** `֏`, Armenian names and long names render well.
- **The owner's dashboard and the admin area** share a full-height dark menu (`OfficeLayout`): denser than the guest pages, but never a generic admin panel.

**Rules:**
- **Usability first:** readability and accessibility outrank every visual idea, and nothing may slow a booking.
- **Tokens only:** colors, fonts, radii and shadows come from the `@theme` tokens in `frontend/src/index.css`. The frozen `state-card` block below is the one exception.
- **Shared components first:** a new visual pattern becomes a component in `frontend/src/components/`. It passes extra attributes through to its element, so `/design` can show its hover, focus and pressed states.
- **`/design` is the central UI/UX reference.** It's development-only and uses the real components with sample data. A change isn't done until its screens are in `/design`. It shows:
  - every token and shared component. Add new ones to `features/design/tokens.ts`; a test fails if one is missing.
  - each feature's screens in their key states: loading, empty, error, field errors, sending, success, not allowed, and the feature's own errors.
  - the main flows.
- **A new screen:** agree a quick layout, which can be a temporary browser preview. Then build it with its states in `/design`, and only then connect it.
- **Significant UI/UX changes need approval first:**
  - Significant means a new screen's layout, a token value, a shared component's look, a change to an approved design, or anything that changes how a screen works.
  - Show the change in the browser, then wait for approval.
  - Minor visual adjustments, such as spacing, alignment or small fixes within the agreed design, don't need approval. List them in the change's summary.
- **Distinctive ideas** are welcome but not required. They come from layout, type or interaction, never from decoration or clever wording.
- **Limits:** no paper textures, script fonts, ornaments, generic templates, heavy decoration, needless gradients or dated effects. Places at every price, from ֏ to ֏֏֏֏, get the same care.

**Protected designs.** `EmptyState` and `ErrorState` keep their approved look on purpose. They don't follow the current design, and token changes don't reach them. Never restyle them or change these values unless explicitly asked:

| Part | Stays as |
|---|---|
| Layout | Centered, with a 1 px border, a 16 px radius, and padding of 48 px top and bottom, 24 px at the sides |
| Type | Title in 24 px Instrument Serif, text in 14 px Geist |
| Icon | The 28 px alert icon on `ErrorState` |
| Button | 46 px tall, 10 px radius, in Geist, centered below the text, with its own hover, focus ring and 2 px loading ring |

The values are frozen in the `state-card` block in `index.css`. `Button`'s `classic` look is for these two components only. `protected.test.tsx` fails if a frozen value changes.

## Testing

- **Component tests** sit beside their component, start with `// @vitest-environment jsdom`, and use Testing Library. jsdom lacks `showModal()`, so check `Modal` in a browser.

## Version gotchas

- **React Router 8:** import from `react-router`. Only `RouterProvider` comes from `react-router/dom`.
- **Tailwind 4:** use the `@tailwindcss/vite` plugin, `@import "tailwindcss";` and `@theme` tokens. There's no `tailwind.config.js`.

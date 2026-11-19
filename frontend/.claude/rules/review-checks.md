---
paths:
  - "**/*"
---

# Frontend: review checks

The questions a frontend change is reviewed against. Each one comes from the file named after it, and that's where the rule itself is written; the checks add nothing to it. When a check applies to a change, read its file for the full rule.

- **Pages:** is the page thin, with its logic in `features/*/hooks` and feature components getting their data and state as props? (`architecture.md`)
- **Server data:** does it go through TanStack Query, with keys invalidated after changes, and is it never copied into `useState`? (`architecture.md`)
- **Requests:** does every request go through `lib/api.ts`? (`architecture.md`)
- **Types:** do response types come from `src/types/api.ts`, updated in the same change as the server? (`general-rules.md` TypeScript)
- **Forms:** do they use React Hook Form with Zod, with a visible label and error message on every field? (`components.md`)
- **States:** does every request show loading, empty and error states, and does `409 SLOT_TAKEN` refetch availability and tell the person? (`components.md`)
- **Styling:** is it Tailwind, mobile-first, with long repeated class lists extracted into a component, and colors, fonts, radii and shadows only from the `@theme` tokens? (`components.md`; `design.md`)
- **Shared components:** does a new visual pattern become a component in `src/components/` that passes extra attributes through? (`components.md`)
- **`/design`:** are new or changed screens there in their key states, and new tokens or shared components in `features/design/tokens.ts`? (`design.md`)
- **Images:** do they use Cloudinary URLs with `f_auto,q_auto` and a width? (`components.md`)
- **Accessibility:** semantic HTML, labels, visible focus, keyboard-friendly pickers, `alt` text, 44 px touch targets and 4.5:1 text contrast? (`components.md`)
- **Design:** does usability come first; is motion subtle and stopped for people who ask for less; do `֏`, Armenian names and long names render well; and does nothing from the limits appear? (`design.md`)
- **Approval:** was a significant UI/UX change shown in the browser and approved first, and are minor adjustments listed in the change's summary? (`design.md`)
- **Protected designs:** are `EmptyState`, `ErrorState` and the frozen values in the `state-card` block unchanged, unless explicitly asked, and is `Button`'s `classic` look used by these two components only? (`protected-designs.md`)
- **Writing:** are headings functional outside branding, the homepage and key marketing sections, do buttons say what they do, and do people see `Seghan` and the logo `seghan`? (`general-rules.md` Writing)
- **Secrets:** does the frontend hold none, since every `VITE_*` value ends up in public JavaScript? (`general-rules.md` Security)
- **Imports and versions:** does the client use the `@/` alias, React Router from `react-router` (only `RouterProvider` from `react-router/dom`), and Tailwind 4's `@theme` tokens with no `tailwind.config.js`? (`architecture.md`; `components.md`; `general-rules.md` TypeScript)
- **Tests:** are component tests beside their component, starting with `// @vitest-environment jsdom`, and is `Modal` checked in a browser? (`testing.md`)
- **Commands:** do `npm run typecheck`, `npm run lint` and `npm test` pass? (`general-rules.md` Working together)

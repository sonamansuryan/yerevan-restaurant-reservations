---
paths:
  - "src/components/**/*"
  - "src/features/**/*"
  - "src/pages/**/*"
  - "src/**/*.css"
  - "src/lib/images.ts"
  - "vite.config.ts"
---

# Frontend: components

- **Forms** use React Hook Form with Zod. Every field has a visible label and error message.
- **Styling:** Tailwind, mobile-first. Extract a component instead of repeating long class lists.
- **States:** every request shows loading, empty and error states. On `409 SLOT_TAKEN`, refetch availability and tell the person the table was just taken.
- **Images** use Cloudinary URLs with `f_auto,q_auto` and a width.
- **Shared components first:** a new visual pattern becomes a component in `frontend/src/components/`. It passes extra attributes through to its element, so `/design` can show its hover, focus and pressed states.
- **Accessibility:** semantic HTML, labels, visible focus, keyboard-friendly pickers, `alt` text, 44 px touch targets and 4.5:1 text contrast.

## Version gotchas

- **Tailwind 4:** use the `@tailwindcss/vite` plugin, `@import "tailwindcss";` and `@theme` tokens. There's no `tailwind.config.js`.

---
paths:
  - "src/components/**/*"
  - "src/features/**/*"
  - "src/pages/**/*"
  - "src/**/*.css"
  - "index.html"
  - "public/**/*"
---

# Frontend: the Seghan design

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
- **Significant UI/UX changes need approval first:**
  - Significant means a new screen's layout, a token value, a shared component's look, a change to an approved design, or anything that changes how a screen works.
  - Show the change in the browser, then wait for approval.
  - Minor visual adjustments, such as spacing, alignment or small fixes within the agreed design, don't need approval. List them in the change's summary.
- **Distinctive ideas** are welcome but not required. They come from layout, type or interaction, never from decoration or clever wording.
- **Limits:** no paper textures, script fonts, ornaments, generic templates, heavy decoration, needless gradients or dated effects. Places at every price, from ֏ to ֏֏֏֏, get the same care.

## Design system and `/design`

- **Tokens only:** colors, fonts, radii and shadows come from the `@theme` tokens in `frontend/src/index.css`. The frozen `state-card` block in `protected-designs.md` is the one exception.
- **`/design` is the central UI/UX reference.** It's development-only and uses the real components with sample data. A change isn't done until its screens are in `/design`. It shows:
  - every token and shared component. Add new ones to `features/design/tokens.ts`; a test fails if one is missing.
  - each feature's screens in their key states: loading, empty, error, field errors, sending, success, not allowed, and the feature's own errors.
  - the main flows.
- **A new screen:** agree a quick layout, which can be a temporary browser preview. Then build it with its states in `/design`, and only then connect it.

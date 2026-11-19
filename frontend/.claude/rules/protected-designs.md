---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
---

# Frontend: protected designs

`EmptyState` and `ErrorState` keep their approved look on purpose. They don't follow the current design, and token changes don't reach them. Never restyle them or change these values unless explicitly asked:

| Part | Stays as |
|---|---|
| Layout | Centered, with a 1 px border, a 16 px radius, and padding of 48 px top and bottom, 24 px at the sides |
| Type | Title in 24 px Instrument Serif, text in 14 px Geist |
| Icon | The 28 px alert icon on `ErrorState` |
| Button | 46 px tall, 10 px radius, in Geist, centered below the text, with its own hover, focus ring and 2 px loading ring |

The values are frozen in the `state-card` block in `index.css`. `Button`'s `classic` look is for these two components only. `protected.test.tsx` fails if a frozen value changes.

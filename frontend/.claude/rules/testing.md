---
paths:
  - "src/**/*.test.{ts,tsx}"
  - "vite.config.ts"
  - "src/components/Modal.tsx"
---

# Frontend: testing

- **Component tests** sit beside their component, start with `// @vitest-environment jsdom`, and use Testing Library. jsdom lacks `showModal()`, so check `Modal` in a browser.

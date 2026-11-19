---
paths:
  - "**/*.ts"
---

# Backend: conventions

- **Errors:** throw `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) or `ServiceUnavailableError` (503). The reply looks like `{ "error": { "code": "SLOT_TAKEN", "message": "…" } }`.
- **Lists** take `?page=&pageSize=` and return `{ data, meta: { page, pageSize, total } }`.
- **Raw SQL:** use tagged `$queryRaw` templates with quoted identifiers (`"Table"`). Never pass user input to `$queryRawUnsafe`.

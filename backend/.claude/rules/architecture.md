---
paths:
  - "**/*"
---

# Backend: architecture

The backend's own rules: Express, Prisma and PostgreSQL. They add to the shared rules in `.claude/rules/general-rules.md`, and each one loads when Claude reads or edits a file in `backend/` that it applies to.

- **Where things live:**
  - `src/modules/<name>/`: routes · controller · service · schemas (· rules)
  - `src/config/env.ts`: checked settings; the only file that reads `process.env`
  - `src/lib/`: prisma · errors · db-errors · logger · paging · password · time
  - `src/middleware/`: errorHandler · publicDemo · rateLimit · requireAuth · requireRestaurantOwner · requireRole · validate
  - `src/integrations/`: cloudinary · email · geoapify · google · wikimedia
  - `prisma/`: schema.prisma · migrations/ · seed.ts · seed-data.ts · demo-listings/
  - `docker/`: docker-compose.yml (local PostgreSQL 17)
  - `tests/`: fixtures/ · helpers/ · setup/ · fake-prisma.ts · db/ (`npm run test:db` only)
- **Layers:** route (address, middleware, Zod) → controller (request and reply) → service (rules and Prisma). Services never touch `req` or `res`, and controllers never call Prisma.

## Version gotchas

- **Express 5:** errors in async handlers reach the error middleware by themselves. Wildcard routes need a name (`/{*splat}`).

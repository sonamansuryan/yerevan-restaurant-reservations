---
paths:
  - "tests/**/*"
  - "vitest.config.ts"
  - "vitest.db.config.ts"
---

# Backend: testing

| Kind | Tests | Database | Run |
|---|---|---|---|
| **Unit** | Business rules as pure functions (slots, free tables, statuses, time), edge cases included | None | `npm test` |
| **API** | Each endpoint with Supertest: a success, a bad input and a "not allowed". Mock the service, or use the in-memory fake for simple lookups | None | `npm test` |
| **Database** | What only PostgreSQL can prove: the constraint, races, compare-and-set. Required for every change that affects database behavior. The list so far is in `PROJECT_PLAN.md` §5.4 | `yerevan_test` | `npm run test:db -w backend`, with Docker running |

- **Docker:** `npm test` never needs it. `test:db` refuses any database but `yerevan_test`.
- **The existing tests** and `fake-prisma.ts` stay. Don't extend the fake beyond simple lookups; write a database test instead.
- **Test data** lives in `backend/tests/fixtures/`, one file per kind. Outside services are always mocked, and test credentials are always fake.
- **Start times:** a unit test checks that every start time `generateSlots()` lists can actually be booked.

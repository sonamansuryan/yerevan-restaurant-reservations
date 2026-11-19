---
description: Adds or changes an endpoint in Seghan's Express API, in order - Zod schema, service, controller, route, tests and the response type. Use when a task needs a new or changed /api route.
---

## Where things stand

!`ls backend/src/modules`

## First

Agree the endpoint's contract: its method and address, who may call it, its input, its reply and its errors. Then wait for approval. The rules are in `.claude/rules/backend.md` under "Code", "Security" and "Testing"; this skill is the order of work.

## Steps

Copy the shape of a small, complete module: `backend/src/modules/favorites/`.

1. **Schema** in `<name>.schemas.ts`: Zod for the URL, the query and the body.
2. **Service** in `<name>.service.ts`: the rules and Prisma. Owner queries include the owner, replies are mapped instead of returning Prisma models, and refusals throw the errors in `backend/src/lib/errors.ts`.
3. **Controller** in `<name>.controller.ts`: reads the request, calls the service and replies.
4. **Route** in `<name>.routes.ts`: the address, `validate` for each input, and `requireRestaurantOwner` where a restaurant is named. A new router is mounted in `backend/src/app.ts`, where `requireAuth` and `requireRole` guard whole areas such as `/api/owner`.
5. **A schema change** goes first, with the `migration` skill.
6. **The response type** goes in `frontend/src/types/api.ts`, in the same change.

## Checks

- **API tests** in `backend/tests/<name>.test.ts`, with Supertest: a success, a bad input and a "not allowed". Test data comes from `backend/tests/fixtures/`, and requests from `backend/tests/helpers/requests.ts`.
- **Rules as pure functions** get unit tests in `backend/tests/<name>.rules.test.ts`.
- **Database behavior,** such as booking, blocks, tables, statuses or anything that locks, also gets a test in `backend/tests/db/`, run with `npm run test:db -w backend`.
- Then `npm run typecheck`, `npm run lint` and `npm test`.

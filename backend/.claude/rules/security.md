---
paths:
  - "src/**/*"
  - "prisma/**/*.ts"
  - "prisma7.config.ts"
---

# Backend: security

- **Logs** never contain passwords, tokens, cookies or sign-in request bodies. Unexpected errors are logged by type, code and location only (`safeError` in `logger.ts`).
- **Sign-in:**
  - Tokens live only in `httpOnly` cookies, and passwords are hashed with argon2id.
  - `token.service.ts` locks the person's row before changing their refresh tokens; keep it that way.
  - Reusing an old token ends that one session, not the whole account.
- **Google sign-in** never links accounts on an email match alone.
- **Rate limits** protect sign-in and sign-up.
- **Every input** (URL, query and body) is checked with Zod before it reaches a service.
- **Identity** comes from `req.user`, never from the request body. Owner routes check ownership, and their queries include the owner (`where: { id, restaurantId }`). Someone else's restaurant answers `404`.

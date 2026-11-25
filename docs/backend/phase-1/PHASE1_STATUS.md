# Phase 1 Foundation — Status

**Status:** In progress — scaffold complete; cloud provisioning pending  
**Date:** 2026-11-25  
**Baseline:** PRD v1.0 / Phase 0 approved D1–D8

## Completed

- Backend dependencies installed:
  - Hono, Vercel adapter, Node server
  - Drizzle ORM, postgres.js
  - Supabase JWT verification (`jose`)
  - Zod
- 19-table PostgreSQL schema:
  - users / roles / grants
  - customers / services
  - invoices / versions / lines
  - payments / receipts
  - work orders / municipal orders
  - files / notifications / audit
  - number sequences / feature flags
- Initial migration generated:
  - `server/db/migrations/0000_black_jigsaw.sql`
- API foundation:
  - `GET /api/v1/health`
  - `GET /api/v1/health/ready`
  - `GET /api/v1/me` (Supabase JWT)
  - `GET/POST /api/v1/customers`
  - `GET /api/v1/services`
  - `GET /api/v1/users` + `PATCH /api/v1/users/:id` (admin)
  - `GET /api/v1/feature-flags` + `PATCH /api/v1/feature-flags` (admin)
- Server-side permission matrix:
  - invoice_clerk / finance / finance_supervisor
  - CS / CS supervisor
  - admin / admin_staff
  - hidden Sales/clerk roles
- Local API verified:
  - `GET /api/v1/health` returns 200
  - `/me` returns 401 without token
- Tests:
  - Unit 33 passed
  - Typecheck passed
  - Production frontend build passed

## Not yet done / blocked

| Item | Blocker |
|---|---|
| Apply migration to real Postgres | ✅ Applied to Supabase `fijjpbkrsooltxkgrxvf` |
| Seed admin / flags | ✅ Flags seeded; admin public user created |
| End-to-end `/me` | Need a real Supabase session / service role test |
| Admin users / feature flags endpoints | ✅ scaffolded; need authenticated e2e test |
| File upload presign | Need Supabase Storage project |
| Frontend login integration | Need Supabase URL + anon key |
| Staging deploy | Need Vercel env + Supabase access |

## Required credentials

Do not send passwords in chat. Add to local `.env` / Vercel environment:

```text
DATABASE_URL=postgres://...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWKS_URL=https://xxxx.supabase.co/auth/v1/.well-known/jwks.json
```

## Commands

```bash
pnpm api:dev          # local API on :8787
pnpm typecheck
pnpm test
pnpm db:generate
pnpm db:migrate
```

Local check:

```bash
curl http://127.0.0.1:8787/api/v1/health
```

## Files

- `server/app.ts`
- `server/auth.ts`
- `server/guards.ts`
- `server/permissions.ts`
- `server/roles.ts`
- `server/db/schema.ts`
- `server/db/client.ts`
- `server/routes/*`
- `api/[...route].ts`
- `drizzle.config.ts`
- `.env.example`

## Provisioning update (2026-11-25)

- Supabase project: `Helpful-home-staging` (Singapore, Healthy)
- 19 tables applied
- Feature flags seeded:
  - `direct_invoice = true`
  - `sales_workspace = false`
  - `legacy_clerk = false`
- First admin user created in `auth.users` and `public.users`
- DB connection verified with `select 1`
- `/me` still pending a real JWT session

## Next gate

Phase 1 is **not complete** until:

1. Migration applied to staging.
2. A real Supabase user can log in and call `/me`.
3. Server-side permission test passes for at least invoice_clerk, CS, finance and admin.
4. Staging deployment uses Vercel env.
5. Frontend has a login/session foundation.

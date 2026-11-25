# Phase 1 Setup

## 1. Supabase

1. Create a project in the Singapore region.
2. Enable Email auth; disable public sign-up.
3. Create the first Admin user.
4. Copy:
   - Project URL
   - Database connection string (pooled, port 6543 for serverless)
   - Service role key (server only)
   - JWKS URL: `<project-url>/auth/v1/.well-known/jwks.json`

## 2. Local env

Copy `.env.example` to `.env` and fill in:

```text
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_JWKS_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=8787
```

Never commit `.env`.

## 3. Apply schema

```bash
pnpm db:migrate
```

If using Supabase SQL editor instead, inspect and run:

`server/db/migrations/0000_black_jigsaw.sql`

## 4. First admin

Insert the Admin user using the Supabase Auth user UUID:

```sql
insert into users (id, email, name, role, active)
values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin', true);
```

Then set central flags:

```sql
insert into feature_flags (key, enabled) values
  ('sales_workspace', false),
  ('legacy_clerk', false),
  ('direct_invoice', true)
on conflict (key) do update set enabled = excluded.enabled;
```

## 5. Local API

```bash
pnpm api:dev
curl http://127.0.0.1:8787/api/v1/health
```

## 6. Vercel

Add the same environment variables to Preview and Production.  
The API is exposed through `api/[...route].ts` at `/api/v1/*`.

`vercel.json` now uses filesystem-first routing so `/api` is not swallowed by the SPA fallback.

## 7. Next implementation

- `/users` admin endpoints
- `/feature-flags`
- Supabase Storage presign
- Frontend login/session
- Staging verification

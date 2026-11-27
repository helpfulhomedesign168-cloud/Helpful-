# Phase 6 — Production Cutover Checklist

**Status:** Ready for review, not merged  
**PR:** #80  
**Staging project:** `fijjpbkrsooltxkgrxvf`

## 1. Pre-merge

- [x] PR checks green
- [x] Typecheck
- [x] Unit tests (34)
- [x] Full E2E (67 passed locally)
- [x] Migrations 0000–0005 applied to staging
- [x] 38 services seeded
- [x] Feature flags:
  - `direct_invoice = true`
  - `sales_workspace = false`
  - `legacy_clerk = false`
- [x] Vercel env in Production + Preview:
  - DATABASE_URL
  - SUPABASE_URL
  - SUPABASE_JWKS_URL
  - SUPABASE_SERVICE_ROLE_KEY
- [x] Storage bucket `work-order-photos`
- [x] Admin user mapped to `public.users`
- [ ] Merge PR to `main`
- [ ] Production deployment green
- [ ] Confirm `main` env points to production DB (currently staging DB)
- [x] Co-locate API functions with DB: Vercel `sin1` (Singapore)
- [x] 15s client GET cache; clears on write/login/logout

## 2. Post-deploy smoke test

### Auth

- [ ] Open production URL
- [ ] Login with admin
- [ ] Refresh page → session remains
- [ ] Logout → login page

### Invoice

- [ ] Create test customer
- [ ] Create self-pay Invoice
- [ ] Check Invoice appears in list
- [ ] Open Invoice detail
- [ ] Print Invoice

### Payment / Receipt

- [ ] Register full/partial payment
- [ ] Confirm receipt
- [ ] Open printable receipt
- [ ] Finance pending flow (pending → validate)

### CS

- [ ] Receive 50% payment → D work order
- [ ] `/handoff` shows unassigned order
- [ ] Assign CS
- [ ] `/orders` detail opens
- [ ] Add assignment + material deduction + photo
- [ ] Complete work order → badge updates

### 8萬

- [ ] Grant Invoice with application no/amount
- [ ] 50% payment → D work order + municipal B
- [ ] Municipal list/detail opens
- [ ] Edit municipal line and save

### Admin

- [ ] Create a new user
- [ ] Disable that user
- [ ] Services create/edit
- [ ] Supplier/contractor create/edit
- [ ] Notifications unread count

## 3. Data / migration

- [ ] Take production DB backup / confirm PITR
- [x] Confirm no QA/test records:
  - [x] invoices = 0
  - [x] customers = 0
  - [x] work_orders = 0
  - [x] users = 1 real admin
- [ ] Remove/rotate test admin credentials if any
- [ ] Confirm real staff roles mapped

## 4. Rollback

- [ ] Vercel rollback to previous production deployment
- [ ] Database PITR / restore plan
- [ ] Revoke/rotate service role key if compromised
- [ ] Do not run destructive migrations backwards

## 5. Known limitations at cutover

- Product styles / cancellation / custom work remain demo-blocked in live mode
- Topbar/page notifications live; no email/push
- No server-side rate limiting / login lockout
- Logout clears client session; server revocation pending
- Vercel deployment protection requires Vercel login for preview
- Production DB currently same Supabase staging project; decide separate prod project before real data

## 6. Sign-off

- [ ] Product owner
- [ ] Accounting
- [ ] CS supervisor
- [ ] Admin


## Verification snapshot (2026-11-27)

```text
public tables: 26
migrations: 9 (0000–0008)
users: 1 (real admin)
invoices: 0
customers: 0
work_orders: 0
services: 38
flags:
  direct_invoice=true
  sales_workspace=false
  legacy_clerk=false
unit: 34 passed
e2e: 67 passed
build: passed
```

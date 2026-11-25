# Phase 2 — Direct Invoice API Status

**Status:** In progress — core invoice create/list/detail/amend implemented  
**Date:** 2026-11-25  
**Branch:** `feat/backend-phase-1`  
**Staging DB:** Supabase `fijjpbkrsooltxkgrxvf`

## Completed

### Schema

- `invoices.sales_name`
- `invoices.supervisor_name`
- `invoices.idempotency_key` (unique)
- Migration `0001_hard_dragon_lord.sql` applied to staging

### API

| Method | Endpoint | Status |
|---|---|---|
| POST | `/api/v1/invoices` | ✅ create + idempotency |
| GET | `/api/v1/invoices` | ✅ list/search/filter |
| GET | `/api/v1/invoices/:id` | ✅ detail + current version/lines |
| POST | `/api/v1/invoices/:id/amendments` | ✅ new version |
| POST | `/api/v1/auth/login` | ✅ BFF login |
| POST | `/api/v1/auth/refresh` | ✅ refresh |

### Business rules implemented

- Invoice number: `DINV` + YYMM + 4-digit sequence
- Transactional sequence allocation
- Customer upsert by phone
- Line amount = quantity × unit price (unless explicit amount)
- Total must be > 0
- Grant fields only allowed for `grant-80k`
- Idempotency-Key returns the same invoice
- Amendment creates a new invoice version
- Amendment blocked with `INVOICE_LOCKED` after:
  - valid payment exists
  - work order exists
- Audit log for create and amend

## Verified

```text
POST /invoices → 201, DINV26110001, total 100000
GET /invoices → 200, 1 record
GET /invoices/:id → 200
POST /amendments → 201, version 2, total 20000
insert valid payment → POST /amendments → 409 INVOICE_LOCKED
```

Test data cleaned up afterwards.

## Not yet done

- Payment / proof / validate endpoints
- 50% release → work order
- Receipts
- PDF / Excel server endpoints
- Frontend switching from localStorage to API
- CS invoice read permission
- Rate limiting / login lockout
- Idempotency for payments and amendments
- API automated integration tests against staging

## Next

1. Payment endpoints + 50% release
2. Receipt endpoint
3. Frontend invoice create/list/detail against API
4. E2E against staging

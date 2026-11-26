# Phase 5 — Frontend Live Invoice Integration

**Status:** In progress — auth + live Invoice list/detail connected  
**Date:** 2026-11-26  
**Branch:** `feat/backend-phase-1`

## Completed

- Frontend API client (`src/api/client.ts`)
- Auth token exposed from AuthProvider
- Live Invoice list:
  - reads `/api/v1/invoices`
  - search / status filter
  - row click to detail
- Live Invoice create:
  - existing direct invoice wizard
  - live mode submits to `POST /api/v1/invoices`
  - discount-adjusted line amounts
  - grant fields mapped to cents
  - returns to live list
- Live Invoice edit/amend:
  - live list pencil entry
  - `/invoices/:id/edit`
  - edit categories, grant fields, customer, lines, reason
  - saves via `POST /api/v1/invoices/:id/amendments`
  - locked invoices return API error
- Live receipt document:
  - `GET /api/v1/receipts/:id`
  - `/documents/receipt/:id` live branch
  - printable receipt with invoice/payment/customer data
  - payment row links to receipt
- Live Invoice payment:
  - register payment from live detail
  - confirm one-step payment
  - reload Invoice and payment list
  - issue receipt button
- Live Invoice detail:
  - reads `/api/v1/invoices/:id`
  - reads `/api/v1/invoices/:id/payments`
  - customer, lines, payment records
- Demo/E2E mode remains localStorage:
  - `VITE_LIVE_AUTH` off in Vite dev
  - existing E2E unaffected
- Production/Preview build uses live mode by default

## Verified

- Temp `invoice_clerk` login
- Live create through existing wizard
- Created real API invoice `DINV26110006`
- Live list showed API invoice `DINV26110005`
- Row click opened `/invoices/:id`
- Detail amount `HK$1,234.00` displayed
- No browser page errors
- Test data cleaned up (0 QA invoices remain)

## Not yet done

- Live Invoice edit/amend form
- Live payment registration/validation UI
- Live receipt document ✅
- CS work order frontend
- Remove local demo data path in production
- Optimistic refresh / cache invalidation
- API error handling for expired token

## Next

1. Live invoice create
2. Live invoice amendment
3. Payment UI
4. CS work order UI
5. Staging E2E

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
  - live mode uses text fields for Sales / Sales supervisor
  - no demo actors (文文／Don／嘉嘉) appear in production
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
- Live CS work orders:
  - `/handoff` live list
  - assign CS via `/staff`
  - `/orders` live list/detail
  - dates/notes/in_progress save
  - complete work order
  - 8萬 grant card on detail
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

- Live payment pending validation for finance
- CS work order frontend ✅ (core flow)
- Remove local demo data path in production
- Optimistic refresh / cache invalidation
- API error handling for expired token
- Vercel preview deployment verification

## Next

1. CS work order UI
2. Live finance pending validation
3. Staging E2E
4. Production cutover checklist

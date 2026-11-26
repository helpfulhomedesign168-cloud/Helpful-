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
- Live Invoice detail:
  - reads `/api/v1/invoices/:id`
  - reads `/api/v1/invoices/:id/payments`
  - customer, lines, payment records
- Demo/E2E mode remains localStorage:
  - `VITE_LIVE_AUTH` off in Vite dev
  - existing E2E unaffected
- Production/Preview build uses live mode by default

## Verified

- Temp admin login
- Live list showed API invoice `DINV26110005`
- Row click opened `/invoices/:id`
- Detail amount `HK$1,234.00` displayed
- No browser page errors
- Test data cleaned up (0 QA invoices remain)

## Not yet done

- Live Invoice create from QuoteEditor
- Live Invoice edit/amend form
- Live payment registration/validation UI
- Live receipt actions
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

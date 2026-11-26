# Phase 3 — Payment, Release and Receipt Status

**Status:** Backend core complete on staging DB  
**Date:** 2026-11-26  
**Branch:** `feat/backend-phase-1`

## Completed

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/v1/invoices/:id/payments` | list payments |
| POST | `/api/v1/invoices/:id/payments` | register payment / one-step confirm |
| POST | `/api/v1/invoices/:id/payments/:paymentId/validate` | finance validates pending payment |
| POST | `/api/v1/invoices/:id/payments/:paymentId/receipt` | issue receipt |

## Business rules

- Payment method: cash / FPS / transfer / cheque
- Payment amount must not exceed invoice total
- Pending payments reserve the amount
- `Idempotency-Key` supported
- Valid payment updates `validPaidCents` and invoice status
- At **50% valid paid**:
  - allocate `D2600xxx` work order
  - status becomes `released`
  - create notification for active CS supervisors
  - 8萬 creates municipal B
- Receipt:
  - only valid payments
  - one receipt per payment
  - number `R-YYMM-0001`

## Verified with staging DB

```text
Invoice DINV26110003, total 100000, 8萬
Payment 50000 (valid)
→ invoice status released
→ work order D2600001 unassigned
→ municipal DINV26110003B
→ receipt R-2611-0001
```

Test data cleaned up.

## Not yet done

- Proof file upload / download (Storage)
- Payment reject / reversal
- Receipt PDF
- Payment schedule API
- Frontend switching to API
- Work order list/assignment API (Phase 4)
- Automated API integration tests

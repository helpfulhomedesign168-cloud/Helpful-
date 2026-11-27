# Phase 4 — CS Work Order API Status

**Status:** Backend core complete on staging DB  
**Date:** 2026-11-26  
**Branch:** `feat/backend-phase-1`

## Completed

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/v1/work-orders` | list/filter work orders |
| GET | `/api/v1/work-orders/:id` | detail + Invoice + customer + lines + grant data |
| POST | `/api/v1/work-orders/:id/assign` | CS supervisor assigns CS |
| PATCH | `/api/v1/work-orders/:id` | start/end date, notes, in_progress |
| POST | `/api/v1/work-orders/:id/complete` | complete work order |

## Rules

- CS can only list/read own assigned work order.
- CS supervisor/admin/finance can list/read all.
- Only `workorder.assign` can assign (CS supervisor/admin).
- Assignment target must be active CS/CS supervisor/admin.
- Completed work order cannot be reassigned or edited.
- Completion:
  - sets `completed_at`
  - writes audit log
  - if balance remains, notifies invoice clerk / finance supervisor
- 8萬 grant fields are included in work order detail.
- Work order fields added:
  - `start_date`
  - `end_date`
  - `notes`

## Verified with staging DB

```text
Payment 50000 → D2600002 unassigned
GET /work-orders → 200, 1 order
POST /assign → assigned
PATCH → in_progress, dates and notes saved
POST /complete → completed
```

Test data cleaned up.

## Not yet done

- Contractor / assignment cost API
- Site photos API
- Material deductions API
- Extra work / variation API
- CS custom work request API
- Frontend switching from localStorage to API
- Automated integration tests for CS roles

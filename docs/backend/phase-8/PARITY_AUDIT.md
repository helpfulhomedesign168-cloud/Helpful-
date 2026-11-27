# Live vs Prototype Parity Audit

Audit date: 2026-11-27  
Reference: prototype commit `e54d5b9`

## Verified parity

- Invoice payment plans, gates, installments, amend regeneration
- Invoice team / additional order / parent relation
- Payment custody / cleared / reject notes
- Customers list/create/edit/detail/history
- Users departments/profile/avatar/password reset
- Suppliers logo/address/2 contacts/categories/product-style flag
- Contractors kind/specialty/trades/scope/fee
- Services categories, price table, linked services, category delete
- Finance pending/all, proof preview, validate/reject
- Product styles catalog: category tabs, supplier cards, series gallery, images
- Work order assignments: contractor picker, lineIds, time, material deduction
- Work order extra works: resource/supplier/category
- Work order dateChanges history
- Cancellation: credit note/signed/transfer proof, completion, invoice refunded, sales/supervisor commission
- Accounting dashboard: KPIs, expenses, commission, net profit, 6-month trend, jobs
- Business orders: year/month/sales/category/status, revenue/expense/margin
- Notifications tabs/cards/mark-read
- Handoff/orders filters

## Remaining mismatches

### Medium

1. ✅ Commission rules completed
   - Invoice discountRate drives low-discount 6/3/2 rates
   - Team B head 1% uses first active `head` user
   - Shared commission helper used by cancellation, accounting, business orders

### Resolved / low

2. ✅ Municipal principal A section
   - Detail returns principal invoice lines with product style
   - UI shows 正單 A table + municipal line editor
   - B/C-specific sections not present in prototype detail reference used

2. **Handoff/order detail visual polish**
   - Domain fields mostly present; page hierarchy differs from prototype

4. ✅ Custom work add-to-catalog
   - Approved custom work can create a service with CW code, category, price, details
   - Request stores catalogServiceId

5. ✅ User login identity accepted
   - Product decision: live uses Supabase email login
   - Username login is waived as an accepted platform difference

### Low

7. MYOB connector intentionally not implemented (prototype also shows unconnected)
8. Some UI copy/section order still differs

## Verification status

- Typecheck/build/unit pass
- Staging data kept clean between tests
- Production must not be treated as final until high items resolved


## Final regression (2026-11-27)

```text
Typecheck: passed
Build: passed
Unit: 34 passed
Full E2E: 67 passed
Staging: 1 admin / 0 invoices / 0 customers / 0 work orders / 38 services
```

## Goal status

Domain parity is complete for the implemented direct-invoice workflow. The following remain before claiming exact prototype parity:

- Low-discount / Team B head commission attribution
- Handoff/order detail visual polish
- Username login (auth platform difference)

Production should not be treated as final until these are reviewed/waived.


## Commission test

```text
Invoice total = 100000 cents
discountRate = 0.9
Team B
Sales = QA Sales
Supervisor = QA Sup
Head = QA Head

Expected commission = 6000 + 2000 + 1000 = 9000 cents
Actual = 9000 cents ✅
```

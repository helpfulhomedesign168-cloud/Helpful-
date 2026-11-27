# Domain Parity Refactor

Source of truth: pre-backend prototype at commit `e54d5b9`.

Rule: backend entities, fields, state transitions and live UI must match the prototype. A live page may not invent a simpler model.

## Status legend

- ✅ parity implemented and tested
- 🟡 field/model added, UI parity pending
- ❌ not started / known logic gap

## Entity mapping

| Prototype | Backend | Status |
|---|---|---|
| Actor | `users` + roles | ✅ profile fields added |
| Customer | `customers` | ✅ |
| Supplier | `suppliers` + `files` | ✅ logo/address/2 contacts/categories/product-style flag |
| Resource (contractor) | `contractors` | ✅ kind/specialty/trades/scope/fee |
| ServiceItem | `services` + `metadata` + `service_categories` | ✅ category management, measure/price/min/linked |
| Invoice | `invoices` + versions + lines | ✅ payment plan + team/add-on + parent relation + create/edit UI |
| Invoice.paymentPlan | `invoice_payment_plan` | ✅ 50/50, 30/20/50, 30/20/30/20 + gates |
| Payment | `payments` | ✅ custody + cleared + validation gate |
| Receipt | `receipts` | ✅ |
| WorkOrder | `work_orders` + assignments/deductions/extra works | 🟡 line-level cost + contractor assignment picker + extra/date history + handoff filters done; detail polish pending |
| ProductStyleSeries | `product_style_series` + images | ✅ |
| MunicipalOrder | `municipal_orders` + lines | 🟡 line measure/dimensions/product-style/sourceLine fields + editor added; A/B/C/detail parity pending |
| CancellationCase | `cancellation_cases` | 🟡 credit-note/signed/transfer proof + completion gate + sales/supervisor commission reversal done; head/low-discount attribution limited by invoice model |
| CustomWorkRequest | `custom_work_requests` | ✅ invoice/invoice-line domain + work-order compatibility |
| Notification | `notifications` | ✅ |
| Audit | `audit_logs` | ✅ |

## Invoice payment plan rules

```text
group-buy:  50 / 50
grant-80k:  30 / 20 / 50
self-pay:   30 / 20 / 30 / 20
```

- Plan generated on invoice create
- Plan regenerated on amend only when no valid/pending payments and no work order
- Payment creation enforces prior installment paid and stage amount
- Installment status:
  - locked
  - awaiting_payment
  - under_review
  - ready_receipt
  - receipted
- Work order released at 50% valid paid

| AccountingDashboard | `/reports/accounting` | ✅ KPI + jobs + 6-month trend + commission + expenses; MYOB remains not connected |
| BusinessOrders | `/reports/business-orders` | ✅ month/year/sales/category/status + revenue/expense/margin/commission columns |

## Remaining parity work

1. Invoice team / additional order / parent relation
2. Payment `cleared` flag and finance parity
3. Custom work domain move to invoice line
4. Work order / handoff UI and transitions
5. Municipal full editor and grant/payment fields
6. Cancellation credit-note / transfer / commission flow
7. Accounting/business reporting parity
8. Live UI parity tests against prototype screenshots

## Verification

- Unit + build
- Targeted API tests with temp data
- Live Playwright parity checks (do not run write tests against shared production/staging after cutover without cleanup)

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

### High

1. ✅ Direct invoice product-style picker now reads live `/product-styles` API
   - API images mapped to product-style snapshots with signed URLs
   - Selected style text persists on invoice_lines.product_style_text

2. **Cancellation commission attribution incomplete**
   - Live invoice has salesName/supervisorName/team but no actor IDs/discount
   - Missing low-discount 6/3/2 rates and Team B head 1%
   - Current: sales 8%, supervisor 4/3%

### Medium

3. ✅ Municipal principal A section
   - Detail returns principal invoice lines with product style
   - UI shows 正單 A table + municipal line editor
   - B/C-specific sections not present in prototype detail reference used

4. **Handoff/order detail layout polish**
   - Domain fields mostly present; page hierarchy differs from prototype

5. **Custom work add-to-catalog**
   - Prototype lets CS supervisor add answered custom work to service catalog
   - Live has approval only; no catalog creation

6. **User login identity**
   - Prototype uses username; live uses Supabase email login
   - This is an intentional auth-platform difference, not required for domain parity unless product wants username login

### Low

7. MYOB connector intentionally not implemented (prototype also shows unconnected)
8. Some UI copy/section order still differs

## Verification status

- Typecheck/build/unit pass
- Staging data kept clean between tests
- Production must not be treated as final until high items resolved

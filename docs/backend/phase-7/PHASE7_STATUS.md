# Phase 7 — Post-cutover Enhancements

## Completed

- Audit log viewer for admin/finance supervisor
- User management prototype parity: department tabs, user list, full profile page, avatar upload
- Admin password reset with one-time temporary password
- Admin system health dashboard
- Admin feature-flag settings UI
- Customer detail with Invoice history
- Invoice list parity: status/sales/sort filters, progress, categories, edit action
- Invoice amend regenerates payment plan and blocks pending payments
- Invoice payment plan parity: group-buy 50/50, grant 30/20/50, self-pay 30/20/30/20; installment lock/status; payment gates
- Finance prototype parity: pending/all tabs, proof review, validate/reject with notes, company/sales custody
- Hover/focus prefetch for Invoice and work order detail
- Live Invoice Excel export
  - uses current API Invoice data
  - client-side ExcelJS workbook
  - HK$ formats
  - no demo/local data
- Phase 6 additions:
  - API functions in Singapore `sin1`
  - 15s GET cache with write invalidation
  - automatic 401 access-token refresh + retry
  - login/logout clears API cache

## Next

- Cancellation / refund live ✅
- Product styles live ✅ (prototype parity: category tabs/supplier cards/series gallery)
- Custom work live ✅
- Cancellation live ✅
- Further optimistic UI / prefetch
- Production DB separation and cutover

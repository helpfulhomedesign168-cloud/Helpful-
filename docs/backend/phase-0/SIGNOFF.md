# Phase 0 Sign-off

**Status:** ✅ APPROVED — all recommended (2026-11-25)  
**Date:** 2026-11-25

回覆「approve all recommended」即可接受以下建議；如要改任何一項，直接寫 D1–D8 的選擇。

- [x] D1 Backend stack
  - Supabase Postgres/Auth/Storage + Vercel API + Drizzle + Zod
- [x] D2 Data migration
  - 先確認有無真實 localStorage 資料；如只有 demo，clean start
- [x] D3 Invoice amendment after payment/release
  - 建議：有 valid payment 或 released work order 後不可直接修改；用 change order／credit note
- [x] D4 Payment proof
  - 非現金付款必需；現金可備註
- [x] D5 8萬 grant fields
  - 可後補；未填顯示「待政府批核」
- [x] D6 Retention
  - 付款／合約文件至少 7 年；相片按公司政策
- [x] D7 Feature flags
  - 中央 DB + Admin UI；不再用 browser localStorage
- [x] D8 Hosting region
  - 香港／新加坡 nearest

**Approved by:** Company (approve all recommended)  
**Date:** 2026-11-25

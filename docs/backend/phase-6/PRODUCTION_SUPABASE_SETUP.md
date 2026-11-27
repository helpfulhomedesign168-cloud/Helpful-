# Production Supabase Setup

> 不要在 chat 貼出任何密碼、service role key 或 connection string。

## 1. Create project

- Supabase Dashboard → New project
- Region: **Southeast Asia (Singapore)**
- 儲存 database password
- 等待 project ready

## 2. Collect values

From Supabase → Project Settings:

- `DATABASE_URL`
  - 建議 Vercel 用 **Transaction pooler**（port 6543）
  - 必須有 `sslmode=require`
- `SUPABASE_URL`
- `SUPABASE_JWKS_URL`
  - `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3. Set Vercel Production env

Vercel → Project → Settings → Environment Variables → **Production only**：

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_JWKS_URL
SUPABASE_SERVICE_ROLE_KEY
```

Preview 可以繼續用 staging；Production 必須用新 production project。

設定後要 **Redeploy** 才會生效。

## 4. Initialise database

建議在本機建立 **gitignored** 的 `.env.production.local`，只放 production values：

```text
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_JWKS_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAIL=...
ADMIN_NAME=...
ADMIN_PASSWORD=...
```

不要把此檔 commit 或貼上 chat。

然後執行：

```bash
pnpm install
set -a; source .env.production.local; set +a
pnpm db:migrate
```

Migrations：0000–0008。

## 5. Create storage buckets + seed services + admin

在同一個 production env 下：

```bash
pnpm prod:setup
```

會自動：

- 建立 private buckets：
  - `work-order-photos`
  - `payment-proofs`
  - `product-style-images`
- Seed 38 services
- 建立第一個 admin（如果未存在）

## 6. Verify

```bash
curl https://<production-domain>/api/v1/health
```

登入後 Admin → 系統狀態：

- DB ok
- Storage ok
- Migrations 9
- Services 38
- Users 1

## 7. Then merge

Production DB ready 後才 merge PR #80：

- Merge 會自動觸發 production deployment
- Deployment 完成後做 smoke test：
  - Login
  - Invoice
  - Payment／Receipt
  - CS engineering
  - 8萬 municipal

## Rollback

- Vercel → Deployments → 上一個 production deployment → Promote
- Database：Supabase PITR / backup restore
- 不要把 destructive migration 反向執行

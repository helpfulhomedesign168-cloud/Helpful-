import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { featureFlags } from "../db/schema";
import { getEnv } from "../env";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const systemRoute = new Hono<AppEnv>();

systemRoute.get(
  "/health",
  requireAuth,
  requireCapability("audit.read"),
  async (c) => {
    const db = getDb();
    const [dbCheck] = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    const [counts] = await db.execute<{
      users: number;
      invoices: number;
      customers: number;
      work_orders: number;
      services: number;
      payments: number;
    }>(sql`
      select
        (select count(*) from users)::int as users,
        (select count(*) from invoices)::int as invoices,
        (select count(*) from customers)::int as customers,
        (select count(*) from work_orders)::int as work_orders,
        (select count(*) from services)::int as services,
        (select count(*) from payments)::int as payments
    `);
    const [migrations] = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    const flags = await db
      .select({ key: featureFlags.key, enabled: featureFlags.enabled })
      .from(featureFlags)
      .orderBy(featureFlags.key);
    const env = getEnv();
    let storage: { bucket: string; ok: boolean; status: number } = {
      bucket: "work-order-photos",
      ok: false,
      status: 0,
    };
    try {
      const res = await fetch(
        `${env.SUPABASE_URL}/storage/v1/bucket/work-order-photos`,
        {
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      storage = {
        bucket: "work-order-photos",
        ok: res.ok,
        status: res.status,
      };
    } catch {
      storage = {
        bucket: "work-order-photos",
        ok: false,
        status: 0,
      };
    }
    return c.json({
      db: { ok: dbCheck.ok === 1 },
      migrations: migrations.count,
      counts,
      flags,
      storage,
      region: process.env.VERCEL_REGION ?? "local",
      now: new Date().toISOString(),
    });
  },
);

import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { customers, invoices } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const reportsRoute = new Hono<AppEnv>();

reportsRoute.get(
  "/summary",
  requireAuth,
  requireCapability("report.read"),
  async (c) => {
    const db = getDb();
    const [totals] = await db
      .select({
        invoiceCount: sql<number>`count(*)::int`,
        billedCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
        collectedCents: sql<number>`coalesce(sum(${invoices.validPaidCents}), 0)::int`,
        outstandingCents: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.validPaidCents}), 0)::int`,
      })
      .from(invoices)
      .where(sql`${invoices.status} not in ('voided','refunded')`);
    const statuses = await db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
      })
      .from(invoices)
      .groupBy(invoices.status);
    const recent = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        createdAt: invoices.createdAt,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(invoices.createdAt))
      .limit(10);
    return c.json({ totals, statuses, recent });
  },
);

reportsRoute.get(
  "/business-orders",
  requireAuth,
  requireCapability("report.read"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        categories: invoices.categories,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        salesName: invoices.salesName,
        createdAt: invoices.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(invoices.createdAt))
      .limit(200);
    return c.json(rows);
  },
);

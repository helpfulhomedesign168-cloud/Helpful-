import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  customers,
  invoices,
  workOrders,
  workOrderAssignments,
  workOrderExtraWorks,
} from "../db/schema";
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


reportsRoute.get(
  "/accounting",
  requireAuth,
  requireCapability("report.read"),
  async (c) => {
    const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "月份格式不正確。" } }, 400);
    }
    const db = getDb();
    const monthInvoices = await db
      .select({
        id: invoices.id,
        number: invoices.number,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        categories: invoices.categories,
        salesName: invoices.salesName,
        supervisorName: invoices.supervisorName,
        team: invoices.team,
        status: invoices.status,
        createdAt: invoices.createdAt,
        customerName: customers.name,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(sql`to_char(${invoices.createdAt}, 'YYYY-MM') = ${month}`);
    const orderRows = await db
      .select({ id: workOrders.id, invoiceId: workOrders.invoiceId, number: workOrders.number, status: workOrders.status })
      .from(workOrders);
    const assignmentRows = await db
      .select({ workOrderId: workOrderAssignments.workOrderId, feeCents: workOrderAssignments.feeCents })
      .from(workOrderAssignments);
    const extraRows = await db
      .select({ workOrderId: workOrderExtraWorks.workOrderId, priceCents: workOrderExtraWorks.priceCents })
      .from(workOrderExtraWorks);
    const orderByInvoice = new Map(orderRows.map((order) => [order.invoiceId, order]));
    const expenseByOrder = new Map<string, number>();
    for (const assignment of assignmentRows) {
      expenseByOrder.set(assignment.workOrderId, (expenseByOrder.get(assignment.workOrderId) ?? 0) + assignment.feeCents);
    }
    for (const extra of extraRows) {
      expenseByOrder.set(extra.workOrderId, (expenseByOrder.get(extra.workOrderId) ?? 0) + extra.priceCents);
    }
    const categoryName = (categories: string[]) =>
      categories.includes("grant-80k") ? "8萬資助" : categories.includes("group-buy") ? "團購" : "自費";
    const jobs = monthInvoices
      .filter((invoice) => !["voided", "refunded"].includes(invoice.status))
      .map((invoice) => {
        const order = orderByInvoice.get(invoice.id);
        const expensesCents = order ? expenseByOrder.get(order.id) ?? 0 : 0;
        const grossProfitCents = invoice.totalCents - expensesCents;
        const commissionCents =
          Math.round(invoice.totalCents * 0.08) +
          (invoice.supervisorName ? Math.round(invoice.totalCents * (invoice.team === "B" ? 0.03 : 0.04)) : 0);
        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.number,
          orderNumber: order?.number ?? null,
          customerName: invoice.customerName,
          salesName: invoice.salesName ?? "—",
          category: categoryName(invoice.categories),
          createdAt: invoice.createdAt,
          revenueCents: invoice.totalCents,
          collectedCents: invoice.validPaidCents,
          outstandingCents: invoice.totalCents - invoice.validPaidCents,
          expensesCents,
          grossProfitCents,
          margin: invoice.totalCents ? Number(((grossProfitCents / invoice.totalCents) * 100).toFixed(1)) : 0,
          commissionCents,
          completed: order?.status === "completed",
        };
      });
    const sum = (key: keyof (typeof jobs)[number]) => jobs.reduce((total, job) => total + Number(job[key] ?? 0), 0);
    const turnoverCents = sum("revenueCents");
    const collectedCents = sum("collectedCents");
    const expensesCents = sum("expensesCents");
    const commissionsCents = sum("commissionCents");
    const trend = Array.from({ length: 6 }, (_, index) => {
      const [year, value] = month.split("-").map(Number);
      const date = new Date(Date.UTC(year, value - 1 - (5 - index), 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      const rows = monthInvoices.filter((invoice) => invoice.createdAt.toISOString().slice(0, 7) === key);
      const revenue = rows.reduce((total, invoice) => total + invoice.totalCents, 0);
      const expense = rows.reduce((total, invoice) => {
        const order = orderByInvoice.get(invoice.id);
        return total + (order ? expenseByOrder.get(order.id) ?? 0 : 0);
      }, 0);
      return { month: key, turnoverCents: revenue, expensesCents: expense, grossProfitCents: revenue - expense };
    });
    return c.json({
      month,
      turnoverCents,
      collectedCents,
      outstandingCents: turnoverCents - collectedCents,
      expensesCents,
      grossProfitCents: turnoverCents - expensesCents,
      commissionsCents,
      netProfitCents: turnoverCents - expensesCents - commissionsCents,
      jobCount: jobs.length,
      completedJobs: jobs.filter((job) => job.completed).length,
      jobs,
      months: trend,
    });
  },
);

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLogs,
  customers,
  customWorkRequests,
  invoiceLines,
  invoiceVersions,
  invoices,
  services,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const createSchema = z
  .object({
    workOrderId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    invoiceLineId: z.string().uuid().optional(),
    description: z.string().trim().min(2).max(500),
    quantity: z.number().positive().max(10000),
    unit: z.string().trim().min(1).max(30),
  })
  .refine((value) => Boolean(value.workOrderId || (value.invoiceId && value.invoiceLineId)), {
    message: "需要工程單或 Invoice 項目。",
  });

const respondSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  priceCents: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const customWorkRoute = new Hono<AppEnv>();

async function resolveRequest(row: typeof customWorkRequests.$inferSelect) {
  let invoiceId = row.invoiceId;
  let orderNumber: string | null = null;
  if (row.workOrderId) {
    const [order] = await getDb()
      .select({ number: workOrders.number, invoiceId: workOrders.invoiceId })
      .from(workOrders)
      .where(eq(workOrders.id, row.workOrderId))
      .limit(1);
    orderNumber = order?.number ?? null;
    invoiceId = invoiceId ?? order?.invoiceId ?? null;
  }
  if (!invoiceId) {
    return { ...row, orderNumber, invoiceNumber: null, customerName: null };
  }
  const [invoice] = await getDb()
    .select({ number: invoices.number, customerName: customers.name })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return {
    ...row,
    orderNumber,
    invoiceNumber: invoice?.number ?? null,
    customerName: invoice?.customerName ?? null,
  };
}

customWorkRoute.get("/", requireAuth, requireCapability("workorder.read"), async (c) => {
  const rows = await getDb()
    .select()
    .from(customWorkRequests)
    .orderBy(desc(customWorkRequests.requestedAt));
  return c.json(await Promise.all(rows.map(resolveRequest)));
});

customWorkRoute.post(
  "/",
  requireAuth,
  requireCapability("custom_work.create"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "自訂工程資料不正確。" } }, 400);
    }
    let workOrderId: string | null = null;
    let invoiceId: string | null = parsed.data.invoiceId ?? null;
    let invoiceLineId: string | null = parsed.data.invoiceLineId ?? null;
    if (parsed.data.workOrderId) {
      const [order] = await getDb()
        .select({ id: workOrders.id, invoiceId: workOrders.invoiceId })
        .from(workOrders)
        .where(eq(workOrders.id, parsed.data.workOrderId))
        .limit(1);
      if (!order) return c.json({ error: { code: "NOT_FOUND", message: "找不到工程單。" } }, 404);
      workOrderId = order.id;
      invoiceId = invoiceId ?? order.invoiceId;
    }
    if (invoiceId) {
      const [invoice] = await getDb()
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);
      if (!invoice) return c.json({ error: { code: "NOT_FOUND", message: "找不到發票。" } }, 404);
      if (invoiceLineId) {
        const [line] = await getDb()
          .select({ id: invoiceLines.id })
          .from(invoiceLines)
          .innerJoin(invoiceVersions, eq(invoiceLines.versionId, invoiceVersions.id))
          .where(and(eq(invoiceLines.id, invoiceLineId), eq(invoiceVersions.invoiceId, invoiceId)))
          .limit(1);
        if (!line) {
          return c.json({ error: { code: "INVALID_LINE", message: "此項目不屬於該發票。" } }, 422);
        }
      }
    }
    const [created] = await getDb()
      .insert(customWorkRequests)
      .values({
        workOrderId,
        invoiceId,
        invoiceLineId,
        description: parsed.data.description,
        quantity: String(parsed.data.quantity),
        unit: parsed.data.unit,
        requestedBy: c.get("user").id,
      })
      .returning();
    return c.json(await resolveRequest(created), 201);
  },
);

customWorkRoute.patch(
  "/:id/respond",
  requireAuth,
  requireCapability("workorder.assign"),
  async (c) => {
    const parsed = respondSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "審批資料不正確。" } }, 400);
    }
    const [request] = await getDb()
      .select()
      .from(customWorkRequests)
      .where(eq(customWorkRequests.id, c.req.param("id")))
      .limit(1);
    if (!request) return c.json({ error: { code: "NOT_FOUND", message: "找不到自訂工程。" } }, 404);
    if (request.status !== "pending") {
      return c.json({ error: { code: "ALREADY_RESPONDED", message: "此申請已處理。" } }, 409);
    }
    const [updated] = await getDb()
      .update(customWorkRequests)
      .set({
        status: parsed.data.status,
        priceCents: parsed.data.priceCents,
        notes: parsed.data.notes,
        respondedBy: c.get("user").id,
        respondedAt: new Date(),
      })
      .where(eq(customWorkRequests.id, request.id))
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "custom_work_responded",
      entityType: "custom_work_request",
      entityId: request.id,
      after: parsed.data,
      requestId: c.get("requestId"),
    });
    return c.json(updated);
  },
);


customWorkRoute.post(
  "/:id/catalog",
  requireAuth,
  requireCapability("workorder.assign"),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const category = typeof body?.category === "string" ? body.category.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const details = typeof body?.details === "string" ? body.details.trim() : "";
    if (!category || !name) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "請填寫分類及工程名稱。" } }, 400);
    }
    const [request] = await getDb()
      .select()
      .from(customWorkRequests)
      .where(eq(customWorkRequests.id, c.req.param("id")))
      .limit(1);
    if (!request) return c.json({ error: { code: "NOT_FOUND", message: "找不到自訂工程。" } }, 404);
    if (request.status !== "approved" || !request.priceCents || request.priceCents <= 0) {
      return c.json({ error: { code: "NOT_APPROVED", message: "需要先批核價錢才可加入價目表。" } }, 422);
    }
    if (request.catalogServiceId) {
      return c.json({ error: { code: "ALREADY_ADDED", message: "此自訂工程已加入價目表。" } }, 409);
    }
    const sequence = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(services);
    let code = `CW${String((sequence[0]?.count ?? 0) + 1).padStart(4, "0")}`;
    const existing = await getDb().select({ id: services.id }).from(services).where(eq(services.code, code)).limit(1);
    if (existing[0]) code = `CW${Date.now().toString().slice(-6)}`;
    const [created] = await getDb()
      .insert(services)
      .values({
        code,
        name,
        category,
        unit: request.unit || "項",
        priceCents: request.priceCents,
        measure: "fixed",
        costMode: "ratio",
        published: true,
        metadata: {
          scope: "",
          details: details || "由自訂工程請示加入",
          needsProductStyle: false,
          minQty: 0,
          minAmount: 0,
          minScope: "line",
          linkedServiceIds: [],
        },
      })
      .returning();
    await getDb()
      .update(customWorkRequests)
      .set({ catalogServiceId: created.id })
      .where(eq(customWorkRequests.id, request.id));
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "custom_work_added_to_catalog",
      entityType: "custom_work_request",
      entityId: request.id,
      after: { serviceId: created.id, code: created.code },
      requestId: c.get("requestId"),
    });
    return c.json(created, 201);
  },
);

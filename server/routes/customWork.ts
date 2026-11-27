import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLogs,
  customers,
  customWorkRequests,
  invoices,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const createSchema = z.object({
  workOrderId: z.string().uuid(),
  description: z.string().trim().min(2).max(500),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().min(1).max(30),
});

const respondSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  priceCents: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const customWorkRoute = new Hono<AppEnv>();

customWorkRoute.get("/", requireAuth, requireCapability("workorder.read"), async (c) => {
  const rows = await getDb()
    .select({
      id: customWorkRequests.id,
      workOrderId: customWorkRequests.workOrderId,
      orderNumber: workOrders.number,
      invoiceNumber: invoices.number,
      customerName: customers.name,
      description: customWorkRequests.description,
      quantity: customWorkRequests.quantity,
      unit: customWorkRequests.unit,
      status: customWorkRequests.status,
      priceCents: customWorkRequests.priceCents,
      notes: customWorkRequests.notes,
      requestedAt: customWorkRequests.requestedAt,
      respondedAt: customWorkRequests.respondedAt,
    })
    .from(customWorkRequests)
    .innerJoin(workOrders, eq(customWorkRequests.workOrderId, workOrders.id))
    .innerJoin(invoices, eq(workOrders.invoiceId, invoices.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .orderBy(desc(customWorkRequests.requestedAt));
  return c.json(rows);
});

customWorkRoute.post(
  "/",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "自訂工程資料不正確。" } }, 400);
    }
    const [order] = await getDb()
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.id, parsed.data.workOrderId))
      .limit(1);
    if (!order) return c.json({ error: { code: "NOT_FOUND", message: "找不到工程單。" } }, 404);
    const [created] = await getDb()
      .insert(customWorkRequests)
      .values({
        workOrderId: order.id,
        description: parsed.data.description,
        quantity: String(parsed.data.quantity),
        unit: parsed.data.unit,
        requestedBy: c.get("user").id,
      })
      .returning();
    return c.json(created, 201);
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

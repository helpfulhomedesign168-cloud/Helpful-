import { Hono } from "hono";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLogs,
  customers,
  invoiceLines,
  invoiceVersions,
  invoices,
  notifications,
  payments,
  users,
  workOrderAssignments,
  workOrderDeductions,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const updateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["in_progress"]).optional(),
});

const assignSchema = z.object({
  csOwnerId: z.string().uuid(),
});

const deductionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amountCents: z.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional(),
});

const assignmentSchema = z.object({
  workerName: z.string().trim().min(1).max(120),
  trade: z.string().trim().max(80).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  feeCents: z.number().int().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional(),
});

const error = (code: string, message: string) => ({
  error: { code, message },
});

function isAdmin(role: string) {
  return role === "admin" || role === "admin_staff";
}

function canSeeOrder(
  user: { id: string; role: string },
  order: { csOwnerId: string | null },
) {
  if (isAdmin(user.role) || user.role === "cs_supervisor") return true;
  if (user.role === "finance" || user.role === "finance_supervisor") return true;
  if (user.role === "cs") return order.csOwnerId === user.id;
  return false;
}

async function orderDetail(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: workOrders.id,
      number: workOrders.number,
      status: workOrders.status,
      csOwnerId: workOrders.csOwnerId,
      csOwnerName: users.name,
      startDate: workOrders.startDate,
      endDate: workOrders.endDate,
      notes: workOrders.notes,
      releasedAt: workOrders.releasedAt,
      completedAt: workOrders.completedAt,
      invoice: {
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        categories: invoices.categories,
        grantApplicationNumber: invoices.grantApplicationNumber,
        grantApprovedAmountCents: invoices.grantApprovedAmountCents,
        currentVersion: invoices.currentVersion,
      },
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        whatsapp: customers.whatsapp,
        address: customers.address,
        district: customers.district,
      },
    })
    .from(workOrders)
    .innerJoin(invoices, eq(workOrders.invoiceId, invoices.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(users, eq(workOrders.csOwnerId, users.id))
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const order = rows[0];
  const version = await db
    .select()
    .from(invoiceVersions)
    .where(
      and(
        eq(invoiceVersions.invoiceId, order.invoice.id),
        eq(invoiceVersions.versionNo, order.invoice.currentVersion),
      ),
    )
    .limit(1);
  const lines = version[0]
    ? await db
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.versionId, version[0].id))
    : [];
  return {
    ...order,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      position: line.position,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
      amountCents: line.amountCents,
    })),
  };
}

export const workOrdersRoute = new Hono<AppEnv>();

workOrdersRoute.get(
  "/",
  requireAuth,
  requireCapability("workorder.read"),
  async (c) => {
    const user = c.get("user");
    const status = c.req.query("status");
    const q = c.req.query("q")?.trim();
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    const conditions = [];
    if (status) conditions.push(eq(workOrders.status, status as never));
    if (user.role === "cs") {
      conditions.push(eq(workOrders.csOwnerId, user.id));
    }
    if (q) {
      conditions.push(
        or(
          ilike(workOrders.number, `%${q}%`),
          ilike(invoices.number, `%${q}%`),
          ilike(customers.name, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
        ),
      );
    }
    const rows = await getDb()
      .select({
        id: workOrders.id,
        number: workOrders.number,
        status: workOrders.status,
        csOwnerId: workOrders.csOwnerId,
        csOwnerName: users.name,
        startDate: workOrders.startDate,
        endDate: workOrders.endDate,
        releasedAt: workOrders.releasedAt,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        categories: invoices.categories,
        customerName: customers.name,
        phone: customers.phone,
        district: customers.district,
      })
      .from(workOrders)
      .innerJoin(invoices, eq(workOrders.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(users, eq(workOrders.csOwnerId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(workOrders.releasedAt))
      .limit(limit);
    return c.json(rows);
  },
);

workOrdersRoute.get(
  "/:id",
  requireAuth,
  requireCapability("workorder.read"),
  async (c) => {
    const detail = await orderDetail(c.req.param("id"));
    if (!detail) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), detail)) {
      return c.json(error("FORBIDDEN", "你沒有查看此工程的權限。"), 403);
    }
    return c.json(detail);
  },
);

workOrdersRoute.post(
  "/:id/assign",
  requireAuth,
  requireCapability("workorder.assign"),
  async (c) => {
    const parsed = assignSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "請選擇有效的 CS 同事。",
          },
        },
        400,
      );
    }
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可重新分配。"), 409);
    }
    const [owner] = await getDb()
      .select({ id: users.id, name: users.name, role: users.role, active: users.active })
      .from(users)
      .where(eq(users.id, parsed.data.csOwnerId))
      .limit(1);
    if (
      !owner ||
      !owner.active ||
      !["cs", "cs_supervisor", "admin"].includes(owner.role)
    ) {
      return c.json(error("INVALID_CS_OWNER", "指定同事不是有效 CS。"), 422);
    }
    const actorId = c.get("user").id;
    await getDb().transaction(async (tx) => {
      await tx
        .update(workOrders)
        .set({
          csOwnerId: owner.id,
          status: order.status === "unassigned" ? "assigned" : order.status,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.id, order.id));
      await tx.insert(notifications).values({
        userId: owner.id,
        title: "新工程安排",
        body: `工程單 ${order.number} 已安排給你。`,
        entityType: "work_order",
        entityId: order.id,
      });
      await tx.insert(auditLogs).values({
        actorId,
        action: "work_order_assigned",
        entityType: "work_order",
        entityId: order.id,
        before: { csOwnerId: order.csOwnerId },
        after: { csOwnerId: owner.id, csOwnerName: owner.name },
        requestId: c.get("requestId"),
      });
    });
    return c.json(await orderDetail(order.id));
  },
);

workOrdersRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可修改。"), 409);
    }
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "工程資料不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const changes = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length === 0) {
      return c.json(error("VALIDATION_ERROR", "沒有可更新欄位。"), 400);
    }
    await getDb()
      .update(workOrders)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(workOrders.id, order.id));
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_updated",
      entityType: "work_order",
      entityId: order.id,
      before: {
        startDate: order.startDate,
        endDate: order.endDate,
        notes: order.notes,
        status: order.status,
      },
      after: changes,
      requestId: c.get("requestId"),
    });
    return c.json(await orderDetail(order.id));
  },
);

workOrdersRoute.post(
  "/:id/complete",
  requireAuth,
  requireCapability("workorder.complete"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有完成此工程的權限。"), 403);
    }
    if (order.status === "completed") return c.json(order);
    const [paid] = await getDb()
      .select({
        total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, order.invoice.id),
          eq(payments.status, "valid"),
        ),
      );
    const remaining = order.invoice.totalCents - Number(paid?.total ?? 0);
    await getDb().transaction(async (tx) => {
      await tx
        .update(workOrders)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(workOrders.id, order.id));
      await tx.insert(auditLogs).values({
        actorId: c.get("user").id,
        action: "work_order_completed",
        entityType: "work_order",
        entityId: order.id,
        after: { number: order.number, remainingCents: remaining },
        requestId: c.get("requestId"),
      });
      if (remaining > 0) {
        const recipients = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              or(eq(users.role, "invoice_clerk"), eq(users.role, "finance_supervisor")),
              eq(users.active, true),
            ),
          );
        if (recipients.length) {
          await tx.insert(notifications).values(
            recipients.map((recipient: { id: string }) => ({
              userId: recipient.id,
              title: "工程完成，請收尾數",
              body: `工程單 ${order.number} 已完成，尚餘 HK$${(remaining / 100).toFixed(2)}。`,
              entityType: "invoice",
              entityId: order.invoice.id,
            })),
          );
        }
      }
    });
    return c.json(await orderDetail(order.id));
  },
);

workOrdersRoute.get(
  "/:id/assignments",
  requireAuth,
  requireCapability("workorder.read"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有查看此工程的權限。"), 403);
    }
    const rows = await getDb()
      .select()
      .from(workOrderAssignments)
      .where(eq(workOrderAssignments.workOrderId, order.id))
      .orderBy(desc(workOrderAssignments.createdAt));
    return c.json(rows);
  },
);

workOrdersRoute.post(
  "/:id/assignments",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可新增施工安排。"), 409);
    }
    const parsed = assignmentSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "施工安排資料不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const [created] = await getDb()
      .insert(workOrderAssignments)
      .values({
        workOrderId: order.id,
        workerName: parsed.data.workerName,
        trade: parsed.data.trade,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        feeCents: parsed.data.feeCents,
        notes: parsed.data.notes,
        createdBy: c.get("user").id,
      })
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_assignment_added",
      entityType: "work_order",
      entityId: order.id,
      after: { workerName: created.workerName, feeCents: created.feeCents },
      requestId: c.get("requestId"),
    });
    return c.json(created, 201);
  },
);

workOrdersRoute.delete(
  "/:id/assignments/:assignmentId",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可修改施工安排。"), 409);
    }
    const deleted = await getDb()
      .delete(workOrderAssignments)
      .where(
        and(
          eq(workOrderAssignments.id, c.req.param("assignmentId")),
          eq(workOrderAssignments.workOrderId, order.id),
        ),
      )
      .returning({ id: workOrderAssignments.id });
    if (!deleted[0]) return c.json(error("NOT_FOUND", "找不到施工安排。"), 404);
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_assignment_deleted",
      entityType: "work_order",
      entityId: order.id,
      before: { assignmentId: deleted[0].id },
      requestId: c.get("requestId"),
    });
    return c.json({ ok: true });
  },
);

workOrdersRoute.get(
  "/:id/deductions",
  requireAuth,
  requireCapability("workorder.read"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有查看此工程的權限。"), 403);
    }
    const rows = await getDb()
      .select()
      .from(workOrderDeductions)
      .where(eq(workOrderDeductions.workOrderId, order.id))
      .orderBy(desc(workOrderDeductions.createdAt));
    return c.json(rows);
  },
);

workOrdersRoute.post(
  "/:id/deductions",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可新增材料扣減。"), 409);
    }
    const parsed = deductionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "材料扣減資料不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const [created] = await getDb()
      .insert(workOrderDeductions)
      .values({
        workOrderId: order.id,
        name: parsed.data.name,
        amountCents: parsed.data.amountCents,
        notes: parsed.data.notes,
        createdBy: c.get("user").id,
      })
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_deduction_added",
      entityType: "work_order",
      entityId: order.id,
      after: { name: created.name, amountCents: created.amountCents },
      requestId: c.get("requestId"),
    });
    return c.json(created, 201);
  },
);

workOrdersRoute.delete(
  "/:id/deductions/:deductionId",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await orderDetail(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可修改材料扣減。"), 409);
    }
    const deleted = await getDb()
      .delete(workOrderDeductions)
      .where(
        and(
          eq(workOrderDeductions.id, c.req.param("deductionId")),
          eq(workOrderDeductions.workOrderId, order.id),
        ),
      )
      .returning({ id: workOrderDeductions.id });
    if (!deleted[0]) return c.json(error("NOT_FOUND", "找不到材料扣減。"), 404);
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_deduction_deleted",
      entityType: "work_order",
      entityId: order.id,
      before: { deductionId: deleted[0].id },
      requestId: c.get("requestId"),
    });
    return c.json({ ok: true });
  },
);

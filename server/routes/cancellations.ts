import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { auditLogs, cancellationCases, customers, invoices } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const createSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});

const updateSchema = z.object({
  status: z
    .enum(["pending", "awaiting_credit_note", "awaiting_transfer", "completed"])
    .optional(),
  refundAmountCents: z.number().int().nonnegative().optional(),
  deductionsCents: z.number().int().nonnegative().optional(),
  refundReason: z.string().trim().max(1000).nullable().optional(),
  bankName: z.string().trim().max(120).nullable().optional(),
  bankAccountName: z.string().trim().max(120).nullable().optional(),
  bankAccountNumber: z.string().trim().max(80).nullable().optional(),
});

const error = (code: string, message: string) => ({
  error: { code, message },
});

export const cancellationsRoute = new Hono<AppEnv>();

cancellationsRoute.get(
  "/",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: cancellationCases.id,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        customerName: customers.name,
        customerPhone: customers.phone,
        reason: cancellationCases.reason,
        status: cancellationCases.status,
        refundAmountCents: cancellationCases.refundAmountCents,
        deductionsCents: cancellationCases.deductionsCents,
        createdAt: cancellationCases.createdAt,
        updatedAt: cancellationCases.updatedAt,
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(cancellationCases.createdAt));
    return c.json(rows);
  },
);

cancellationsRoute.get(
  "/:id",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const rows = await getDb()
      .select({
        case: cancellationCases,
        invoice: {
          id: invoices.id,
          number: invoices.number,
          totalCents: invoices.totalCents,
          validPaidCents: invoices.validPaidCents,
          status: invoices.status,
        },
        customer: {
          name: customers.name,
          phone: customers.phone,
          address: customers.address,
          district: customers.district,
        },
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(cancellationCases.id, c.req.param("id")))
      .limit(1);
    if (!rows[0]) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    return c.json(rows[0]);
  },
);

cancellationsRoute.post(
  "/",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(error("VALIDATION_ERROR", "退款資料不正確。"), 400);
    }
    const [invoice] = await getDb()
      .select()
      .from(invoices)
      .where(eq(invoices.id, parsed.data.invoiceId))
      .limit(1);
    if (!invoice) return c.json(error("NOT_FOUND", "找不到發票。"), 404);
    const [created] = await getDb()
      .insert(cancellationCases)
      .values({
        invoiceId: invoice.id,
        reason: parsed.data.reason,
        createdBy: c.get("user").id,
      })
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "cancellation_case_created",
      entityType: "cancellation_case",
      entityId: created.id,
      after: { invoiceNumber: invoice.number, reason: parsed.data.reason },
      requestId: c.get("requestId"),
    });
    return c.json(created, 201);
  },
);

cancellationsRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "退款資料不正確。" } },
        400,
      );
    }
    const [current] = await getDb()
      .select({
        case: cancellationCases,
        invoice: invoices,
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .where(eq(cancellationCases.id, c.req.param("id")))
      .limit(1);
    if (!current) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    if (
      parsed.data.refundAmountCents !== undefined &&
      parsed.data.refundAmountCents > current.invoice.validPaidCents
    ) {
      return c.json(error("REFUND_EXCEEDS_PAID", "退款金額不可超過已收金額。"), 422);
    }
    const [updated] = await getDb()
      .update(cancellationCases)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
        completedAt:
          parsed.data.status === "completed"
            ? new Date()
            : current.case.completedAt,
      })
      .where(eq(cancellationCases.id, current.case.id))
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "cancellation_case_updated",
      entityType: "cancellation_case",
      entityId: current.case.id,
      before: {
        status: current.case.status,
        refundAmountCents: current.case.refundAmountCents,
      },
      after: parsed.data,
      requestId: c.get("requestId"),
    });
    return c.json(updated);
  },
);

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLogs,
  files,
  invoicePaymentPlan,
  invoiceVersions,
  invoices,
  municipalOrders,
  notifications,
  numberSequences,
  payments,
  receipts,
  users,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import { signedPaymentProof } from "../storage";

const paymentSchema = z.object({
  installment: z.number().int().min(1).max(20),
  amountCents: z.number().int().positive(),
  method: z.enum(["cash", "fps", "transfer", "cheque"]),
  custody: z.enum(["company", "sales"]).default("company"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  proofFileId: z.string().uuid().optional(),
  confirm: z.boolean().default(false),
});

const error = (code: string, message: string) => ({
  error: { code, message },
});

async function allocateNumber(
  tx: any,
  key: string,
  period: string,
  pad: number,
) {
  const [sequence] = await tx
    .insert(numberSequences)
    .values({ key, period, nextValue: 2 })
    .onConflictDoUpdate({
      target: [numberSequences.key, numberSequences.period],
      set: { nextValue: sql`${numberSequences.nextValue} + 1` },
    })
    .returning({ nextValue: numberSequences.nextValue });
  return String(sequence.nextValue - 1).padStart(pad, "0");
}

async function applyValidPayment(
  tx: any,
  invoiceId: string,
  actorId: string,
  requestId?: string,
) {
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  const [totals] = await tx
    .select({
      valid: sql<number>`coalesce(sum(case when ${payments.status} = 'valid' then ${payments.amountCents} else 0 end), 0)::int`,
    })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));
  const validPaidCents = Number(totals?.valid ?? 0);
  const threshold = Math.ceil(invoice.totalCents * 0.5);
  let status = invoice.status;
  if (validPaidCents >= invoice.totalCents) status = "paid";
  else if (validPaidCents > 0) status = "partially_paid";

  let order = (
    await tx
      .select()
      .from(workOrders)
      .where(eq(workOrders.invoiceId, invoiceId))
      .limit(1)
  )[0];

  if (!order && validPaidCents >= threshold) {
    const [version] = await tx
      .select()
      .from(invoiceVersions)
      .where(
        and(
          eq(invoiceVersions.invoiceId, invoiceId),
          eq(invoiceVersions.versionNo, invoice.currentVersion),
        ),
      )
      .limit(1);
    if (!version) throw new Error("INVOICE_VERSION_NOT_FOUND");
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const seq = await allocateNumber(tx, "work_order", yy, 5);
    const [createdOrder] = await tx
      .insert(workOrders)
      .values({
        number: `D${yy}${seq}`,
        invoiceId,
        versionId: version.id,
        status: "unassigned",
        releasedAt: now,
      })
      .returning();
    order = createdOrder;
    status = "released";

    if (invoice.categories.includes("grant-80k")) {
      const municipalNumber = `${invoice.number.replace(/A$/, "")}B`;
      const existingMunicipal = await tx
        .select({ id: municipalOrders.id })
        .from(municipalOrders)
        .where(eq(municipalOrders.invoiceId, invoiceId))
        .limit(1);
      if (!existingMunicipal[0]) {
        await tx.insert(municipalOrders).values({
          number: municipalNumber,
          invoiceId,
          workOrderId: createdOrder.id,
          status: "active",
        });
      }
    }

    const supervisors = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "cs_supervisor"), eq(users.active, true)));
    if (supervisors.length) {
      await tx.insert(notifications).values(
        supervisors.map((supervisor: { id: string }) => ({
          userId: supervisor.id,
          title: "新工程單待分配",
          body: `發票 ${invoice.number} 已收足 50%，工程單 ${createdOrder.number} 待安排。`,
          entityType: "work_order",
          entityId: createdOrder.id,
        })),
      );
    }
  }

  await tx
    .update(invoices)
    .set({ validPaidCents, status, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  await tx.insert(auditLogs).values({
    actorId,
    action: "payment_applied",
    entityType: "invoice",
    entityId: invoiceId,
    after: {
      validPaidCents,
      status,
      workOrderId: order?.id ?? null,
    },
    requestId,
  });
  return { invoice: { ...invoice, validPaidCents, status }, order };
}

async function invoiceOr404(invoiceId: string) {
  const [invoice] = await getDb()
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return invoice;
}

export const paymentsRoute = new Hono<AppEnv>();

paymentsRoute.get(
  "/:invoiceId/payments",
  requireAuth,
  requireCapability("invoice.read"),
  async (c) => {
    const rows = await getDb()
      .select({ payment: payments, proof: files })
      .from(payments)
      .leftJoin(files, eq(payments.proofFileId, files.id))
      .where(eq(payments.invoiceId, c.req.param("invoiceId")))
      .orderBy(desc(payments.createdAt));
    return c.json(
      await Promise.all(
        rows.map(async ({ payment, proof }) => ({
          ...payment,
          proofFilename: proof?.filename ?? null,
          proofUrl: proof
            ? await signedPaymentProof(proof.storageKey).catch(() => null)
            : null,
        })),
      ),
    );
  },
);

paymentsRoute.post(
  "/:invoiceId/payments",
  requireAuth,
  requireCapability("payment.register"),
  async (c) => {
    const parsed = paymentSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "付款資料不完整或不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    if (parsed.data.confirm && !c.get("user")) {
      return c.json(error("FORBIDDEN", "沒有確認收款權限。"), 403);
    }
    const invoice = await invoiceOr404(c.req.param("invoiceId"));
    if (!invoice) return c.json(error("NOT_FOUND", "找不到發票。"), 404);
    if (invoice.status === "voided" || invoice.status === "refunded") {
      return c.json(error("INVOICE_CLOSED", "此發票已關閉。"), 409);
    }
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (idempotencyKey) {
      const existing = await getDb()
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing[0]) return c.json(existing[0], 200);
    }
    const plan = await getDb()
      .select()
      .from(invoicePaymentPlan)
      .where(eq(invoicePaymentPlan.invoiceId, invoice.id))
      .orderBy(invoicePaymentPlan.installment);
    if (plan.length) {
      const stage = plan.find((row) => row.installment === parsed.data.installment);
      if (!stage) {
        return c.json(error("INVALID_INSTALLMENT", "此發票沒有這個期數。"), 422);
      }
      const prior = plan.filter((row) => row.installment < stage.installment);
      for (const row of prior) {
        const paid = await getDb()
          .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
          .from(payments)
          .where(
            and(
              eq(payments.invoiceId, invoice.id),
              eq(payments.installment, row.installment),
              eq(payments.status, "valid"),
            ),
          );
        if (Number(paid[0]?.total ?? 0) < row.amountCents) {
          return c.json(error("PRIOR_INSTALLMENT_UNPAID", "請先收足上一期款項。"), 422);
        }
      }
      const stagePaid = await getDb()
        .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
        .from(payments)
        .where(
          and(
            eq(payments.invoiceId, invoice.id),
            eq(payments.installment, stage.installment),
            sql`${payments.status} in ('valid','pending')`,
          ),
        );
      if (Number(stagePaid[0]?.total ?? 0) + parsed.data.amountCents > stage.amountCents) {
        return c.json(error("INSTALLMENT_EXCEEDS", "付款金額超過本期應收金額。"), 422);
      }
    }
    const occupied = await getDb()
      .select({
        total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoice.id),
          sql`${payments.status} in ('valid','pending')`,
        ),
      );
    if (Number(occupied[0]?.total ?? 0) + parsed.data.amountCents > invoice.totalCents) {
      return c.json(error("PAYMENT_EXCEEDS_TOTAL", "付款金額超過發票總額。"), 422);
    }
    if (!parsed.data.confirm) {
      const [created] = await getDb()
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          versionId: (
            await getDb()
              .select()
              .from(invoiceVersions)
              .where(
                and(
                  eq(invoiceVersions.invoiceId, invoice.id),
                  eq(invoiceVersions.versionNo, invoice.currentVersion),
                ),
              )
              .limit(1)
          )[0].id,
          installment: parsed.data.installment,
          amountCents: parsed.data.amountCents,
          method: parsed.data.method,
          custody: parsed.data.custody,
          status: "pending",
          paidAt: parsed.data.paidAt,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          proofFileId: parsed.data.proofFileId,
          createdBy: c.get("user").id,
          idempotencyKey,
        })
        .returning();
      return c.json(created, 201);
    }
    let created: any;
    await getDb().transaction(async (tx) => {
      const [version] = await tx
        .select()
        .from(invoiceVersions)
        .where(
          and(
            eq(invoiceVersions.invoiceId, invoice.id),
            eq(invoiceVersions.versionNo, invoice.currentVersion),
          ),
        )
        .limit(1);
      const [payment] = await tx
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          versionId: version.id,
          installment: parsed.data.installment,
          amountCents: parsed.data.amountCents,
          method: parsed.data.method,
          custody: parsed.data.custody,
          status: "valid",
          paidAt: parsed.data.paidAt,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          proofFileId: parsed.data.proofFileId,
          createdBy: c.get("user").id,
          validatedBy: c.get("user").id,
          validatedAt: new Date(),
          idempotencyKey,
        })
        .returning();
      created = payment;
      await applyValidPayment(tx, invoice.id, c.get("user").id, c.get("requestId"));
    });
    return c.json(created, 201);
  },
);

paymentsRoute.post(
  "/:invoiceId/payments/:paymentId/validate",
  requireAuth,
  requireCapability("payment.validate"),
  async (c) => {
    const invoiceId = c.req.param("invoiceId");
    const paymentId = c.req.param("paymentId");
    const [payment] = await getDb()
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)))
      .limit(1);
    if (!payment) return c.json(error("NOT_FOUND", "找不到付款。"), 404);
    if (payment.status !== "pending") {
      return c.json(error("INVALID_PAYMENT_STATE", "此付款不是待核對狀態。"), 409);
    }
    let updated: any;
    await getDb().transaction(async (tx) => {
      const [row] = await tx
        .update(payments)
        .set({
          status: "valid",
          validatedBy: c.get("user").id,
          validatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId))
        .returning();
      updated = row;
      await applyValidPayment(tx, invoiceId, c.get("user").id, c.get("requestId"));
    });
    return c.json(updated);
  },
);

paymentsRoute.post(
  "/:invoiceId/payments/:paymentId/reject",
  requireAuth,
  requireCapability("payment.validate"),
  async (c) => {
    const invoiceId = c.req.param("invoiceId");
    const paymentId = c.req.param("paymentId");
    const body = await c.req.json().catch(() => null);
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    if (!notes) {
      return c.json(error("VALIDATION_ERROR", "請填寫退回原因。"), 400);
    }
    const [payment] = await getDb()
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)))
      .limit(1);
    if (!payment) return c.json(error("NOT_FOUND", "找不到付款。"), 404);
    if (payment.status !== "pending") {
      return c.json(error("INVALID_PAYMENT_STATE", "此付款不是待核對狀態。"), 409);
    }
    const [updated] = await getDb()
      .update(payments)
      .set({ status: "rejected", notes, validatedBy: c.get("user").id, validatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "payment_rejected",
      entityType: "payment",
      entityId: paymentId,
      after: { notes },
      requestId: c.get("requestId"),
    });
    return c.json(updated);
  },
);

paymentsRoute.post(
  "/:invoiceId/payments/:paymentId/receipt",
  requireAuth,
  requireCapability("receipt.issue"),
  async (c) => {
    const invoiceId = c.req.param("invoiceId");
    const paymentId = c.req.param("paymentId");
    const [payment] = await getDb()
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.invoiceId, invoiceId)))
      .limit(1);
    if (!payment) return c.json(error("NOT_FOUND", "找不到付款。"), 404);
    if (payment.status !== "valid") {
      return c.json(error("PAYMENT_NOT_VALID", "未確認的付款不可出收據。"), 409);
    }
    const existing = await getDb()
      .select()
      .from(receipts)
      .where(eq(receipts.paymentId, paymentId))
      .limit(1);
    if (existing[0]) return c.json(existing[0], 200);
    let receipt: any;
    await getDb().transaction(async (tx) => {
      const now = new Date();
      const period = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const seq = await allocateNumber(tx, "receipt", period, 4);
      const [created] = await tx
        .insert(receipts)
        .values({
          number: `R-${period}-${seq}`,
          paymentId,
          amountCents: payment.amountCents,
          issuedBy: c.get("user").id,
        })
        .returning();
      receipt = created;
      await tx.insert(auditLogs).values({
        actorId: c.get("user").id,
        action: "receipt_issued",
        entityType: "payment",
        entityId: paymentId,
        after: { receiptNumber: created.number, amountCents: payment.amountCents },
        requestId: c.get("requestId"),
      });
    });
    return c.json(receipt, 201);
  },
);

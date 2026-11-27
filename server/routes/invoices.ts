import { Hono } from "hono";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  auditLogs,
  customers,
  invoiceLines,
  invoicePaymentPlan,
  invoiceVersions,
  invoices,
  numberSequences,
  payments,
  receipts,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const categorySchema = z.enum(["self-pay", "grant-80k", "group-buy"]);

const lineSchema = z.object({
  serviceId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  position: z.string().trim().max(120).optional(),
  quantity: z.number().positive().max(100000),
  unit: z.string().trim().min(1).max(40),
  unitPriceCents: z.number().int().nonnegative(),
  amountCents: z.number().int().nonnegative().optional(),
});

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  salesName: z.string().trim().max(120).optional(),
  supervisorName: z.string().trim().max(120).optional(),
  categories: z.array(categorySchema).min(1),
  grant: z
    .object({
      applicationNumber: z.string().trim().max(120).optional(),
      approvedAmountCents: z.number().int().nonnegative().optional(),
    })
    .optional(),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(30),
    whatsapp: z.string().trim().max(30).optional(),
    address: z.string().trim().max(300).optional(),
    district: z.string().trim().max(80).optional(),
  }),
  lines: z.array(lineSchema).min(1).max(300),
});

const amendSchema = createSchema.extend({
  reason: z.string().trim().min(3).max(500),
});

const error = (code: string, message: string) => ({
  error: { code, message },
});

type Category = "self-pay" | "grant-80k" | "group-buy";
const PLAN_DEFINITIONS: Record<Category, Array<{ label: string; percentage: number }>> = {
  "group-buy": [
    { label: "第一期訂金", percentage: 50 },
    { label: "尾數", percentage: 50 },
  ],
  "grant-80k": [
    { label: "第一期訂金", percentage: 30 },
    { label: "第二期訂金", percentage: 20 },
    { label: "尾數", percentage: 50 },
  ],
  "self-pay": [
    { label: "第一期訂金", percentage: 30 },
    { label: "第二期訂金", percentage: 20 },
    { label: "工程中期款", percentage: 30 },
    { label: "尾數", percentage: 20 },
  ],
};

export function primaryInvoiceCategory(categories: string[]): Category {
  if (categories.includes("grant-80k")) return "grant-80k";
  if (categories.includes("group-buy")) return "group-buy";
  return "self-pay";
}

export function buildPaymentPlan(categories: string[], totalCents: number) {
  const category = primaryInvoiceCategory(categories);
  const rows = PLAN_DEFINITIONS[category];
  let used = 0;
  return rows.map((row, index) => {
    const amountCents =
      index === rows.length - 1
        ? totalCents - used
        : Math.round((totalCents * row.percentage) / 100);
    used += amountCents;
    return {
      installment: index + 1,
      label: row.label,
      percentage: row.percentage,
      amountCents,
      cumulativeCents: used,
    };
  });
}

async function invoiceDetail(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      currentVersion: invoices.currentVersion,
      categories: invoices.categories,
      salesName: invoices.salesName,
      supervisorName: invoices.supervisorName,
      grantApplicationNumber: invoices.grantApplicationNumber,
      grantApprovedAmountCents: invoices.grantApprovedAmountCents,
      totalCents: invoices.totalCents,
      validPaidCents: invoices.validPaidCents,
      createdAt: invoices.createdAt,
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        whatsapp: customers.whatsapp,
        address: customers.address,
        district: customers.district,
      },
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const versionRows = await db
    .select()
    .from(invoiceVersions)
    .where(
      and(
        eq(invoiceVersions.invoiceId, id),
        eq(invoiceVersions.versionNo, rows[0].currentVersion),
      ),
    )
    .limit(1);
  const version = versionRows[0];
  if (!version) return null;
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.versionId, version.id));
  const plan = await db
    .select()
    .from(invoicePaymentPlan)
    .where(eq(invoicePaymentPlan.invoiceId, id))
    .orderBy(invoicePaymentPlan.installment);
  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(payments.installment);
  const invoiceReceipts = await db
    .select({ id: receipts.id, paymentId: receipts.paymentId })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .where(eq(payments.invoiceId, id));
  const validPayments = invoicePayments.filter((payment) => payment.status === "valid");
  const pendingPayments = invoicePayments.filter((payment) => payment.status === "pending");
  const installments = plan.map((stage, index) => {
    const priorPaid = plan.slice(0, index).every((prior) =>
      validPayments
        .filter((payment) => payment.installment === prior.installment)
        .reduce((sum, payment) => sum + payment.amountCents, 0) >= prior.amountCents,
    );
    const received = validPayments
      .filter((payment) => payment.installment === stage.installment)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const pending = pendingPayments
      .filter((payment) => payment.installment === stage.installment)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const paymentIds = validPayments
      .filter((payment) => payment.installment === stage.installment)
      .map((payment) => payment.id);
    const receiptIds = invoiceReceipts
      .filter((receipt) => paymentIds.includes(receipt.paymentId))
      .map((receipt) => receipt.id);
    const hasUnreceipted = validPayments.some(
      (payment) =>
        payment.installment === stage.installment &&
        !invoiceReceipts.some((receipt) => receipt.paymentId === payment.id),
    );
    const status = !priorPaid
      ? "locked"
      : pending > 0
        ? "under_review"
        : hasUnreceipted
          ? "ready_receipt"
          : received >= stage.amountCents
            ? "receipted"
            : "awaiting_payment";
    return {
      ...stage,
      receivedCents: received,
      pendingCents: pending,
      status,
      paymentIds,
      receiptIds,
    };
  });
  const validPaidCents = validPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const pendingPaidCents = pendingPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
  return {
    ...rows[0],
    version: {
      id: version.id,
      versionNo: version.versionNo,
      reason: version.reason,
      createdAt: version.createdAt,
    },
    lines: lines.map((line) => ({
      id: line.id,
      serviceId: line.serviceId,
      name: line.name,
      position: line.position,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
      amountCents: line.amountCents,
    })),
    paymentStatus: {
      validPaidCents,
      pendingPaidCents,
      percentPaid: rows[0].totalCents > 0 ? Number(((validPaidCents / rows[0].totalCents) * 100).toFixed(2)) : 0,
      csReleaseDueCents: Math.round(rows[0].totalCents * 0.5),
      completed: validPaidCents >= rows[0].totalCents,
      installments,
    },
  };
}

export const invoicesRoute = new Hono<AppEnv>();

invoicesRoute.get(
  "/",
  requireAuth,
  requireCapability("invoice.read"),
  async (c) => {
    const db = getDb();
    const q = c.req.query("q")?.trim();
    const status = c.req.query("status");
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    const conditions = [];
    if (status) conditions.push(eq(invoices.status, status as never));
    if (q) {
      conditions.push(
        or(
          ilike(invoices.number, `%${q}%`),
          ilike(customers.name, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
        ),
      );
    }
    const rows = await db
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
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(invoices.createdAt))
      .limit(limit);
    return c.json(rows);
  },
);

invoicesRoute.get(
  "/:id",
  requireAuth,
  requireCapability("invoice.read"),
  async (c) => {
    const detail = await invoiceDetail(c.req.param("id"));
    if (!detail) return c.json(error("NOT_FOUND", "找不到發票。"), 404);
    return c.json(detail);
  },
);

invoicesRoute.post(
  "/:id/amendments",
  requireAuth,
  requireCapability("invoice.amend"),
  async (c) => {
    const parsed = amendSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "修改資料不完整或不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const input = parsed.data;
    const invoiceId = c.req.param("id");
    const db = getDb();
    const currentRows = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const current = currentRows[0];
    if (!current) return c.json(error("NOT_FOUND", "找不到發票。"), 404);
    if (current.status === "voided" || current.status === "refunded") {
      return c.json(error("INVOICE_CLOSED", "此發票已關閉，不可修改。"), 409);
    }
    const validPayment = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "valid")))
      .limit(1);
    const releasedOrder = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.invoiceId, invoiceId))
      .limit(1);
    if (validPayment[0] || releasedOrder[0]) {
      return c.json(
        error(
          "INVOICE_LOCKED",
          "此發票已有有效付款或已發工程單，不可直接修改。",
        ),
        409,
      );
    }
    const currentCustomer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, current.customerId))
      .limit(1);
    if (!currentCustomer[0]) {
      return c.json(error("NOT_FOUND", "找不到客戶。"), 404);
    }
    if (currentCustomer[0].phone !== input.customer.phone) {
      return c.json(
        error("CUSTOMER_CHANGE_BLOCKED", "修改單不可更改客戶電話。"),
        422,
      );
    }
    const hasGrant = input.categories.includes("grant-80k");
    if (
      !hasGrant &&
      (input.grant?.applicationNumber || input.grant?.approvedAmountCents)
    ) {
      return c.json(
        error("INVALID_GRANT", "只有 8萬資助單可以填寫批核資料。"),
        422,
      );
    }
    const amounts = input.lines.map((line) => ({
      ...line,
      amountCents:
        line.amountCents ?? Math.round(line.quantity * line.unitPriceCents),
    }));
    const totalCents = amounts.reduce((sum, line) => sum + line.amountCents, 0);
    if (totalCents <= 0) {
      return c.json(error("INVALID_TOTAL", "發票金額必須大於 0。"), 422);
    }
    const actorId = c.get("user").id;
    const nextVersion = current.currentVersion + 1;
    await db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({
          name: input.customer.name,
          whatsapp: input.customer.whatsapp ?? currentCustomer[0].whatsapp,
          address: input.customer.address ?? currentCustomer[0].address,
          district: input.customer.district ?? currentCustomer[0].district,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, current.customerId));
      await tx
        .update(invoices)
        .set({
          categories: input.categories,
          salesName: input.salesName,
          supervisorName: input.supervisorName,
          grantApplicationNumber: hasGrant
            ? input.grant?.applicationNumber
            : null,
          grantApprovedAmountCents: hasGrant
            ? input.grant?.approvedAmountCents
            : null,
          totalCents,
          currentVersion: nextVersion,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));
      const version = await tx
        .insert(invoiceVersions)
        .values({
          invoiceId,
          versionNo: nextVersion,
          reason: input.reason,
          createdBy: actorId,
          snapshot: {
            date: input.date,
            salesName: input.salesName,
            supervisorName: input.supervisorName,
            categories: input.categories,
            grant: input.grant ?? null,
            customer: input.customer,
          },
        })
        .returning({ id: invoiceVersions.id });
      await tx.insert(invoiceLines).values(
        amounts.map((line) => ({
          versionId: version[0].id,
          serviceId: line.serviceId,
          name: line.name,
          position: line.position,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPriceCents: line.unitPriceCents,
          amountCents: line.amountCents,
        })),
      );
      await tx.insert(auditLogs).values({
        actorId,
        action: "invoice_amended",
        entityType: "invoice",
        entityId: invoiceId,
        before: { version: current.currentVersion, totalCents: current.totalCents },
        after: { version: nextVersion, totalCents, reason: input.reason },
        requestId: c.get("requestId"),
      });
    });
    const detail = await invoiceDetail(invoiceId);
    return c.json(detail, 201);
  },
);

invoicesRoute.post(
  "/",
  requireAuth,
  requireCapability("invoice.create"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "發票資料不完整或不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const input = parsed.data;
    const hasGrant = input.categories.includes("grant-80k");
    if (
      !hasGrant &&
      (input.grant?.applicationNumber || input.grant?.approvedAmountCents)
    ) {
      return c.json(
        error("INVALID_GRANT", "只有 8萬資助單可以填寫批核資料。"),
        422,
      );
    }
    const amounts = input.lines.map((line) => ({
      ...line,
      amountCents:
        line.amountCents ?? Math.round(line.quantity * line.unitPriceCents),
    }));
    const totalCents = amounts.reduce((sum, line) => sum + line.amountCents, 0);
    if (totalCents <= 0) {
      return c.json(error("INVALID_TOTAL", "發票金額必須大於 0。"), 422);
    }

    const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
    if (idempotencyKey) {
      const existing = await getDb()
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing[0]) {
        const detail = await invoiceDetail(existing[0].id);
        return c.json(detail, 200);
      }
    }

    const actorId = c.get("user").id;
    const period = input.date.slice(2, 4) + input.date.slice(5, 7);
    let invoiceId = "";
    await getDb().transaction(async (tx) => {
      const existingCustomer = await tx
        .select()
        .from(customers)
        .where(eq(customers.phone, input.customer.phone))
        .limit(1);
      let customerId: string;
      if (existingCustomer[0]) {
        customerId = existingCustomer[0].id;
        await tx
          .update(customers)
          .set({
            name: input.customer.name,
            whatsapp: input.customer.whatsapp ?? existingCustomer[0].whatsapp,
            address: input.customer.address ?? existingCustomer[0].address,
            district: input.customer.district ?? existingCustomer[0].district,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, customerId));
      } else {
        const createdCustomer = await tx
          .insert(customers)
          .values({
            ...input.customer,
            createdBy: actorId,
          })
          .returning({ id: customers.id });
        customerId = createdCustomer[0].id;
      }

      const [sequence] = await tx
        .insert(numberSequences)
        .values({ key: "invoice", period, nextValue: 2 })
        .onConflictDoUpdate({
          target: [numberSequences.key, numberSequences.period],
          set: { nextValue: sql`${numberSequences.nextValue} + 1` },
        })
        .returning({ nextValue: numberSequences.nextValue });
      const allocated = sequence.nextValue - 1;
      const number = `DINV${period}${String(allocated).padStart(4, "0")}`;

      const createdInvoice = await tx
        .insert(invoices)
        .values({
          number,
          customerId,
          status: "issued",
          currentVersion: 1,
          categories: input.categories,
          salesName: input.salesName,
          supervisorName: input.supervisorName,
          grantApplicationNumber: hasGrant
            ? input.grant?.applicationNumber
            : null,
          grantApprovedAmountCents: hasGrant
            ? input.grant?.approvedAmountCents
            : null,
          totalCents,
          validPaidCents: 0,
          createdBy: actorId,
          idempotencyKey,
        })
        .returning({ id: invoices.id });
      invoiceId = createdInvoice[0].id;

      await tx.insert(invoicePaymentPlan).values(
        buildPaymentPlan(input.categories, totalCents).map((row) => ({
          invoiceId,
          ...row,
        })),
      );

      const version = await tx
        .insert(invoiceVersions)
        .values({
          invoiceId,
          versionNo: 1,
          reason: "建立發票",
          createdBy: actorId,
          snapshot: {
            date: input.date,
            salesName: input.salesName,
            supervisorName: input.supervisorName,
            categories: input.categories,
            grant: input.grant ?? null,
            customer: input.customer,
          },
        })
        .returning({ id: invoiceVersions.id });

      await tx.insert(invoiceLines).values(
        amounts.map((line) => ({
          versionId: version[0].id,
          serviceId: line.serviceId,
          name: line.name,
          position: line.position,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPriceCents: line.unitPriceCents,
          amountCents: line.amountCents,
        })),
      );

      await tx.insert(auditLogs).values({
        actorId,
        action: "invoice_created",
        entityType: "invoice",
        entityId: invoiceId,
        after: { number, totalCents, categories: input.categories },
        requestId: c.get("requestId"),
      });
    });

    const detail = await invoiceDetail(invoiceId);
    return c.json(detail, 201);
  },
);

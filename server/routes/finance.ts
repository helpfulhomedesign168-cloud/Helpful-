import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { customers, files, invoices, payments } from "../db/schema";
import { signedPaymentProof } from "../storage";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const financeRoute = new Hono<AppEnv>();

financeRoute.get(
  "/all",
  requireAuth,
  requireCapability("payment.validate"),
  async (c) => {
    const rows = await getDb()
      .select({
        payment: payments,
        proof: files,
        invoiceNumber: invoices.number,
        invoiceTotalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(files, eq(payments.proofFileId, files.id))
      .orderBy(desc(payments.createdAt));
    return c.json(
      await Promise.all(
        rows.map(async ({ payment, proof, invoiceNumber, invoiceTotalCents, validPaidCents, customerName, customerPhone }) => ({
          ...payment,
          invoiceNumber,
          invoiceTotalCents,
          validPaidCents,
          customerName,
          customerPhone,
          proofFilename: proof?.filename ?? null,
          proofUrl: proof ? await signedPaymentProof(proof.storageKey).catch(() => null) : null,
        })),
      ),
    );
  },
);

financeRoute.get(
  "/pending",
  requireAuth,
  requireCapability("payment.validate"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: payments.id,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        installment: payments.installment,
        amountCents: payments.amountCents,
        method: payments.method,
        paidAt: payments.paidAt,
        reference: payments.reference,
        notes: payments.notes,
        createdAt: payments.createdAt,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(and(eq(payments.status, "pending")))
      .orderBy(desc(payments.createdAt));
    return c.json(rows);
  },
);

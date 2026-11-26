import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { customers, invoices, payments, receipts, users } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const receiptsRoute = new Hono<AppEnv>();

receiptsRoute.get(
  "/:id",
  requireAuth,
  requireCapability("invoice.read"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: receipts.id,
        number: receipts.number,
        amountCents: receipts.amountCents,
        issuedAt: receipts.issuedAt,
        paymentId: payments.id,
        installment: payments.installment,
        paidAt: payments.paidAt,
        method: payments.method,
        reference: payments.reference,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        customer: {
          name: customers.name,
          phone: customers.phone,
          address: customers.address,
          district: customers.district,
        },
        issuedBy: users.name,
      })
      .from(receipts)
      .innerJoin(payments, eq(receipts.paymentId, payments.id))
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .innerJoin(users, eq(receipts.issuedBy, users.id))
      .where(eq(receipts.id, c.req.param("id")))
      .limit(1);
    if (!rows[0]) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到收據。" } }, 404);
    }
    return c.json(rows[0]);
  },
);

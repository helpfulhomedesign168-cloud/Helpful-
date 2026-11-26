import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  customers,
  invoiceLines,
  invoiceVersions,
  invoices,
  municipalOrders,
  workOrders,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const municipalRoute = new Hono<AppEnv>();

municipalRoute.get(
  "/",
  requireAuth,
  requireCapability("municipal.read"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: municipalOrders.id,
        number: municipalOrders.number,
        status: municipalOrders.status,
        createdAt: municipalOrders.createdAt,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        grantApplicationNumber: invoices.grantApplicationNumber,
        grantApprovedAmountCents: invoices.grantApprovedAmountCents,
        totalCents: invoices.totalCents,
        validPaidCents: invoices.validPaidCents,
        principalOrderId: workOrders.id,
        principalOrderNumber: workOrders.number,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(municipalOrders)
      .innerJoin(invoices, eq(municipalOrders.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .innerJoin(workOrders, eq(municipalOrders.workOrderId, workOrders.id))
      .orderBy(desc(municipalOrders.createdAt));
    return c.json(rows);
  },
);

municipalRoute.get(
  "/:id",
  requireAuth,
  requireCapability("municipal.read"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: municipalOrders.id,
        number: municipalOrders.number,
        status: municipalOrders.status,
        createdAt: municipalOrders.createdAt,
        invoice: {
          id: invoices.id,
          number: invoices.number,
          categories: invoices.categories,
          totalCents: invoices.totalCents,
          validPaidCents: invoices.validPaidCents,
          grantApplicationNumber: invoices.grantApplicationNumber,
          grantApprovedAmountCents: invoices.grantApprovedAmountCents,
          currentVersion: invoices.currentVersion,
        },
        principal: {
          id: workOrders.id,
          number: workOrders.number,
          status: workOrders.status,
        },
        customer: {
          name: customers.name,
          phone: customers.phone,
          address: customers.address,
          district: customers.district,
        },
      })
      .from(municipalOrders)
      .innerJoin(invoices, eq(municipalOrders.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .innerJoin(workOrders, eq(municipalOrders.workOrderId, workOrders.id))
      .where(eq(municipalOrders.id, c.req.param("id")))
      .limit(1);
    const order = rows[0];
    if (!order) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到市政單。" } }, 404);
    }
    const version = await getDb()
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
      ? await getDb()
          .select()
          .from(invoiceLines)
          .where(eq(invoiceLines.versionId, version[0].id))
      : [];
    return c.json({
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
    });
  },
);

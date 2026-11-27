import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  customers,
  invoiceLines,
  invoiceVersions,
  invoices,
  auditLogs,
  municipalOrderLines,
  municipalOrders,
  workOrders,
} from "../db/schema";
import { z } from "zod";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const updateSchema = z.object({
  lines: z
    .array(
      z.object({
        sourceLineId: z.string().uuid().nullable().optional(),
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).nullable().optional(),
        position: z.string().trim().max(120).nullable().optional(),
        measure: z.enum(["area", "length", "quantity", "fixed"]).nullable().optional(),
        length: z.number().nonnegative().nullable().optional(),
        width: z.number().nonnegative().nullable().optional(),
        dimensionUnit: z.enum(["呎", "寸"]).nullable().optional(),
        quantity: z.number().positive().max(100000),
        unit: z.string().trim().min(1).max(40),
        unitPriceCents: z.number().int().nonnegative(),
        amountCents: z.number().int().nonnegative(),
        productStyleText: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(300),
});

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
    const currentMunicipalLines = await getDb()
      .select()
      .from(municipalOrderLines)
      .where(eq(municipalOrderLines.municipalOrderId, order.id));
    let lines: {
      id: string;
      sourceLineId?: string | null;
      name: string;
      description?: string | null;
      position: string | null;
      measure?: string | null;
      length?: string | null;
      width?: string | null;
      dimensionUnit?: string | null;
      quantity: string;
      unit: string;
      unitPriceCents: number;
      amountCents: number;
      productStyleText?: string | null;
    }[];
    if (currentMunicipalLines.length) {
      lines = currentMunicipalLines;
    } else {
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
      lines = version[0]
        ? await getDb()
            .select()
            .from(invoiceLines)
            .where(eq(invoiceLines.versionId, version[0].id))
        : [];
    }
    return c.json({
      ...order,
      lines: lines.map((line) => ({
        id: line.id,
        sourceLineId: line.sourceLineId,
        name: line.name,
        description: line.description,
        position: line.position,
        measure: line.measure,
        length: line.length,
        width: line.width,
        dimensionUnit: line.dimensionUnit,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceCents: line.unitPriceCents,
        amountCents: line.amountCents,
        productStyleText: line.productStyleText,
      })),
    });
  },
);

municipalRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("municipal.write"),
  async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "市政單項目不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const [order] = await getDb()
      .select()
      .from(municipalOrders)
      .where(eq(municipalOrders.id, c.req.param("id")))
      .limit(1);
    if (!order) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到市政單。" } }, 404);
    }
    await getDb().transaction(async (tx) => {
      await tx
        .delete(municipalOrderLines)
        .where(eq(municipalOrderLines.municipalOrderId, order.id));
      await tx.insert(municipalOrderLines).values(
        parsed.data.lines.map((line) => ({
          municipalOrderId: order.id,
          sourceLineId: line.sourceLineId,
          name: line.name,
          description: line.description,
          position: line.position,
          measure: line.measure,
          length: line.length === null || line.length === undefined ? null : String(line.length),
          width: line.width === null || line.width === undefined ? null : String(line.width),
          dimensionUnit: line.dimensionUnit,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPriceCents: line.unitPriceCents,
          amountCents: line.amountCents,
          productStyleText: line.productStyleText,
        })),
      );
      await tx
        .update(municipalOrders)
        .set({ updatedAt: new Date() })
        .where(eq(municipalOrders.id, order.id));
      await tx.insert(auditLogs).values({
        actorId: c.get("user").id,
        action: "municipal_order_updated",
        entityType: "municipal_order",
        entityId: order.id,
        after: { lines: parsed.data.lines.length },
        requestId: c.get("requestId"),
      });
    });
    return c.json({ ok: true });
  },
);

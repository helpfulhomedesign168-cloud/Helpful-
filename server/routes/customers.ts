import { Hono } from "hono";
import { asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { customers } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30),
  whatsapp: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  district: z.string().trim().max(80).optional(),
});

export const customersRoute = new Hono<AppEnv>();

customersRoute.get(
  "/",
  requireAuth,
  requireCapability("customer.read"),
  async (c) => {
    const q = c.req.query("q")?.trim();
    const limit = Math.min(Number(c.req.query("limit") ?? 25) || 25, 100);
    const rows = await getDb()
      .select()
      .from(customers)
      .where(
        q
          ? or(
              ilike(customers.name, `%${q}%`),
              ilike(customers.phone, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(asc(customers.name))
      .limit(limit);
    return c.json(rows);
  },
);

customersRoute.post(
  "/",
  requireAuth,
  requireCapability("customer.write"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "客戶資料不完整。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const input = parsed.data;
    const existing = await getDb()
      .select()
      .from(customers)
      .where(eq(customers.phone, input.phone))
      .limit(1);
    if (existing[0]) return c.json(existing[0], 200);
    const created = await getDb()
      .insert(customers)
      .values({
        ...input,
        createdBy: c.get("user").id,
      })
      .returning();
    return c.json(created[0], 201);
  },
);

customersRoute.get(
  "/:id",
  requireAuth,
  requireCapability("customer.read"),
  async (c) => {
    const rows = await getDb()
      .select()
      .from(customers)
      .where(eq(customers.id, c.req.param("id")))
      .limit(1);
    if (!rows[0]) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "找不到客戶。" } },
        404,
      );
    }
    return c.json(rows[0]);
  },
);

import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { suppliers } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional(),
  contact: z.string().trim().max(120).optional(),
  active: z.boolean().optional(),
});

export const suppliersRoute = new Hono<AppEnv>();

suppliersRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb().select().from(suppliers).orderBy(asc(suppliers.name));
  return c.json(rows);
});

suppliersRoute.post(
  "/",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = supplierSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "供應商資料不正確。" } }, 400);
    }
    const [created] = await getDb().insert(suppliers).values(parsed.data).returning();
    return c.json(created, 201);
  },
);

suppliersRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = supplierSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "供應商資料不正確。" } }, 400);
    }
    const [updated] = await getDb()
      .update(suppliers)
      .set(parsed.data)
      .where(eq(suppliers.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "找不到供應商。" } }, 404);
    return c.json(updated);
  },
);

import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { contractors } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const contractorSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional(),
  active: z.boolean().optional(),
});

export const contractorsRoute = new Hono<AppEnv>();

contractorsRoute.get("/", requireAuth, async (c) => {
  return c.json(await getDb().select().from(contractors).orderBy(asc(contractors.name)));
});

contractorsRoute.post(
  "/",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = contractorSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "師傅資料不正確。" } }, 400);
    }
    const [created] = await getDb().insert(contractors).values(parsed.data).returning();
    return c.json(created, 201);
  },
);

contractorsRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = contractorSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "師傅資料不正確。" } }, 400);
    }
    const [updated] = await getDb()
      .update(contractors)
      .set(parsed.data)
      .where(eq(contractors.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "找不到師傅。" } }, 404);
    return c.json(updated);
  },
);

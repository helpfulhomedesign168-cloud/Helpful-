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
  type: z.enum(["contractor", "staff"]).optional(),
  kind: z.enum(["foreman", "worker"]).nullable().optional(),
  specialty: z.string().trim().max(120).nullable().optional(),
  mainWork: z.string().trim().max(80).nullable().optional(),
  scope: z.string().trim().max(500).nullable().optional(),
  details: z.string().trim().max(1000).nullable().optional(),
  trades: z.array(z.string().trim().max(40)).max(30).optional(),
  feeMode: z.enum(["project60", "daily", "fixed"]).nullable().optional(),
  feeAmount: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
});

export const contractorsRoute = new Hono<AppEnv>();

contractorsRoute.get("/", requireAuth, requireCapability("workorder.read"), async (c) => {
  return c.json(await getDb().select().from(contractors).orderBy(asc(contractors.name)));
});

contractorsRoute.post(
  "/",
  requireAuth,
  requireCapability("contractor.manage"),
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
  requireCapability("contractor.manage"),
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

contractorsRoute.delete(
  "/:id",
  requireAuth,
  requireCapability("contractor.manage"),
  async (c) => {
    const [deleted] = await getDb()
      .delete(contractors)
      .where(eq(contractors.id, c.req.param("id")))
      .returning({ id: contractors.id });
    if (!deleted) return c.json({ error: { code: "NOT_FOUND", message: "找不到師傅。" } }, 404);
    return c.json({ ok: true });
  },
);

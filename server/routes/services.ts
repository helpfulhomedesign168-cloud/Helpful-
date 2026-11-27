import { Hono } from "hono";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { auditLogs, serviceCategories, services } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const serviceSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(40),
  priceCents: z.number().int().nonnegative(),
  measure: z.enum(["area", "length", "quantity", "fixed"]),
  costMode: z.enum(["ratio", "fixed", "self"]).default("ratio"),
  published: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const servicesRoute = new Hono<AppEnv>();

servicesRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb()
    .select()
    .from(services)
    .where(eq(services.published, true))
    .orderBy(asc(services.category), asc(services.name));
  return c.json(rows);
});

servicesRoute.post(
  "/",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = serviceSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "工程項目資料不正確。" } }, 400);
    }
    const [created] = await getDb().insert(services).values(parsed.data).returning();
    return c.json(created, 201);
  },
);

servicesRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = serviceSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "工程項目資料不正確。" } }, 400);
    }
    const [updated] = await getDb()
      .update(services)
      .set(parsed.data)
      .where(eq(services.id, c.req.param("id")))
      .returning();
    if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "找不到工程項目。" } }, 404);
    return c.json(updated);
  },
);


servicesRoute.delete(
  "/:id",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const [deleted] = await getDb()
      .delete(services)
      .where(eq(services.id, c.req.param("id")))
      .returning({ id: services.id });
    if (!deleted) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到工程項目。" } }, 404);
    }
    return c.json({ ok: true });
  },
);

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});
const deleteCategoriesSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
});

export const serviceCategoriesRoute = new Hono<AppEnv>();

serviceCategoriesRoute.get("/", requireAuth, async (c) => {
  return c.json(
    await getDb()
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.name)),
  );
});

serviceCategoriesRoute.post(
  "/",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = categorySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "分類名稱不正確。" } }, 400);
    }
    const [created] = await getDb()
      .insert(serviceCategories)
      .values({ name: parsed.data.name })
      .onConflictDoNothing()
      .returning();
    if (!created) {
      return c.json({ error: { code: "CATEGORY_EXISTS", message: "此分類已存在。" } }, 409);
    }
    return c.json(created, 201);
  },
);

serviceCategoriesRoute.post(
  "/delete",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = deleteCategoriesSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "分類資料不正確。" } }, 400);
    }
    await getDb().transaction(async (tx) => {
      const deleted = await tx
        .delete(services)
        .where(inArray(services.category, parsed.data.names))
        .returning({ id: services.id });
      await tx
        .delete(serviceCategories)
        .where(inArray(serviceCategories.name, parsed.data.names));
      await tx.insert(auditLogs).values({
        actorId: c.get("user").id,
        action: "service_categories_deleted",
        entityType: "service_category",
        after: { names: parsed.data.names, deletedServices: deleted.length },
        requestId: c.get("requestId"),
      });
    });
    return c.json({ ok: true });
  },
);

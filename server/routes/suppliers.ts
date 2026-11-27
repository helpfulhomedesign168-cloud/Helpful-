import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { files, suppliers } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import {
  deleteSupplierLogo,
  signedSupplierLogo,
  uploadSupplierLogo,
} from "../storage";

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).optional(),
  contact: z.string().trim().max(120).optional(),
  contact2: z.string().trim().max(120).optional(),
  phone2: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  categories: z.array(z.string().trim().max(40)).max(30).optional(),
  hasProductStyles: z.boolean().optional(),
  active: z.boolean().optional(),
});

function withLogo(row: typeof suppliers.$inferSelect, url: string | null) {
  return { ...row, logoUrl: url };
}

export const suppliersRoute = new Hono<AppEnv>();

suppliersRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb()
    .select({ supplier: suppliers, file: files })
    .from(suppliers)
    .leftJoin(files, eq(suppliers.logoFileId, files.id))
    .orderBy(asc(suppliers.name));
  return c.json(
    await Promise.all(
      rows.map(async ({ supplier, file }) =>
        withLogo(
          supplier,
          file ? await signedSupplierLogo(file.storageKey).catch(() => null) : null,
        ),
      ),
    ),
  );
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
    return c.json(withLogo(created, null), 201);
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
    return c.json(withLogo(updated, null));
  },
);

suppliersRoute.post(
  "/:id/logo",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const [supplier] = await getDb()
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, c.req.param("id")))
      .limit(1);
    if (!supplier) return c.json({ error: { code: "NOT_FOUND", message: "找不到供應商。" } }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "請選擇 Logo。" } }, 400);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return c.json({ error: { code: "UNSUPPORTED_FILE", message: "只支援 JPG／PNG／WebP。" } }, 415);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "Logo 上限 5MB。" } }, 413);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = `suppliers/${supplier.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadSupplierLogo(storageKey, await file.arrayBuffer(), file.type);
    let inserted;
    try {
      [inserted] = await getDb()
        .insert(files)
        .values({
          ownerType: "supplier",
          ownerId: supplier.id,
          storageKey,
          filename: file.name.slice(0, 200),
          mime: file.type,
          sizeBytes: file.size,
          createdBy: c.get("user").id,
        })
        .returning();
      await getDb()
        .update(suppliers)
        .set({ logoFileId: inserted.id })
        .where(eq(suppliers.id, supplier.id));
    } catch (error) {
      await deleteSupplierLogo(storageKey).catch(() => {});
      throw error;
    }
    return c.json(
      {
        id: inserted.id,
        filename: inserted.filename,
        url: await signedSupplierLogo(storageKey).catch(() => null),
      },
      201,
    );
  },
);

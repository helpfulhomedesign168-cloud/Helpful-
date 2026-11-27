import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import {
  productStyleImages,
  productStyleSeries,
  suppliers,
} from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import {
  deleteProductStyleImage,
  signedProductStyleImage,
  uploadProductStyleImage,
} from "../storage";

const seriesSchema = z.object({ name: z.string().trim().min(1).max(160) });

export const productStylesRoute = new Hono<AppEnv>();

productStylesRoute.get("/suppliers", requireAuth, async (c) => {
  return c.json(
    await getDb()
      .select({ id: suppliers.id, name: suppliers.name, active: suppliers.active })
      .from(suppliers)
      .orderBy(asc(suppliers.name)),
  );
});

productStylesRoute.get("/suppliers/:id/series", requireAuth, async (c) => {
  const rows = await getDb()
    .select()
    .from(productStyleSeries)
    .where(eq(productStyleSeries.supplierId, c.req.param("id")))
    .orderBy(asc(productStyleSeries.name));
  return c.json(
    await Promise.all(
      rows.map(async (series) => {
        const images = await getDb()
          .select()
          .from(productStyleImages)
          .where(eq(productStyleImages.seriesId, series.id))
          .orderBy(asc(productStyleImages.createdAt));
        return {
          ...series,
          images: await Promise.all(
            images.map(async (image) => ({
              id: image.id,
              filename: image.filename,
              mime: image.mime,
              sizeBytes: image.sizeBytes,
              url: await signedProductStyleImage(image.storageKey).catch(() => null),
            })),
          ),
        };
      }),
    ),
  );
});

productStylesRoute.post(
  "/suppliers/:id/series",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = seriesSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "系列名稱不正確。" } }, 400);
    }
    const [supplier] = await getDb()
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, c.req.param("id")))
      .limit(1);
    if (!supplier) return c.json({ error: { code: "NOT_FOUND", message: "找不到供應商。" } }, 404);
    const [created] = await getDb()
      .insert(productStyleSeries)
      .values({
        supplierId: supplier.id,
        name: parsed.data.name,
        createdBy: c.get("user").id,
      })
      .returning();
    return c.json({ ...created, images: [] }, 201);
  },
);

productStylesRoute.post(
  "/series/:id/images",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const [series] = await getDb()
      .select()
      .from(productStyleSeries)
      .where(eq(productStyleSeries.id, c.req.param("id")))
      .limit(1);
    if (!series) return c.json({ error: { code: "NOT_FOUND", message: "找不到系列。" } }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "請選擇圖片。" } }, 400);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return c.json({ error: { code: "UNSUPPORTED_FILE", message: "只支援 JPG／PNG／WebP。" } }, 415);
    }
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "圖片上限 10MB。" } }, 413);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = `series/${series.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadProductStyleImage(storageKey, await file.arrayBuffer(), file.type);
    let inserted;
    try {
      [inserted] = await getDb()
        .insert(productStyleImages)
        .values({
          seriesId: series.id,
          storageKey,
          filename: file.name.slice(0, 200),
          mime: file.type,
          sizeBytes: file.size,
          createdBy: c.get("user").id,
        })
        .returning();
    } catch (error) {
      await deleteProductStyleImage(storageKey).catch(() => {});
      throw error;
    }
    return c.json(
      {
        id: inserted.id,
        filename: inserted.filename,
        url: await signedProductStyleImage(storageKey).catch(() => null),
      },
      201,
    );
  },
);

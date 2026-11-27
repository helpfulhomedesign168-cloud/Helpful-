import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { auditLogs, files, workOrders } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import {
  deleteWorkOrderPhoto,
  signedWorkOrderPhoto,
  uploadWorkOrderPhoto,
} from "../storage";

const error = (code: string, message: string) => ({
  error: { code, message },
});

function canSeeOrder(
  user: { id: string; role: string },
  order: { csOwnerId: string | null },
) {
  if (["admin", "admin_staff", "cs_supervisor"].includes(user.role)) return true;
  if (["finance", "finance_supervisor"].includes(user.role)) return true;
  if (user.role === "cs") return order.csOwnerId === user.id;
  return false;
}

async function getOrder(id: string) {
  const rows = await getDb()
    .select({ id: workOrders.id, csOwnerId: workOrders.csOwnerId, status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  return rows[0];
}

export const photosRoute = new Hono<AppEnv>();

photosRoute.get(
  "/:id/photos",
  requireAuth,
  requireCapability("workorder.read"),
  async (c) => {
    const order = await getOrder(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有查看此工程的權限。"), 403);
    }
    const rows = await getDb()
      .select()
      .from(files)
      .where(and(eq(files.ownerType, "work_order"), eq(files.ownerId, order.id)))
      .orderBy(desc(files.createdAt));
    const photos = await Promise.all(
      rows.map(async (file) => ({
        id: file.id,
        filename: file.filename,
        mime: file.mime,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        url: await signedWorkOrderPhoto(file.storageKey).catch(() => null),
      })),
    );
    return c.json(photos);
  },
);

photosRoute.post(
  "/:id/photos",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await getOrder(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可新增相片。"), 409);
    }
    const body = await c.req.parseBody();
    const file = body.photo;
    if (!(file instanceof File)) {
      return c.json(error("VALIDATION_ERROR", "請選擇相片檔案。"), 400);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return c.json(error("UNSUPPORTED_FILE", "只支援 JPG／PNG／WebP。"), 415);
    }
    if (file.size > 4 * 1024 * 1024) {
      return c.json(error("FILE_TOO_LARGE", "相片上限 4MB。"), 413);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const storageKey = `work-orders/${order.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadWorkOrderPhoto(storageKey, await file.arrayBuffer(), file.type);
    let inserted;
    try {
      [inserted] = await getDb()
        .insert(files)
        .values({
          ownerType: "work_order",
          ownerId: order.id,
          storageKey,
          filename: file.name.slice(0, 200),
          mime: file.type,
          sizeBytes: file.size,
          createdBy: c.get("user").id,
        })
        .returning();
    } catch (e) {
      await deleteWorkOrderPhoto(storageKey).catch(() => {});
      throw e;
    }
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_photo_added",
      entityType: "work_order",
      entityId: order.id,
      after: { fileId: inserted.id, filename: inserted.filename },
      requestId: c.get("requestId"),
    });
    return c.json(
      {
        id: inserted.id,
        filename: inserted.filename,
        mime: inserted.mime,
        sizeBytes: inserted.sizeBytes,
        createdAt: inserted.createdAt,
        url: await signedWorkOrderPhoto(storageKey),
      },
      201,
    );
  },
);

photosRoute.delete(
  "/:id/photos/:fileId",
  requireAuth,
  requireCapability("workorder.update"),
  async (c) => {
    const order = await getOrder(c.req.param("id"));
    if (!order) return c.json(error("NOT_FOUND", "找不到工程單。"), 404);
    if (!canSeeOrder(c.get("user"), order)) {
      return c.json(error("FORBIDDEN", "你沒有修改此工程的權限。"), 403);
    }
    if (order.status === "completed") {
      return c.json(error("WORK_ORDER_COMPLETED", "已完成的工程不可刪除相片。"), 409);
    }
    const rows = await getDb()
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, c.req.param("fileId")),
          eq(files.ownerType, "work_order"),
          eq(files.ownerId, order.id),
        ),
      )
      .limit(1);
    if (!rows[0]) return c.json(error("NOT_FOUND", "找不到相片。"), 404);
    await deleteWorkOrderPhoto(rows[0].storageKey);
    await getDb().delete(files).where(eq(files.id, rows[0].id));
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "work_order_photo_deleted",
      entityType: "work_order",
      entityId: order.id,
      before: { fileId: rows[0].id, filename: rows[0].filename },
      requestId: c.get("requestId"),
    });
    return c.json({ ok: true });
  },
);

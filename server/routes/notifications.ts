import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { notifications } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";

export const notificationsRoute = new Hono<AppEnv>();

notificationsRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, c.get("user").id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return c.json(rows);
});

notificationsRoute.post("/read-all", requireAuth, async (c) => {
  await getDb()
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, c.get("user").id), eq(notifications.read, false)));
  return c.json({ ok: true });
});

notificationsRoute.post("/:id/read", requireAuth, async (c) => {
  const updated = await getDb()
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, c.req.param("id")),
        eq(notifications.userId, c.get("user").id),
      ),
    )
    .returning({ id: notifications.id, read: notifications.read });
  if (!updated[0]) {
    return c.json({ error: { code: "NOT_FOUND", message: "找不到通知。" } }, 404);
  }
  return c.json(updated[0]);
});

import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { ROLES } from "../roles";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

export const usersRoute = new Hono<AppEnv>();

usersRoute.get(
  "/",
  requireAuth,
  requireCapability("user.manage"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
    return c.json(rows);
  },
);

usersRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("user.manage"),
  async (c) => {
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "用戶資料不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "沒有可更新欄位。" } },
        400,
      );
    }
    const current = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, c.req.param("id")))
      .limit(1);
    if (!current[0]) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "找不到用戶。" } },
        404,
      );
    }
    const updated = await getDb()
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, c.req.param("id")))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
      });
    return c.json(updated[0]);
  },
);

import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { auditLogs, users } from "../db/schema";
import { ROLES } from "../roles";
import { getEnv, getOptionalEnv } from "../env";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES),
});

export const usersRoute = new Hono<AppEnv>();

usersRoute.post(
  "/",
  requireAuth,
  requireCapability("user.manage"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "用戶資料不完整；密碼最少 8 個字元。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const serviceKey = getOptionalEnv().serviceRoleKey;
    if (!serviceKey) {
      return c.json(
        { error: { code: "AUTH_NOT_CONFIGURED", message: "用戶服務未設定。" } },
        503,
      );
    }
    const env = getEnv();
    const existing = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()))
      .limit(1);
    if (existing[0]) {
      return c.json(
        { error: { code: "EMAIL_EXISTS", message: "此 Email 已有帳戶。" } },
        409,
      );
    }
    const authRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { name: parsed.data.name },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const authUser = (await authRes.json().catch(() => null)) as
      | { id?: string; msg?: string }
      | null;
    if (!authRes.ok || !authUser?.id) {
      return c.json(
        {
          error: {
            code: "AUTH_CREATE_FAILED",
            message: authUser?.msg ?? "未能建立登入帳戶。",
          },
        },
        422,
      );
    }
    try {
      const [created] = await getDb()
        .insert(users)
        .values({
          id: authUser.id,
          email: parsed.data.email.toLowerCase(),
          name: parsed.data.name,
          role: parsed.data.role,
          active: true,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          active: users.active,
        });
      await getDb().insert(auditLogs).values({
        actorId: c.get("user").id,
        action: "user_created",
        entityType: "user",
        entityId: created.id,
        after: { email: created.email, role: created.role },
        requestId: c.get("requestId"),
      });
      return c.json(created, 201);
    } catch (error) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
        method: "DELETE",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      }).catch(() => {});
      throw error;
    }
  },
);

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

usersRoute.post(
  "/:id/reset-password",
  requireAuth,
  requireCapability("user.manage"),
  async (c) => {
    const serviceKey = getOptionalEnv().serviceRoleKey;
    if (!serviceKey) {
      return c.json(
        { error: { code: "AUTH_NOT_CONFIGURED", message: "用戶服務未設定。" } },
        503,
      );
    }
    const [target] = await getDb()
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, c.req.param("id")))
      .limit(1);
    if (!target) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到用戶。" } }, 404);
    }
    const password = `${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}Aa1!`;
    const res = await fetch(
      `${getEnv().SUPABASE_URL}/auth/v1/admin/users/${target.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return c.json(
        {
          error: {
            code: "AUTH_UPDATE_FAILED",
            message: body?.msg ?? "未能重設密碼。",
          },
        },
        502,
      );
    }
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "user_password_reset",
      entityType: "user",
      entityId: target.id,
      after: { email: target.email },
      requestId: c.get("requestId"),
    });
    return c.json({ ok: true, password });
  },
);

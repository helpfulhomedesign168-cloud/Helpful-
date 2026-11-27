import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { auditLogs, files, users } from "../db/schema";
import { ROLES } from "../roles";
import { getEnv, getOptionalEnv } from "../env";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import {
  deleteUserAvatar,
  signedUserAvatar,
  uploadUserAvatar,
} from "../storage";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  code: z.string().trim().max(20).nullable().optional(),
  surname: z.string().trim().max(40).nullable().optional(),
  salutation: z.string().trim().max(60).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  companyPhone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  emergencyName: z.string().trim().max(120).nullable().optional(),
  emergencyPhone: z.string().trim().max(40).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  team: z.string().trim().max(20).nullable().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  role: z.enum(ROLES),
  code: z.string().trim().max(20).optional(),
  surname: z.string().trim().max(40).optional(),
  salutation: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(40).optional(),
  companyPhone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  emergencyName: z.string().trim().max(120).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(1000).optional(),
  team: z.string().trim().max(20).optional(),
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
          code: parsed.data.code,
          surname: parsed.data.surname,
          salutation: parsed.data.salutation,
          phone: parsed.data.phone,
          companyPhone: parsed.data.companyPhone,
          address: parsed.data.address,
          emergencyName: parsed.data.emergencyName,
          emergencyPhone: parsed.data.emergencyPhone,
          bio: parsed.data.bio,
          team: parsed.data.team,
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
        user: users,
        file: files,
      })
      .from(users)
      .leftJoin(files, eq(users.avatarFileId, files.id))
      .orderBy(asc(users.name));
    return c.json(
      await Promise.all(
        rows.map(async ({ user, file }) => ({
          ...user,
          avatarUrl: file
            ? await signedUserAvatar(file.storageKey).catch(() => null)
            : null,
        })),
      ),
    );
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


usersRoute.post(
  "/:id/avatar",
  requireAuth,
  requireCapability("user.manage"),
  async (c) => {
    const [target] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, c.req.param("id")))
      .limit(1);
    if (!target) return c.json({ error: { code: "NOT_FOUND", message: "找不到用戶。" } }, 404);
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "請選擇相片。" } }, 400);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return c.json({ error: { code: "UNSUPPORTED_FILE", message: "只支援 JPG／PNG／WebP。" } }, 415);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "相片上限 5MB。" } }, 413);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = `users/${target.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadUserAvatar(storageKey, await file.arrayBuffer(), file.type);
    let inserted;
    try {
      [inserted] = await getDb()
        .insert(files)
        .values({
          ownerType: "user",
          ownerId: target.id,
          storageKey,
          filename: file.name.slice(0, 200),
          mime: file.type,
          sizeBytes: file.size,
          createdBy: c.get("user").id,
        })
        .returning();
      await getDb()
        .update(users)
        .set({ avatarFileId: inserted.id })
        .where(eq(users.id, target.id));
    } catch (error) {
      await deleteUserAvatar(storageKey).catch(() => {});
      throw error;
    }
    return c.json(
      {
        id: inserted.id,
        filename: inserted.filename,
        url: await signedUserAvatar(storageKey).catch(() => null),
      },
      201,
    );
  },
);

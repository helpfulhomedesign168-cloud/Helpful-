import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { getEnv, getOptionalEnv } from "../env";
import type { AppEnv } from "../auth";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const authError = (message = "Email 或密碼不正確。") => ({
  error: { code: "INVALID_CREDENTIALS", message },
});

async function supabaseToken(
  body: Record<string, string>,
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | Response> {
  const env = getEnv();
  const serviceKey = getOptionalEnv().serviceRoleKey;
  if (!serviceKey) {
    return Response.json(
      { error: { code: "AUTH_NOT_CONFIGURED", message: "登入服務未設定。" } },
      { status: 503 },
    );
  }
  const response = await fetch(
    `${env.SUPABASE_URL}/auth/v1/token?grant_type=${encodeURIComponent(body.grant_type)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) return Response.json(authError(), { status: 401 });
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export const authRoute = new Hono<AppEnv>();

authRoute.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "請輸入有效的 Email 及密碼。",
        },
      },
      400,
    );
  }
  const session = await supabaseToken({
    grant_type: "password",
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (session instanceof Response) return session;

  const env = getEnv();
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: getOptionalEnv().serviceRoleKey!,
      Authorization: `Bearer ${session.access_token}`,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return c.json(authError(), 401);
  const authUser = (await response.json()) as { id: string; email?: string };
  const rows = await getDb()
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);
  if (!rows[0] || !rows[0].active) {
    return c.json(
      { error: { code: "ACCOUNT_DISABLED", message: "此帳戶未開通或已停用。" } },
      403,
    );
  }
  return c.json({
    ...session,
    user: {
      id: rows[0].id,
      email: rows[0].email,
      name: rows[0].name,
      role: rows[0].role,
    },
  });
});

authRoute.post("/refresh", async (c) => {
  const parsed = refreshSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Refresh token 無效。" } },
      400,
    );
  }
  const session = await supabaseToken({
    grant_type: "refresh_token",
    refresh_token: parsed.data.refresh_token,
  });
  if (session instanceof Response) return session;
  return c.json(session);
});

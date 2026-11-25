import type { MiddlewareHandler } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { users } from "./db/schema";
import { getEnv, getOptionalEnv } from "./env";
import type { Role } from "./roles";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type AppEnv = {
  Variables: {
    user: AppUser;
    requestId: string;
  };
};

const errorBody = (code: string, message: string) => ({
  error: { code, message },
});

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return c.json(errorBody("UNAUTHENTICATED", "請先登入。"), 401);
  }
  try {
    const env = getEnv();
    const jwksUrl =
      getOptionalEnv().jwksUrl ??
      `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });
    if (!payload.sub) {
      return c.json(errorBody("UNAUTHENTICATED", "登入憑證缺少使用者。"), 401);
    }
    const rows = await getDb()
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    const user = rows[0];
    if (!user || !user.active) {
      return c.json(errorBody("UNAUTHENTICATED", "使用者不存在或已停用。"), 401);
    }
    c.set("user", {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await next();
  } catch {
    return c.json(errorBody("UNAUTHENTICATED", "登入憑證無效或已過期。"), 401);
  }
};

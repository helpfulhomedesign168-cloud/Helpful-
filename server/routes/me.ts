import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { ROLE_CAPABILITIES } from "../permissions";

export const me = new Hono<AppEnv>();

me.get("/", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: ROLE_CAPABILITIES[user.role] ?? [],
  });
});

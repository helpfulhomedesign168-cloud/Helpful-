import { Hono } from "hono";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";

export const staffRoute = new Hono<AppEnv>();

staffRoute.get("/", requireAuth, async (c) => {
  const requested = (c.req.query("roles") ?? "cs,cs_supervisor")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  const allowed = ["cs", "cs_supervisor", "admin"] as const;
  const roles = requested.filter((role): role is (typeof allowed)[number] =>
    (allowed as readonly string[]).includes(role),
  );
  if (!roles.length) return c.json([]);
  const rows = await getDb()
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, roles)))
    .orderBy(asc(users.name));
  return c.json(rows);
});

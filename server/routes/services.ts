import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { services } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";

export const servicesRoute = new Hono<AppEnv>();

servicesRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb()
    .select()
    .from(services)
    .where(eq(services.published, true))
    .orderBy(asc(services.category), asc(services.name));
  return c.json(rows);
});

import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import type { AppEnv } from "../auth";

export const health = new Hono<AppEnv>();

health.get("/", (c) =>
  c.json({
    status: "ok",
    service: "helpful-home-api",
    version: "0.1.0",
    time: new Date().toISOString(),
  }),
);

health.get("/ready", async (c) => {
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not_ready" }, 503);
  }
});

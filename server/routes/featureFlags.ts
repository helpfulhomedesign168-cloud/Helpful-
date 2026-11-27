import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { featureFlags } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const patchSchema = z.object({
  key: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
});

export const featureFlagsRoute = new Hono<AppEnv>();

featureFlagsRoute.get("/", requireAuth, async (c) => {
  const rows = await getDb()
    .select()
    .from(featureFlags)
    .orderBy(asc(featureFlags.key));
  return c.json(rows);
});

featureFlagsRoute.patch(
  "/",
  requireAuth,
  requireCapability("feature_flags.manage"),
  async (c) => {
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Feature flag 資料不正確。",
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
    const existing = await getDb()
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, parsed.data.key))
      .limit(1);
    if (!existing[0]) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "找不到 feature flag。" } },
        404,
      );
    }
    const updated = await getDb()
      .update(featureFlags)
      .set({
        enabled: parsed.data.enabled,
        updatedBy: c.get("user").id,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.key, parsed.data.key))
      .returning();
    return c.json(updated[0]);
  },
);

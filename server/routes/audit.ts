import { Hono } from "hono";
import { desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "../db/client";
import { auditLogs, users } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

export const auditRoute = new Hono<AppEnv>();

auditRoute.get(
  "/",
  requireAuth,
  requireCapability("audit.read"),
  async (c) => {
    const q = c.req.query("q")?.trim();
    const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 200);
    const rows = await getDb()
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        before: auditLogs.before,
        after: auditLogs.after,
        requestId: auditLogs.requestId,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(
        q
          ? or(
              ilike(auditLogs.action, `%${q}%`),
              ilike(auditLogs.entityType, `%${q}%`),
              ilike(users.name, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    return c.json(rows);
  },
);

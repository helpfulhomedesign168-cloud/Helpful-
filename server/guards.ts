import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./auth";
import { hasCapability, type Capability } from "./permissions";

export const requireCapability = (
  capability: Capability,
): MiddlewareHandler<AppEnv> => async (c, next) => {
  const user = c.get("user");
  if (!user || !hasCapability(user.role, capability)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "你沒有執行此操作的權限。",
        },
      },
      403,
    );
  }
  await next();
};

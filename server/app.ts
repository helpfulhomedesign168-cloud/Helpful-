import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppEnv } from "./auth";
import { health } from "./routes/health";
import { me } from "./routes/me";
import { customersRoute } from "./routes/customers";
import { servicesRoute } from "./routes/services";
import { usersRoute } from "./routes/users";
import { featureFlagsRoute } from "./routes/featureFlags";

export const app = new Hono<AppEnv>().basePath("/api/v1");

app.use("*", logger());
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.header("x-request-id", c.get("requestId"));
  await next();
});

app.route("/health", health);
app.route("/me", me);
app.route("/customers", customersRoute);
app.route("/services", servicesRoute);
app.route("/users", usersRoute);
app.route("/feature-flags", featureFlagsRoute);

app.notFound((c) =>
  c.json(
    {
      error: { code: "NOT_FOUND", message: "找不到 API endpoint。" },
      request_id: c.get("requestId"),
    },
    404,
  ),
);

app.onError((error, c) => {
  console.error(error);
  return c.json(
    {
      error: { code: "INTERNAL_ERROR", message: "伺服器暫時無法處理請求。" },
      request_id: c.get("requestId"),
    },
    500,
  );
});

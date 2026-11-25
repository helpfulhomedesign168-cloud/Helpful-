import "dotenv/config";

import type { Config } from "drizzle-kit";

export default {
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/helpful",
  },
} satisfies Config;

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Missing backend environment: " +
        parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  }
  cached = parsed.data;
  return cached;
}

export function getOptionalEnv() {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    jwksUrl: process.env.SUPABASE_JWKS_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

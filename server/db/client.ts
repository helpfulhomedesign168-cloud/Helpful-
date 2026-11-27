import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../env";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!database) {
    client = postgres(getEnv().DATABASE_URL, {
      max: 5,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }
  return database;
}

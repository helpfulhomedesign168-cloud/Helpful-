import "dotenv/config";
import { createSeedState } from "../../src/domain/engine";
import { getDb } from "../db/client";
import { services } from "../db/schema";

const seed = createSeedState();
const db = getDb();
let inserted = 0;
for (const item of seed.services) {
  await db
    .insert(services)
    .values({
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      priceCents: Math.round(item.price * 100),
      measure: item.measure,
      costMode: item.costMode,
      published: item.published,
      metadata: item as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: services.code,
      set: {
        name: item.name,
        category: item.category,
        unit: item.unit,
        priceCents: Math.round(item.price * 100),
        measure: item.measure,
        costMode: item.costMode,
        published: item.published,
        metadata: item as unknown as Record<string, unknown>,
      },
    });
  inserted += 1;
}
console.log(`seeded ${inserted} services`);
process.exit(0);

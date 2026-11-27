import "dotenv/config";
import { createSeedState } from "../../src/domain/engine";
import { getDb } from "../db/client";
import { services, users } from "../db/schema";
import { getEnv, getOptionalEnv } from "../env";
import { eq } from "drizzle-orm";

const env = getEnv();
const serviceKey = getOptionalEnv().serviceRoleKey;
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

async function ensureBucket(name: string, publicRead = false) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ name, public: publicRead }),
  });
  const body = await res.text();
  if (res.ok) return `created ${name}`;
  if (res.status === 409 || body.includes("BucketAlreadyExists")) {
    return `exists ${name}`;
  }
  return `failed ${name} (${res.status}): ${body.slice(0, 120)}`;
}

const db = getDb();
let count = 0;
for (const item of createSeedState().services) {
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
  count += 1;
}

for (const bucket of ["work-order-photos", "payment-proofs", "product-style-images"]) {
  console.log(await ensureBucket(bucket));
}

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminName = process.env.ADMIN_NAME?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminName && adminPassword) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  if (existing[0]) {
    console.log(`admin exists ${adminEmail}`);
  } else {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: adminName },
      }),
    });
    const authUser = (await res.json()) as { id?: string; msg?: string };
    if (!res.ok || !authUser.id) {
      throw new Error(`admin auth failed: ${authUser.msg ?? res.status}`);
    }
    await db.insert(users).values({
      id: authUser.id,
      email: adminEmail,
      name: adminName,
      role: "admin",
      active: true,
    });
    console.log(`admin created ${adminEmail}`);
  }
} else {
  console.log("admin skipped (set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD)");
}

console.log(`services seeded ${count}`);
process.exit(0);

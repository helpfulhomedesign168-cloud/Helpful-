import { describe, expect, it } from "vitest";
import { app } from "../server/app";
import { hasCapability } from "../server/permissions";

describe("API foundation", () => {
  it("health endpoint works without database", async () => {
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("unknown endpoint returns JSON 404", async () => {
    const res = await app.request("/api/v1/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("admin routes reject unauthenticated requests", async () => {
    expect((await app.request("/api/v1/users")).status).toBe(401);
    expect((await app.request("/api/v1/feature-flags")).status).toBe(401);
  });

  it("permissions separate invoice clerk from CS", () => {
    expect(hasCapability("invoice_clerk", "invoice.create")).toBe(true);
    expect(hasCapability("cs", "invoice.create")).toBe(false);
    expect(hasCapability("cs_supervisor", "workorder.assign")).toBe(true);
    expect(hasCapability("finance", "payment.validate")).toBe(true);
    expect(hasCapability("admin", "user.manage")).toBe(true);
    expect(hasCapability("admin_staff", "user.manage")).toBe(false);
  });
});

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { files, invoices } from "../db/schema";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";
import {
  deletePaymentProof,
  signedPaymentProof,
  uploadPaymentProof,
} from "../storage";

export const paymentProofsRoute = new Hono<AppEnv>();

paymentProofsRoute.post(
  "/:invoiceId/proofs",
  requireAuth,
  requireCapability("payment.register"),
  async (c) => {
    const [invoice] = await getDb()
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, c.req.param("invoiceId")))
      .limit(1);
    if (!invoice) {
      return c.json({ error: { code: "NOT_FOUND", message: "找不到發票。" } }, 404);
    }
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "請選擇付款證明。" } }, 400);
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      return c.json({ error: { code: "UNSUPPORTED_FILE", message: "只支援 JPG／PNG／WebP／PDF。" } }, 415);
    }
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "付款證明上限 10MB。" } }, 413);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = `invoices/${invoice.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadPaymentProof(storageKey, await file.arrayBuffer(), file.type);
    let inserted;
    try {
      [inserted] = await getDb()
        .insert(files)
        .values({
          ownerType: "invoice",
          ownerId: invoice.id,
          storageKey,
          filename: file.name.slice(0, 200),
          mime: file.type,
          sizeBytes: file.size,
          createdBy: c.get("user").id,
        })
        .returning();
    } catch (error) {
      await deletePaymentProof(storageKey).catch(() => {});
      throw error;
    }
    return c.json(
      {
        id: inserted.id,
        filename: inserted.filename,
        mime: inserted.mime,
        sizeBytes: inserted.sizeBytes,
        url: await signedPaymentProof(storageKey),
      },
      201,
    );
  },
);

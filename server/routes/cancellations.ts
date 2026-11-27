import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { auditLogs, cancellationCases, customers, files, invoices } from "../db/schema";
import { signedCancellationProof, uploadCancellationProof } from "../storage";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { requireCapability } from "../guards";

const createSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});

const updateSchema = z.object({
  status: z
    .enum(["pending", "awaiting_credit_note", "awaiting_transfer", "completed"])
    .optional(),
  refundAmountCents: z.number().int().nonnegative().optional(),
  deductionsCents: z.number().int().nonnegative().optional(),
  refundReason: z.string().trim().max(1000).nullable().optional(),
  bankName: z.string().trim().max(120).nullable().optional(),
  bankAccountName: z.string().trim().max(120).nullable().optional(),
  bankAccountNumber: z.string().trim().max(80).nullable().optional(),
  transferReference: z.string().trim().max(200).nullable().optional(),
  commissionReversals: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
});

const error = (code: string, message: string) => ({
  error: { code, message },
});

export const cancellationsRoute = new Hono<AppEnv>();

cancellationsRoute.get(
  "/",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const rows = await getDb()
      .select({
        id: cancellationCases.id,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        customerName: customers.name,
        customerPhone: customers.phone,
        reason: cancellationCases.reason,
        status: cancellationCases.status,
        refundAmountCents: cancellationCases.refundAmountCents,
        deductionsCents: cancellationCases.deductionsCents,
        createdAt: cancellationCases.createdAt,
        updatedAt: cancellationCases.updatedAt,
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .orderBy(desc(cancellationCases.createdAt));
    return c.json(rows);
  },
);

cancellationsRoute.get(
  "/:id",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const rows = await getDb()
      .select({
        case: cancellationCases,
        invoice: {
          id: invoices.id,
          number: invoices.number,
          totalCents: invoices.totalCents,
          validPaidCents: invoices.validPaidCents,
          status: invoices.status,
        },
        customer: {
          name: customers.name,
          phone: customers.phone,
          address: customers.address,
          district: customers.district,
        },
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(cancellationCases.id, c.req.param("id")))
      .limit(1);
    if (!rows[0]) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    const filesById = async (id: string | null) => {
      if (!id) return null;
      const [file] = await getDb().select().from(files).where(eq(files.id, id)).limit(1);
      if (!file) return null;
      return { id: file.id, filename: file.filename, mime: file.mime, url: await signedCancellationProof(file.storageKey).catch(() => null) };
    };
    return c.json({
      ...rows[0],
      creditNote: await filesById(rows[0].case.creditNoteFileId),
      signedCreditNote: await filesById(rows[0].case.signedCreditNoteFileId),
      transferProof: await filesById(rows[0].case.transferProofFileId),
    });
  },
);

cancellationsRoute.post(
  "/",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(error("VALIDATION_ERROR", "退款資料不正確。"), 400);
    }
    const [invoice] = await getDb()
      .select()
      .from(invoices)
      .where(eq(invoices.id, parsed.data.invoiceId))
      .limit(1);
    if (!invoice) return c.json(error("NOT_FOUND", "找不到發票。"), 404);
    const [created] = await getDb()
      .insert(cancellationCases)
      .values({
        invoiceId: invoice.id,
        reason: parsed.data.reason,
        createdBy: c.get("user").id,
      })
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "cancellation_case_created",
      entityType: "cancellation_case",
      entityId: created.id,
      after: { invoiceNumber: invoice.number, reason: parsed.data.reason },
      requestId: c.get("requestId"),
    });
    return c.json(created, 201);
  },
);

cancellationsRoute.patch(
  "/:id",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "退款資料不正確。" } },
        400,
      );
    }
    const [current] = await getDb()
      .select({
        case: cancellationCases,
        invoice: invoices,
      })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .where(eq(cancellationCases.id, c.req.param("id")))
      .limit(1);
    if (!current) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    if (
      parsed.data.refundAmountCents !== undefined &&
      parsed.data.refundAmountCents > current.invoice.validPaidCents
    ) {
      return c.json(error("REFUND_EXCEEDS_PAID", "退款金額不可超過已收金額。"), 422);
    }
    const [updated] = await getDb()
      .update(cancellationCases)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
        completedAt:
          parsed.data.status === "completed"
            ? new Date()
            : current.case.completedAt,
      })
      .where(eq(cancellationCases.id, current.case.id))
      .returning();
    await getDb().insert(auditLogs).values({
      actorId: c.get("user").id,
      action: "cancellation_case_updated",
      entityType: "cancellation_case",
      entityId: current.case.id,
      before: {
        status: current.case.status,
        refundAmountCents: current.case.refundAmountCents,
      },
      after: parsed.data,
      requestId: c.get("requestId"),
    });
    return c.json(updated);
  },
);


cancellationsRoute.post(
  "/:id/proofs",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const [current] = await getDb().select().from(cancellationCases).where(eq(cancellationCases.id, c.req.param("id"))).limit(1);
    if (!current) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    const body = await c.req.parseBody();
    const file = body.file;
    const kind = String(body.kind ?? "");
    if (!["credit_note", "signed_credit_note", "transfer_proof"].includes(kind)) {
      return c.json(error("VALIDATION_ERROR", "文件類型不正確。"), 400);
    }
    if (!(file instanceof File)) return c.json(error("VALIDATION_ERROR", "請選擇文件。"), 400);
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      return c.json(error("UNSUPPORTED_FILE", "只支援 JPG／PNG／WebP／PDF。"), 415);
    }
    if (file.size > 10 * 1024 * 1024) return c.json(error("FILE_TOO_LARGE", "文件上限 10MB。"), 413);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const storageKey = `cancellations/${current.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadCancellationProof(storageKey, await file.arrayBuffer(), file.type);
    const [inserted] = await getDb().insert(files).values({
      ownerType: "cancellation_case", ownerId: current.id, storageKey,
      filename: file.name.slice(0, 200), mime: file.type, sizeBytes: file.size,
      createdBy: c.get("user").id,
    }).returning();
    const field = kind === "credit_note" ? "creditNoteFileId" : kind === "signed_credit_note" ? "signedCreditNoteFileId" : "transferProofFileId";
    await getDb().update(cancellationCases).set({ [field]: inserted.id, updatedAt: new Date() }).where(eq(cancellationCases.id, current.id));
    return c.json({ id: inserted.id, filename: inserted.filename, url: await signedCancellationProof(storageKey).catch(() => null) }, 201);
  },
);

cancellationsRoute.post(
  "/:id/complete",
  requireAuth,
  requireCapability("refund.manage"),
  async (c) => {
    const [row] = await getDb()
      .select({ case: cancellationCases, invoice: invoices })
      .from(cancellationCases)
      .innerJoin(invoices, eq(cancellationCases.invoiceId, invoices.id))
      .where(eq(cancellationCases.id, c.req.param("id")))
      .limit(1);
    if (!row) return c.json(error("NOT_FOUND", "找不到退款個案。"), 404);
    const item = row.case;
    if (item.status === "completed") return c.json(error("ALREADY_COMPLETED", "退款已完成。"), 409);
    if (item.refundAmountCents <= 0 || !item.bankName || !item.bankAccountName || !item.bankAccountNumber) {
      return c.json(error("REFUND_INCOMPLETE", "請先填寫退款金額及銀行資料。"), 422);
    }
    if (!item.creditNoteFileId || !item.signedCreditNoteFileId || !item.transferProofFileId) {
      return c.json(error("DOCUMENTS_INCOMPLETE", "請先上載 Credit Note、已簽 Credit Note 及轉帳證明。"), 422);
    }
    if (item.refundAmountCents > row.invoice.validPaidCents) {
      return c.json(error("REFUND_EXCEEDS_PAID", "退款金額不可超過已收金額。"), 422);
    }
    const shares: Array<{ actorId: string | null; actorName: string; amount: number }> = [];
    const addShare = (actorName: string | null, rate: number) => {
      if (!actorName || !actorName.trim() || rate <= 0) return;
      shares.push({
        actorId: null,
        actorName: actorName.trim(),
        amount: Math.round((row.invoice.totalCents * rate) / 100),
      });
    };
    addShare(row.invoice.salesName, 0.08);
    addShare(
      row.invoice.supervisorName,
      row.invoice.team === "B" ? 0.03 : 0.04,
    );
    await getDb().transaction(async (tx) => {
      await tx.update(cancellationCases).set({ status: "completed", commissionReversals: shares, completedAt: new Date(), completedBy: c.get("user").id, updatedAt: new Date() }).where(eq(cancellationCases.id, item.id));
      await tx.update(invoices).set({ status: "refunded", updatedAt: new Date() }).where(eq(invoices.id, row.invoice.id));
      await tx.insert(auditLogs).values({ actorId: c.get("user").id, action: "cancellation_completed", entityType: "cancellation_case", entityId: item.id, after: { refundAmountCents: item.refundAmountCents, invoiceId: row.invoice.id }, requestId: c.get("requestId") });
    });
    return c.json({ ok: true });
  },
);

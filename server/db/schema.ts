import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLES } from "../roles";

export const roleEnum = pgEnum("role", ROLES);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "issued",
  "partially_paid",
  "paid",
  "released",
  "completed",
  "voided",
  "refunded",
]);
export const invoiceCategoryEnum = pgEnum("invoice_category", [
  "self-pay",
  "grant-80k",
  "group-buy",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "fps",
  "transfer",
  "cheque",
]);
export const paymentCustodyEnum = pgEnum("payment_custody", [
  "company",
  "sales",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "valid",
  "rejected",
]);
export const customWorkStatusEnum = pgEnum("custom_work_status", [
  "pending",
  "approved",
  "rejected",
]);
export const cancellationStatusEnum = pgEnum("cancellation_status", [
  "pending",
  "awaiting_credit_note",
  "awaiting_transfer",
  "completed",
]);
export const workOrderStatusEnum = pgEnum("work_order_status", [
  "unassigned",
  "assigned",
  "in_progress",
  "completed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  active: boolean("active").default(true).notNull(),
  code: text("code"),
  surname: text("surname"),
  salutation: text("salutation"),
  phone: text("phone"),
  companyPhone: text("company_phone"),
  address: text("address"),
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  bio: text("bio"),
  team: text("team"),
  avatarFileId: uuid("avatar_file_id"),
  ...timestamps,
});

export const userGrants = pgTable(
  "user_grants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.capability] })],
);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  whatsapp: text("whatsapp"),
  address: text("address"),
  district: text("district"),
  idNumberCiphertext: text("id_number_ciphertext"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps,
});

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  priceCents: integer("price_cents").notNull(),
  measure: text("measure").notNull(),
  costMode: text("cost_mode").default("ratio").notNull(),
  published: boolean("published").default(false).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps,
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  status: invoiceStatusEnum("status").default("issued").notNull(),
  currentVersion: integer("current_version").default(1).notNull(),
  categories: jsonb("categories").$type<string[]>().notNull(),
  salesName: text("sales_name"),
  supervisorName: text("supervisor_name"),
  idempotencyKey: text("idempotency_key").unique(),
  grantApplicationNumber: text("grant_application_number"),
  grantApprovedAmountCents: integer("grant_approved_amount_cents"),
  totalCents: integer("total_cents").notNull(),
  validPaidCents: integer("valid_paid_cents").default(0).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const invoiceVersions = pgTable(
  "invoice_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    reason: text("reason"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("invoice_versions_invoice_version").on(
      table.invoiceId,
      table.versionNo,
    ),
  ],
);

export const invoicePaymentPlan = pgTable(
  "invoice_payment_plan",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    installment: integer("installment").notNull(),
    label: text("label").notNull(),
    percentage: integer("percentage").notNull(),
    amountCents: integer("amount_cents").notNull(),
    cumulativeCents: integer("cumulative_cents").notNull(),
  },
  (table) => [uniqueIndex("invoice_payment_plan_invoice_installment").on(table.invoiceId, table.installment)],
);

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  versionId: uuid("version_id")
    .notNull()
    .references(() => invoiceVersions.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => services.id),
  name: text("name").notNull(),
  position: text("position"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  costSnapshot: jsonb("cost_snapshot").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  versionId: uuid("version_id")
    .notNull()
    .references(() => invoiceVersions.id),
  installment: integer("installment").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  custody: paymentCustodyEnum("custody").default("company").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  paidAt: date("paid_at").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  proofFileId: uuid("proof_file_id").references(() => files.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  validatedBy: uuid("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  paymentId: uuid("payment_id")
    .notNull()
    .unique()
    .references(() => payments.id),
  amountCents: integer("amount_cents").notNull(),
  issuedBy: uuid("issued_by")
    .notNull()
    .references(() => users.id),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workOrders = pgTable("work_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .unique()
    .references(() => invoices.id),
  versionId: uuid("version_id")
    .notNull()
    .references(() => invoiceVersions.id),
  status: workOrderStatusEnum("status").default("unassigned").notNull(),
  csOwnerId: uuid("cs_owner_id").references(() => users.id),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const workOrderAssignments = pgTable("work_order_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  contractorId: uuid("contractor_id").references(() => contractors.id),
  workerName: text("worker_name").notNull(),
  trade: text("trade"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  feeCents: integer("fee_cents").default(0).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workOrderDeductions = pgTable("work_order_deductions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").default(0).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workOrderExtraWorks = pgTable("work_order_extra_works", {
  id: uuid("id").defaultRandom().primaryKey(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  time: text("time"),
  notes: text("notes"),
  priceCents: integer("price_cents").default(0).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const municipalOrders = pgTable("municipal_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .unique()
    .references(() => invoices.id),
  workOrderId: uuid("work_order_id")
    .notNull()
    .unique()
    .references(() => workOrders.id),
  status: text("status").default("active").notNull(),
  ...timestamps,
});

export const municipalOrderLines = pgTable("municipal_order_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  municipalOrderId: uuid("municipal_order_id")
    .notNull()
    .references(() => municipalOrders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  position: text("position"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
});

export const cancellationCases = pgTable("cancellation_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  reason: text("reason").notNull(),
  status: cancellationStatusEnum("status").default("pending").notNull(),
  refundAmountCents: integer("refund_amount_cents").default(0).notNull(),
  deductionsCents: integer("deductions_cents").default(0).notNull(),
  refundReason: text("refund_reason"),
  bankName: text("bank_name"),
  bankAccountName: text("bank_account_name"),
  bankAccountNumber: text("bank_account_number"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  type: text("type").default("contractor").notNull(),
  kind: text("kind"),
  specialty: text("specialty"),
  mainWork: text("main_work"),
  scope: text("scope"),
  details: text("details"),
  trades: jsonb("trades").$type<string[]>().default([]).notNull(),
  feeMode: text("fee_mode"),
  feeAmount: integer("fee_amount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  contact: text("contact"),
  contact2: text("contact2"),
  phone2: text("phone2"),
  address: text("address"),
  categories: jsonb("categories").$type<string[]>().default([]).notNull(),
  hasProductStyles: boolean("has_product_styles").default(true).notNull(),
  logoFileId: uuid("logo_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  active: boolean("active").default(true).notNull(),
});

export const customWorkRequests = pgTable("custom_work_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  status: customWorkStatusEnum("status").default("pending").notNull(),
  priceCents: integer("price_cents"),
  notes: text("notes"),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  respondedBy: uuid("responded_by").references(() => users.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
});

export const productStyleSeries = pgTable("product_style_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const productStyleImages = pgTable("product_style_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  seriesId: uuid("series_id")
    .notNull()
    .references(() => productStyleSeries.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  requestId: text("request_id"),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const numberSequences = pgTable(
  "number_sequences",
  {
    key: text("key").notNull(),
    period: text("period").notNull(),
    nextValue: integer("next_value").default(1).notNull(),
  },
  (table) => [primaryKey({ columns: [table.key, table.period] })],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

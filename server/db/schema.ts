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
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "valid",
  "rejected",
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

export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  active: boolean("active").default(true).notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  contact: text("contact"),
  active: boolean("active").default(true).notNull(),
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

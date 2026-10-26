export type Role =
  | "sales"
  | "supervisor"
  | "head"
  | "finance"
  | "clerk"
  | "cs"
  | "cs_supervisor"
  | "admin";
export type Team = "A" | "B";
export interface Actor {
  id: string;
  name: string;
  code: string;
  role: Role;
  team?: Team;
  grants: string[];
}
export interface Attachment {
  id: string;
  name: string;
  mime?: string;
  size?: number;
  createdAt?: string;
}
export interface Customer {
  id?: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  idName: string;
  idNumber: string;
  source: string;
  isElderly: "" | "yes" | "no";
  notes: string;
  emergencyName: string;
  emergencyPhone: string;
  district: string;
  street: string;
  estate: string;
  block: string;
  floor: string;
  unit: string;
  address: string;
  ownerName: string;
  managementPhone: string;
  parking: string;
  precautions: string;
  attachment?: Attachment;
}
export interface CustomerProfile {
  id: string;
  ownerId: string;
  team: Team;
  customer: Customer;
  createdAt: string;
  updatedAt: string;
}
export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  measure: "area" | "length" | "quantity" | "fixed";
  minQty: number;
  minAmount: number;
  increment: number;
  minScope: "line" | "service";
  execution: "contractor" | "self" | "service";
  costMode: "ratio" | "fixed" | "self";
  fixedCost?: number;
  materialCost?: number;
  labourCost?: number;
  costBasis?: "unit" | "line";
  options: string[];
  allowPending: boolean;
  notes: string;
  published: boolean;
}
export interface QuoteLine {
  id: string;
  itemId: string;
  itemSnapshot: ServiceItem;
  position: string;
  length: number;
  width: number;
  dimensionUnit: "呎" | "寸";
  quantity: number;
  style: string;
  notes: string;
  attachment?: Attachment;
}
export interface Signature {
  date: string;
  supervisorId: string;
  actorId: string;
  createdAt: string;
}
export type DiscountMode = "none" | "rate" | "amount";
export interface QuotePrintPreparation {
  date: string;
  supervisorId: string;
  actorId: string;
  quoteNumber: string;
  createdAt: string;
  legacy?: boolean;
}
export interface QuoteVersion {
  id: string;
  index: number;
  customer: Customer;
  lines: QuoteLine[];
  discount: number;
  discountMode?: DiscountMode;
  discountValue?: number;
  createdAt: string;
  reason?: string;
  signedDocument?: Attachment;
  signature?: Signature;
  printPreparation?: QuotePrintPreparation;
  signedDocumentQuoteNumber?: string;
  calculation?: FrozenCalculation;
}
export interface Submission {
  id: string;
  versionId: string;
  actorId: string;
  createdAt: string;
}
export type ArchiveReason =
  | "customer_rejected"
  | "no_follow_up"
  | "duplicate"
  | "other";
export interface QuoteArchive {
  reason: ArchiveReason;
  note: string;
  actorId: string;
  archivedAt: string;
}
export interface Quote {
  id: string;
  number: string;
  ownerId: string;
  team: Team;
  versions: QuoteVersion[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archive?: QuoteArchive;
  submission?: Submission;
  /** 開單員在正式開Invoice前確認；Invoice建立後以Invoice快照為準。 */
  officeCategory?: InvoiceCategory;
  invoiceId?: string;
}
export interface Payment {
  id: string;
  quoteId: string;
  versionId: string;
  /** 開Invoice後的期款必須指向唯一Invoice；Sales交Office前付款可暫未綁定。 */
  invoiceId?: string;
  amount: number;
  method: "cash" | "fps" | "transfer" | "cheque";
  date: string;
  custody: "sales" | "company";
  reference: string;
  notes: string;
  proof?: Attachment;
  status: "pending" | "valid" | "rejected";
  validatedBy?: string;
  validDate?: string;
  cleared?: boolean;
  /** 第一期可由Sales於Invoice前登記；後續期款由開單員按此期數登記。 */
  installment?: number;
  createdAt: string;
  actorId: string;
}
export type InvoiceCategory = "group-buy" | "grant-80k" | "self-pay";
export const INVOICE_CATEGORY_NAMES: Record<InvoiceCategory, string> = {
  "group-buy": "團購",
  "grant-80k": "8萬資助",
  "self-pay": "自費",
};
export interface InvoiceInstallment {
  installment: number;
  label: string;
  percentage: number;
  amount: number;
  cumulativeAmount: number;
}
export interface Invoice {
  id: string;
  number: string;
  quoteId: string;
  versionId: string;
  customer: Customer;
  lines: QuoteLine[];
  discount: number;
  discountMode?: DiscountMode;
  discountValue?: number;
  netTotal: number;
  createdAt: string;
  actorId: string;
  supervisorId: string;
  category?: InvoiceCategory;
  /** 分類當刻的期數與金額快照，不會因日後付款政策改寫。 */
  paymentPlan?: InvoiceInstallment[];
  calculation?: FrozenCalculation;
}
export interface Receipt {
  id: string;
  number: string;
  invoiceId: string;
  quoteId: string;
  installment: number;
  paymentId?: string;
  installmentLabel?: string;
  percentage?: number;
  amount: number;
  paymentIds: string[];
  issuedAt: string;
  actorId: string;
}
export interface Resource {
  id: string;
  name: string;
  phone: string;
  type: "contractor" | "staff" | "service";
  trades: string[];
  active: boolean;
}
export interface Assignment {
  id: string;
  workOrderId: string;
  resourceId: string;
  lineIds: string[];
  date: string;
  time: string;
  notes: string;
  actorId: string;
  createdAt: string;
}
export interface WorkOrder {
  id: string;
  number: string;
  quoteId: string;
  invoiceId: string;
  groupId: string;
  versionId: string;
  customer: Customer;
  lines: QuoteLine[];
  createdAt: string;
  startDate: string;
  endDate: string;
  status: "pending" | "arranged";
  /** 累計有效收款達成交額50%後才發給CS；未達標只供開單員查閱。 */
  csReleasedAt?: string;
  /** CS主管指派的跟進同事；與判頭／師傅Assignment分開。 */
  csOwnerId?: string;
  dateChanges: {
    start: string;
    end: string;
    reason: string;
    actorId: string;
    at: string;
  }[];
}
export interface AuditEvent {
  id: string;
  quoteId?: string;
  workOrderId?: string;
  actorId: string;
  action: string;
  detail: string;
  at: string;
}
export interface Notification {
  id: string;
  actorId: string;
  quoteId: string;
  message: string;
  read: boolean;
  createdAt: string;
}
export interface AppState {
  schema: 1;
  actors: Actor[];
  customers: CustomerProfile[];
  services: ServiceItem[];
  quotes: Quote[];
  payments: Payment[];
  invoices: Invoice[];
  receipts: Receipt[];
  orders: WorkOrder[];
  assignments: Assignment[];
  resources: Resource[];
  audits: AuditEvent[];
  notifications: Notification[];
  monthlySequences: Record<string, number>;
  quoteSequences: Record<string, number>;
  receiptSequences: Record<string, number>;
  workOrderSequences: Record<string, number>;
}
export interface LineAmount {
  id: string;
  rawQty: number;
  billedQty: number;
  preDiscount: number;
  amount: number;
  minApplied: boolean;
}
export interface Pricing {
  subtotal: number;
  total: number;
  firstDue: number;
  lineAmounts: LineAmount[];
  cost?: number;
  coverage?: number;
  commission?: number;
  blocked: boolean;
  costIncomplete: boolean;
}
export interface FrozenCalculation extends Pricing {
  engineVersion: string;
}
export type Stage =
  | "draft"
  | "awaiting_signature"
  | "awaiting_payment"
  | "ready_submit"
  | "pending_finance"
  | "needs_balance"
  | "ready_invoice"
  | "issued"
  | "archived";
export interface Eligibility {
  stage: Stage;
  label: string;
  nextAction: string;
  canSubmit: boolean;
  canIssue: boolean;
  officeCategory?: InvoiceCategory;
  missing: string[];
  firstDue: number;
  validPaid: number;
  pendingPaid: number;
  balance: number;
  hasSignature: boolean;
  hasDocument: boolean;
  hasSubmission: boolean;
  hasInvoice: boolean;
}
export interface HandoffRow {
  quoteId: string;
  number: string;
  quoteNumber: string;
  workOrderNumber: string;
  invoiceNumber: string;
  customerName: string;
  phone: string;
  category?: InvoiceCategory;
  csOwnerId?: string;
  csOwnerName?: string;
  district: string;
  address: string;
  salesName: string;
  stage: Stage;
  label: string;
  nextAction: string;
  firstDue: number;
  validPaid: number;
  pendingPaid: number;
  balance: number;
  invoiceId?: string;
  workOrderId?: string;
  items: { name: string; position: string; quantity: number; style: string }[];
}
export interface InstallmentPlanRow {
  installment: number;
  label: string;
  percentage: number;
  amount: number;
  cumulativeAmount: number;
  received: number;
  pending: number;
  status:
    | "locked"
    | "awaiting_payment"
    | "under_review"
    | "ready_receipt"
    | "receipted";
  receiptIds: string[];
  paymentIds: string[];
}
export interface InvoicePaymentStatus {
  invoiceId: string;
  quoteId: string;
  category: InvoiceCategory;
  total: number;
  validPaid: number;
  pendingPaid: number;
  percentPaid: number;
  openingDue: number;
  csReleaseDue: number;
  releasedToCS: boolean;
  completed: boolean;
  installments: InstallmentPlanRow[];
}
export interface PerformanceEntry {
  quoteId: string;
  number: string;
  customerName: string;
  total: number;
  rate: number;
  commission: number;
  date: string;
}
export interface Performance {
  sales: number;
  commission: number;
  bonus: number;
  nextTarget?: number;
  nextBonus?: number;
  entries: PerformanceEntry[];
}
export interface DraftInput {
  customer: Customer;
  lines: QuoteLine[];
  discount: number;
  discountMode?: DiscountMode;
  discountValue?: number;
  reason?: string;
}
export interface PaymentInput {
  amount: number;
  method: Payment["method"];
  date: string;
  custody: Payment["custody"];
  reference?: string;
  notes?: string;
  proof?: Attachment;
}
export interface InstallmentPaymentInput extends PaymentInput {
  /** 非現金款項必須明確核實；支票則代表已兌現。 */
  cleared: boolean;
}
export interface AssignmentInput {
  resourceId: string;
  lineIds: string[];
  date: string;
  time: string;
  notes: string;
}
export const EMPTY_CUSTOMER: Customer = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  idName: "",
  idNumber: "",
  source: "",
  isElderly: "",
  notes: "",
  emergencyName: "",
  emergencyPhone: "",
  district: "",
  street: "",
  estate: "",
  block: "",
  floor: "",
  unit: "",
  address: "",
  ownerName: "",
  managementPhone: "",
  parking: "",
  precautions: "",
};
export const ROLE_NAMES: Record<Role, string> = {
  sales: "Sales",
  supervisor: "Sales主管",
  head: "Sales阿頭",
  finance: "會計",
  clerk: "開單員",
  cs: "工程CS",
  cs_supervisor: "CS主管",
  admin: "Super Admin",
};
export const METHOD_NAMES: Record<Payment["method"], string> = {
  cash: "現金",
  fps: "轉數快 FPS",
  transfer: "銀行轉帳",
  cheque: "支票",
};
export const DEMO_TODAY = "2026-10-22";
export const currentVersion = (q: Quote): QuoteVersion =>
  q.versions[q.versions.length - 1];
export function discountLabel(
  discount: number,
  mode: DiscountMode = discount === 1 ? "none" : "rate",
  value?: number,
): string {
  if (mode === "none" || discount === 1) return "原價";
  if (mode === "amount") return `扣減 ${money(value ?? 0)}`;
  return `${Number((value ?? discount * 100).toFixed(2))}折`;
}
export const money = (amount: number) =>
  new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);

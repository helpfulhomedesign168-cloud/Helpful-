import Decimal from "decimal.js";
import {
  type Actor,
  type AppState,
  type Assignment,
  type AssignmentInput,
  type Attachment,
  type ArchiveReason,
  type AuditEvent,
  type Customer,
  type CustomerProfile,
  type DraftInput,
  type Eligibility,
  type ExtraWork,
  type ExtraWorkInput,
  type ExtraWorkKind,
  type HandoffRow,
  type Invoice,
  type Notification,
  type Payment,
  type PaymentInput,
  type Performance,
  type PerformanceEntry,
  type Pricing,
  type InvoiceCategory,
  type Receipt,
  type Quote,
  type QuoteLine,
  type QuoteVersion,
  type Resource,
  type ResourceKind,
  type Supplier,
  type ProductStyleSeries,
  type ProductStyleImage,
  type ProductStyleSupplier,
  type MunicipalOrder,
  type MunicipalOrderLine,
  type ResourceFeeMode,
  type ServiceItem,
  type WorkOrder,
  type LineAmount,
  type FrozenCalculation,
  type InstallmentPaymentInput,
  type InstallmentPlanRow,
  type InvoicePaymentStatus,
  INVOICE_CATEGORY_NAMES,
  DEFAULT_SERVICE_CATEGORIES,
  composeCustomerAddress,
  DEMO_TODAY,
  EMPTY_CUSTOMER,
  EXTRA_WORK_LABELS,
  SUPPLIER_CATEGORIES,
  currentVersion,
  money,
} from "./types";

/** Browser-local Demo state. This is deliberately not a backend authorisation boundary. */
const STORAGE_KEY = "homeflow-state-v1";
const NOW = `${DEMO_TODAY}T12:00:00+08:00`;

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cents = (value: Decimal.Value): number =>
  new Decimal(value)
    .mul(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
const fromCents = (value: number): number => Number((value / 100).toFixed(2));
const D = (value: Decimal.Value): Decimal => new Decimal(value);
const moneyValue = (value: Decimal.Value): number => fromCents(cents(value));
const dateKey = (date = DEMO_TODAY): string => date.slice(0, 7);
const yyMM = (date = DEMO_TODAY): string =>
  `${date.slice(2, 4)}${date.slice(5, 7)}`;
function sequenceFromNumber(
  number: string,
): { month: string; sequence: number } | undefined {
  const match = number.match(/(\d{2})(\d{2})(\d{4})$/);
  if (!match) return undefined;
  const monthNumber = Number(match[2]);
  const sequence = Number(match[3]);
  if (monthNumber < 1 || monthNumber > 12 || sequence < 1) return undefined;
  return { month: `20${match[1]}-${match[2]}`, sequence };
}
function retainHighestSequence(
  target: Record<string, number>,
  number: string | undefined,
): void {
  if (!number) return;
  const parsed = sequenceFromNumber(number);
  if (parsed)
    target[parsed.month] = Math.max(target[parsed.month] ?? 0, parsed.sequence);
}
const uid = (prefix: string): string =>
  `${prefix}-${DEMO_TODAY.replaceAll("-", "")}-${Math.random().toString(36).slice(2, 10)}`;

function fail(message: string): never {
  throw new Error(message);
}
function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function validPastDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value <= DEMO_TODAY &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
function frozen(raw: Pricing): FrozenCalculation {
  return {
    engineVersion: "prototype-v1",
    subtotal: raw.subtotal,
    total: raw.total,
    firstDue: raw.firstDue,
    lineAmounts: deepCopy(raw.lineAmounts),
    cost: raw.cost,
    coverage: raw.coverage,
    commission: raw.commission,
    blocked: raw.blocked,
    costIncomplete: raw.costIncomplete,
  };
}
function safeCalculation(
  calc: FrozenCalculation | undefined,
): FrozenCalculation | undefined {
  if (!calc) return undefined;
  const safe = deepCopy(calc);
  delete safe.cost;
  delete safe.coverage;
  delete safe.commission;
  return safe;
}
function factor(discount: number): Decimal {
  const d = D(discount);
  const value = d.gt(1) ? d.div(100) : d;
  if (value.lt(0) || value.gt(1)) fail("折扣必須介乎 0 至 100%。");
  return value;
}
function composeAddress(customer: Customer): string {
  return composeCustomerAddress(customer);
}
function normaliseCustomer(customer: Customer): Customer {
  const copy = deepCopy(customer);
  copy.street ??= "";
  copy.address = composeAddress(copy);
  return copy;
}
function hydrateCustomerProfiles(state: AppState): void {
  state.customers ??= [];
  const byPhone = new Map<string, CustomerProfile>();
  state.customers.forEach((profile) => {
    profile.id ||= uid("customer");
    profile.customer = normaliseCustomer(profile.customer);
    profile.customer.id = profile.id;
    const key = normalizePhone(profile.customer.phone);
    if (key && !byPhone.has(key)) byPhone.set(key, profile);
  });
  state.quotes.forEach((quote) => {
    quote.versions.forEach((version) => {
      version.customer = normaliseCustomer(version.customer);
      const key = normalizePhone(version.customer.phone);
      if (!key) return;
      const existing = byPhone.get(key);
      if (existing) {
        version.customer.id = existing.id;
        return;
      }
      const profile: CustomerProfile = {
        id: version.customer.id || uid("customer"),
        ownerId: quote.ownerId,
        team: quote.team,
        customer: deepCopy(version.customer),
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
      };
      profile.customer.id = profile.id;
      version.customer.id = profile.id;
      state.customers.push(profile);
      byPhone.set(key, profile);
    });
  });
  [...state.invoices, ...state.orders].forEach((record) => {
    record.customer = normaliseCustomer(record.customer);
    const profile = byPhone.get(normalizePhone(record.customer.phone));
    if (profile) record.customer.id = profile.id;
  });
}
function resolveDraftDiscount(
  input: DraftInput,
  subtotal: number,
): { discount: number; mode: "none" | "rate" | "amount"; value: number } {
  const mode =
    input.discountMode ?? (factor(input.discount).eq(1) ? "none" : "rate");
  if (mode === "none") return { discount: 1, mode, value: 0 };
  if (mode === "rate") {
    const value = Number(
      input.discountValue ?? factor(input.discount).mul(100),
    );
    return { discount: Number(factor(value)), mode, value };
  }
  const value = D(input.discountValue ?? 0);
  if (!value.isFinite() || value.lt(0)) fail("自訂扣減金額不可為負數。");
  if (value.gt(subtotal)) fail("自訂扣減金額不可大於工程小計。");
  const discount = subtotal === 0 ? 1 : Number(D(1).minus(value.div(subtotal)));
  return { discount: Number(factor(discount)), mode, value: moneyValue(value) };
}
function normalizePhone(phone: string): string {
  let value = phone.trim().replace(/[\s()\-]/g, "");
  if (value.startsWith("+852")) value = value.slice(4);
  if (value.startsWith("852") && value.length > 8) value = value.slice(3);
  return value;
}
function maskedId(value: string): string {
  if (!value) return "";
  if (value.length <= 3) return "***";
  return `${value.slice(0, 1)}***${value.slice(-2)}`;
}
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = month - 1 + months;
  const y = year + Math.floor(target / 12);
  const m = ((target % 12) + 12) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function removeCost<T extends ServiceItem>(item: T): T {
  const safe = deepCopy(item) as Partial<ServiceItem>;
  // All cost-bearing fields are omitted from Sales/CS projections. The cast preserves
  // the public ServiceItem list contract while deliberately not serialising these keys.
  delete safe.costMode;
  delete safe.fixedCost;
  delete safe.materialCost;
  delete safe.labourCost;
  delete safe.costBasis;
  return safe as T;
}
function sanitiseCustomer(customer: Customer): Customer {
  const copy = deepCopy(customer);
  copy.idNumber = maskedId(copy.idNumber);
  return copy;
}
function sanitiseLine(line: QuoteLine): QuoteLine {
  const copy = deepCopy(line);
  copy.itemSnapshot = removeCost(copy.itemSnapshot);
  return copy;
}
function sanitiseQuote(quote: Quote, admin: boolean): Quote {
  if (admin) return deepCopy(quote);
  const copy = deepCopy(quote);
  copy.versions = copy.versions.map((version) => ({
    ...version,
    customer: sanitiseCustomer(version.customer),
    lines: version.lines.map(sanitiseLine),
    calculation: safeCalculation(version.calculation),
  }));
  return copy;
}
function sanitiseInvoice(invoice: Invoice, admin: boolean): Invoice {
  if (admin) return deepCopy(invoice);
  const copy = deepCopy(invoice);
  copy.customer = sanitiseCustomer(copy.customer);
  copy.lines = copy.lines.map(sanitiseLine);
  copy.calculation = safeCalculation(copy.calculation);
  return copy;
}
function sanitiseOrder(order: WorkOrder, admin: boolean): WorkOrder {
  if (admin) return deepCopy(order);
  const copy = deepCopy(order);
  copy.customer = sanitiseCustomer(copy.customer);
  copy.lines = copy.lines.map(sanitiseLine);
  return copy;
}
function quoteVersionIsSigned(version: QuoteVersion): boolean {
  return Boolean(version.signedDocument && version.signature);
}

interface RawPricing extends Pricing {
  subtotalCents: number;
  totalCents: number;
  internalCost: number;
  internalCommission: number;
}

/** Largest-remainder allocation in integer cents, stable in input order. */
function allocateCents(total: number, weights: Decimal[]): number[] {
  if (weights.length === 0) return [];
  const positive = weights.map((weight) => Decimal.max(weight, 0));
  const sum = positive.reduce((acc, value) => acc.plus(value), D(0));
  if (sum.isZero()) {
    const each = Math.floor(total / weights.length);
    return weights.map(
      (_, index) => each + (index < total - each * weights.length ? 1 : 0),
    );
  }
  const rows = positive.map((weight, index) => {
    const exact = D(total).mul(weight).div(sum);
    const floor = exact.floor().toNumber();
    return { index, floor, rem: exact.minus(floor) };
  });
  let remain = total - rows.reduce((acc, row) => acc + row.floor, 0);
  rows.sort((a, b) => b.rem.comparedTo(a.rem) || a.index - b.index);
  let cursor = 0;
  while (remain > 0) {
    rows[cursor % rows.length].floor += 1;
    cursor++;
    remain--;
  }
  const allocated = Array(weights.length).fill(0) as number[];
  rows.forEach((row) => {
    allocated[row.index] = row.floor;
  });
  // Defensive cent conservation for any Decimal edge case.
  let delta = total - allocated.reduce((a, b) => a + b, 0);
  cursor = 0;
  while (delta > 0) {
    allocated[rows[cursor % rows.length].index]++;
    cursor++;
    delta--;
  }
  return allocated;
}

function rawQuantity(line: QuoteLine, service: ServiceItem): Decimal {
  const unit = line.dimensionUnit === "寸" ? D(12) : D(1);
  const length = D(line.length || 0).div(unit);
  const width = D(line.width || 0).div(unit);
  if (service.measure === "fixed") return D(1);
  if (service.measure === "quantity") return D(line.quantity || 0);
  if (service.measure === "length")
    return length.gt(0) ? length : D(line.quantity || 0);
  const area = length.mul(width);
  return area.gt(0) ? area : D(line.quantity || 0);
}
function roundedQuantity(quantity: Decimal, increment: number): Decimal {
  if (quantity.lt(0)) fail("工程數量不可為負數。");
  if (!increment) return quantity;
  return quantity.div(increment).ceil().mul(increment);
}

function calculatePricing(
  lines: QuoteLine[],
  discount: number,
  services: ServiceItem[],
  useSnapshot = false,
): RawPricing {
  const active = new Map(services.map((item) => [item.id, item]));
  const f = factor(discount);
  const rows = lines.map((line, index) => {
    const service = useSnapshot
      ? line.itemSnapshot
      : (active.get(line.itemId) ?? line.itemSnapshot);
    if (!service) fail("找不到工程項目，請重新選擇目錄服務。");
    const qty = rawQuantity(line, service);
    const rounded = roundedQuantity(qty, service.increment);
    return {
      index,
      line,
      service,
      raw: qty,
      rounded,
      billed: rounded,
      preCents: 0,
      minApplied: false,
    };
  });

  for (const row of rows.filter((item) => item.service.minScope === "line")) {
    const afterMinQty = Decimal.max(row.rounded, row.service.minQty || 0);
    row.minApplied = afterMinQty.gt(row.rounded);
    row.billed = afterMinQty;
    const price = afterMinQty.mul(row.service.price);
    const withMinAmount = Decimal.max(price, row.service.minAmount || 0);
    row.minApplied ||= withMinAmount.gt(price);
    row.preCents = cents(withMinAmount);
  }

  const groups = new Map<string, typeof rows>();
  rows
    .filter((item) => item.service.minScope === "service")
    .forEach((row) => {
      const group = groups.get(row.service.id) ?? [];
      group.push(row);
      groups.set(row.service.id, group);
    });
  for (const group of groups.values()) {
    const service = group[0].service;
    const initial = group.map((row) => row.rounded);
    const totalInitial = initial.reduce((acc, value) => acc.plus(value), D(0));
    const totalBilled = Decimal.max(totalInitial, service.minQty || 0);
    const billedAllocated = totalInitial.eq(totalBilled)
      ? initial
      : group.map((row, index) =>
          totalInitial.isZero()
            ? totalBilled.div(group.length)
            : totalBilled.mul(initial[index]).div(totalInitial),
        );
    group.forEach((row, index) => {
      row.billed = billedAllocated[index];
      row.minApplied = !row.billed.eq(row.rounded);
    });
    const beforeMinimum = group.map((row) => row.billed.mul(service.price));
    const groupBefore = beforeMinimum.reduce(
      (acc, value) => acc.plus(value),
      D(0),
    );
    const groupAmount = Decimal.max(groupBefore, service.minAmount || 0);
    const allocated = allocateCents(cents(groupAmount), beforeMinimum);
    group.forEach((row, index) => {
      row.preCents = allocated[index];
      row.minApplied ||= groupAmount.gt(groupBefore);
    });
  }

  const subtotalCents = rows.reduce((sum, row) => sum + row.preCents, 0);
  const totalCents = cents(D(subtotalCents).div(100).mul(f));
  const lineCents = allocateCents(
    totalCents,
    rows.map((row) => D(row.preCents)),
  );
  let costIncomplete = false;
  let internalCost = D(0);
  rows.forEach((row, index) => {
    const service = row.service;
    const sale = D(lineCents[index]).div(100);
    if (service.costMode === "ratio")
      internalCost = internalCost.plus(sale.mul(0.6));
    else if (service.costMode === "fixed") {
      if (!isFiniteNonNegative(service.fixedCost)) costIncomplete = true;
      else internalCost = internalCost.plus(service.fixedCost);
    } else if (service.costMode === "self") {
      if (
        !isFiniteNonNegative(service.materialCost) ||
        !isFiniteNonNegative(service.labourCost) ||
        !service.costBasis
      )
        costIncomplete = true;
      else {
        const fixed = D(service.materialCost).plus(service.labourCost);
        internalCost = internalCost.plus(
          service.costBasis === "unit" ? fixed.mul(row.billed) : fixed,
        );
      }
    } else costIncomplete = true;
  });
  const internalCommission = D(totalCents)
    .div(100)
    .mul(f.lt(0.95) ? 0.09 : 0.12);
  const coverage = D(totalCents)
    .div(100)
    .minus(internalCost)
    .minus(internalCommission);
  const lineAmounts: LineAmount[] = rows.map((row, index) => ({
    id: row.line.id,
    rawQty: Number(row.raw.toFixed(4)),
    billedQty: Number(row.billed.toFixed(4)),
    preDiscount: fromCents(row.preCents),
    amount: fromCents(lineCents[index]),
    minApplied: row.minApplied,
  }));
  return {
    subtotal: fromCents(subtotalCents),
    total: fromCents(totalCents),
    // 收款門檻不由成交額判斷；待開單員選分類後才凍結在Invoice.paymentPlan。
    firstDue: 0,
    lineAmounts,
    cost: moneyValue(internalCost),
    coverage: moneyValue(coverage),
    commission: moneyValue(internalCommission),
    blocked: costIncomplete || coverage.lt(0),
    costIncomplete,
    subtotalCents,
    totalCents,
    internalCost: moneyValue(internalCost),
    internalCommission: moneyValue(internalCommission),
  };
}

function publicPricing(raw: RawPricing, actor: Actor): Pricing {
  const result: Pricing = {
    subtotal: raw.subtotal,
    total: raw.total,
    firstDue: raw.firstDue,
    lineAmounts: deepCopy(raw.lineAmounts),
    blocked: raw.blocked,
    costIncomplete: raw.costIncomplete,
  };
  if (actor.role === "admin") {
    result.cost = raw.cost;
    result.coverage = raw.coverage;
    result.commission = raw.commission;
  }
  return result;
}

function validCustomer(customer: Customer): string[] {
  // Legacy identity/ownership fields remain in the Customer snapshot for old
  // records, but are no longer required or shown in the Sales form.
  const required: Array<[keyof Customer, string]> = [
    ["name", "客戶姓名"],
    ["phone", "主要電話"],
    ["whatsapp", "WhatsApp電話"],
    ["district", "地區"],
    ["estate", "屋苑"],
    ["floor", "樓層"],
    ["unit", "單位"],
  ];
  const missing = required
    .filter(([key]) => !String(customer[key] ?? "").trim())
    .map(([, label]) => label);
  return missing;
}
function validEngineering(
  version: QuoteVersion,
  services: ServiceItem[],
): string[] {
  if (!version.lines.length) return ["至少一項工程"];
  const all = new Map(services.map((service) => [service.id, service]));
  const problems: string[] = [];
  version.lines.forEach((line, index) => {
    const item = version.signature
      ? line.itemSnapshot
      : (all.get(line.itemId) ?? line.itemSnapshot);
    if (!item || !item.published) {
      problems.push(`第 ${index + 1} 項工程目錄無效`);
      return;
    }
    if (item.measure === "area" && !(line.length > 0 && line.width > 0))
      problems.push(`第 ${index + 1} 項須填長及闊`);
    if (item.measure === "length" && !(line.length > 0))
      problems.push(`第 ${index + 1} 項須填長度`);
    if (item.measure === "quantity" && !(line.quantity > 0))
      problems.push(`第 ${index + 1} 項須填數量`);
    if (item.options.length && !item.allowPending && !line.style.trim())
      problems.push(`第 ${index + 1} 項須選款式`);
  });
  return problems;
}

const isCsActor = (actor: Actor): boolean =>
  actor.role === "cs" || actor.role === "cs_supervisor";

const DEMO_CS_ACTORS: Actor[] = [
  {
    id: "cs-lead-ahfa",
    name: "阿花",
    code: "AFA",
    role: "cs_supervisor",
    grants: ["handoff.read", "order.read", "assignment.write"],
  },
  {
    id: "cs-joe",
    name: "Joe",
    code: "JOE",
    role: "cs",
    grants: ["handoff.read", "order.read", "assignment.write"],
  },
  {
    id: "cs-nicole",
    name: "Nicole",
    code: "NIC",
    role: "cs",
    grants: ["handoff.read", "order.read", "assignment.write"],
  },
  {
    id: "cs-fandy",
    name: "Fandy",
    code: "FAN",
    role: "cs",
    grants: ["handoff.read", "order.read", "assignment.write"],
  },
];
function ensureDemoCsActors(state: AppState): void {
  DEMO_CS_ACTORS.forEach((actor) => {
    if (!state.actors.some((candidate) => candidate.id === actor.id))
      state.actors.push(deepCopy(actor));
  });
}
function nextWorkOrderNumber(state: AppState): string {
  const year = DEMO_TODAY.slice(2, 4);
  const sequence = (state.workOrderSequences?.[year] ?? 0) + 1;
  state.workOrderSequences ??= {};
  state.workOrderSequences[year] = sequence;
  return `D${year}${String(sequence).padStart(5, "0")}`;
}

function serviceComplete(item: ServiceItem): boolean {
  if (
    !item.id ||
    !item.code ||
    !item.name ||
    !item.category ||
    !item.unit ||
    !Number.isFinite(item.price) ||
    item.price < 0
  )
    return false;
  if (
    !["area", "length", "quantity", "fixed"].includes(item.measure) ||
    !["line", "service"].includes(item.minScope)
  )
    return false;
  if (
    !["contractor", "self", "service"].includes(item.execution) ||
    !["ratio", "fixed", "self"].includes(item.costMode)
  )
    return false;
  if (
    !isFiniteNonNegative(item.minQty) ||
    !isFiniteNonNegative(item.minAmount) ||
    !isFiniteNonNegative(item.increment)
  )
    return false;
  if (item.costMode === "fixed" && !isFiniteNonNegative(item.fixedCost))
    return false;
  if (
    item.costMode === "self" &&
    (!isFiniteNonNegative(item.materialCost) ||
      !isFiniteNonNegative(item.labourCost) ||
      !item.costBasis)
  )
    return false;
  return true;
}

export class Engine {
  private state: AppState;
  private readonly storage?: Storage;
  private listeners = new Set<() => void>();
  storageWarning = "";

  constructor(storage?: Storage, seed?: AppState) {
    this.storage =
      storage ??
      (typeof localStorage !== "undefined" ? localStorage : undefined);
    const persisted = this.readStorage();
    this.state = persisted ?? deepCopy(seed ?? createSeedState());
  }

  /** Stable reference until a committed action changes state: suitable for useSyncExternalStore. */
  getState = (): AppState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private readStorage(): AppState | undefined {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as AppState;
      if (
        parsed?.schema !== 1 ||
        ![
          "actors",
          "services",
          "quotes",
          "payments",
          "invoices",
          "orders",
          "assignments",
          "resources",
          "audits",
          "notifications",
        ].every((key) =>
          Array.isArray((parsed as unknown as Record<string, unknown>)[key]),
        )
      ) {
        this.storageWarning =
          "之前的Demo資料版本或格式不能讀取；原資料未被覆寫，請在原型工具明確重設。";
        return undefined;
      }
      const migrated = parsed as AppState;
      migrated.monthlySequences ??= {};
      migrated.quoteSequences ??= {};
      migrated.receipts ??= [];
      migrated.receiptSequences ??= {};
      migrated.workOrderSequences ??= {};
      migrated.customers ??= [];
      migrated.extraWorks ??= [];
      migrated.serviceCategories ??= [...DEFAULT_SERVICE_CATEGORIES];
      migrated.assignments.forEach((assignment) => {
        assignment.endDate ??= assignment.date;
      });
      if (
        !migrated.services.some((service) =>
          DEMO_CATALOG_SERVICE_IDS.includes(service.id),
        )
      ) {
        migrated.services.forEach((service) => {
          service.archived = true;
        });
        migrated.services.push(...createDemoCatalogServices());
      }
      createAdditionalCatalogServices().forEach((service) => {
        if (!migrated.services.some((item) => item.id === service.id))
          migrated.services.push(service);
      });
      hydrateDemoCatalogServices(migrated.services);
      if ((migrated.demoEngineeringVersion ?? 0) < 2) {
        refreshDemoEngineeringOrders(migrated);
        migrated.demoEngineeringVersion = 2;
      }
      migrated.suppliers ??= [];
      migrated.productStyles ??= [];
      migrated.municipalOrders ??= [];
      createDemoSuppliers().forEach((supplier) => {
        if (!migrated.suppliers.some((item) => item.id === supplier.id))
          migrated.suppliers.push(supplier);
      });
      createMasterResources().forEach((resource) => {
        const existing = migrated.resources.find(
          (item) => item.id === resource.id,
        );
        if (!existing) {
          migrated.resources.push(resource);
          return;
        }
        // Keep the demo fixed rates authoritative, including older local data
        // created before the rates were entered. Never touch user-created rows.
        if (
          resource.feeMode !== "project60" &&
          existing.feeMode === resource.feeMode
        )
          existing.feeAmount = resource.feeAmount;
      });
      ensureDemoCsActors(migrated);
      const migrateCustomer = (customer: Customer) => {
        customer.street ??= "";
        customer.address = composeAddress(customer);
      };
      migrated.quotes.forEach((quote) => {
        if (
          (quote as unknown as { officeCategory?: string }).officeCategory ===
          "team-a"
        )
          quote.officeCategory = "group-buy";
        if (
          (quote as unknown as { officeCategory?: string }).officeCategory ===
          "grant-b"
        )
          quote.officeCategory = "grant-80k";
        retainHighestSequence(migrated.quoteSequences, quote.number);
        quote.versions.forEach((version) => {
          migrateCustomer(version.customer);
          if (version.signature && !version.printPreparation) {
            const legacyNumber = `歷史-${quote.number}`;
            version.printPreparation = {
              date: version.signature.date,
              supervisorId: version.signature.supervisorId,
              actorId: version.signature.actorId,
              quoteNumber: legacyNumber,
              createdAt: version.signature.createdAt,
              legacy: true,
            };
            if (version.signedDocument)
              version.signedDocumentQuoteNumber = legacyNumber;
          }
          retainHighestSequence(
            migrated.quoteSequences,
            version.printPreparation?.quoteNumber,
          );
        });
      });
      migrated.invoices.forEach((invoice) => {
        if ((invoice as unknown as { category?: string }).category === "team-a")
          invoice.category = "group-buy";
        if (
          (invoice as unknown as { category?: string }).category === "grant-b"
        )
          invoice.category = "grant-80k";
        migrateCustomer(invoice.customer);
        retainHighestSequence(migrated.monthlySequences, invoice.number);
      });
      migrated.invoices.forEach((invoice) => {
        invoice.category ??= "self-pay";
        invoice.paymentPlan ??= this.installmentPlan(
          invoice.category,
          invoice.netTotal,
        );
        const quote = migrated.quotes.find(
          (item) => item.id === invoice.quoteId,
        );
        if (quote) quote.officeCategory ??= invoice.category;
        migrated.payments
          .filter(
            (payment) =>
              payment.quoteId === invoice.quoteId &&
              payment.versionId === invoice.versionId &&
              !payment.invoiceId,
          )
          .forEach((payment) => {
            payment.invoiceId = invoice.id;
            payment.installment ??= 1;
          });
      });
      migrated.receipts.forEach((receipt) => {
        if (!receipt.paymentId && receipt.paymentIds.length === 1)
          receipt.paymentId = receipt.paymentIds[0];
        retainHighestSequence(migrated.receiptSequences, receipt.number);
      });
      migrated.orders.forEach((order) => {
        migrateCustomer(order.customer);
        const match = order.number.match(/^D(\d{2})(\d{5})[AB]?$/);
        if (match) {
          const year = match[1];
          migrated.workOrderSequences[year] = Math.max(
            migrated.workOrderSequences[year] ?? 0,
            Number(match[2]),
          );
        }
        const invoice = migrated.invoices.find(
          (item) => item.id === order.invoiceId,
        );
        if (!invoice || order.csReleasedAt) return;
        const paid = migrated.payments
          .filter(
            (payment) =>
              payment.quoteId === invoice.quoteId &&
              payment.versionId === invoice.versionId &&
              payment.status === "valid",
          )
          .reduce((sum, payment) => sum + payment.amount, 0);
        if (paid >= invoice.netTotal * 0.5)
          order.csReleasedAt = invoice.createdAt;
      });
      if (!migrated.orders.some((order) => order.number === "D260099"))
        appendDemoEngineeringOrders(migrated);
      hydrateCustomerProfiles(migrated);
      return migrated;
    } catch {
      this.storageWarning =
        "之前的Demo資料不能讀取；原資料未被覆寫，請在原型工具明確重設。";
      return undefined;
    }
  }
  private commit(next: AppState, overwrite = false): void {
    if (this.storageWarning && !overwrite) fail(this.storageWarning);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      fail("瀏覽器儲存失敗，這次修改沒有保存。請檢查儲存空間及瀏覽器設定。");
    }
    this.state = next;
    this.storageWarning = "";
    this.listeners.forEach((listener) => listener());
  }
  private mutate(action: (draft: AppState) => void): void {
    const next = deepCopy(this.state);
    action(next);
    this.commit(next);
  }
  private actor(actor: Actor): Actor {
    const actual = this.state.actors.find(
      (candidate) => candidate.id === actor.id,
    );
    if (!actual) fail("帳戶不存在或已停用。");
    return actual;
  }
  private has(actor: Actor, grant: string): boolean {
    return actor.role === "admin" || actor.grants.includes(grant);
  }
  private findQuote(id: string, state = this.state): Quote {
    return (
      state.quotes.find((quote) => quote.id === id) ?? fail("找不到報價來源。")
    );
  }
  private isOwner(actor: Actor, quote: Quote): boolean {
    return actor.id === quote.ownerId;
  }
  private quoteReadable(actor: Actor, quote: Quote): boolean {
    if (actor.role === "admin") return true;
    if (actor.role === "sales") return this.isOwner(actor, quote);
    if (actor.role === "head") return true;
    if (actor.role === "supervisor") return quote.team === "B";
    if (actor.role === "finance" || actor.role === "clerk")
      return Boolean(
        quote.submission || quoteVersionIsSigned(currentVersion(quote)),
      );
    return false;
  }
  private customerReadable(actor: Actor, profile: CustomerProfile): boolean {
    if (actor.role === "admin" || actor.role === "head") return true;
    if (actor.role === "supervisor") return profile.team === "B";
    if (actor.role === "sales") return profile.ownerId === actor.id;
    if (actor.role === "clerk") return true;
    return false;
  }
  private canWriteQuote(actor: Actor, quote?: Quote): boolean {
    return (
      (actor.role === "sales" ||
        actor.role === "head" ||
        actor.role === "supervisor") &&
      (!quote || quote.ownerId === actor.id)
    );
  }
  private canFinance(actor: Actor): boolean {
    return (
      actor.role === "finance" ||
      actor.role === "clerk" ||
      actor.grants.includes("finance.validate")
    );
  }
  private canInvoice(actor: Actor): boolean {
    return actor.role === "clerk" || actor.grants.includes("invoice.write");
  }
  /** CS普通同事只可讀自己的工程；CS主管／Admin可讀全部已釋放工程。 */
  private orderReadable(actor: Actor, order: WorkOrder): boolean {
    if (actor.role === "admin") return true;
    if (isCsActor(actor)) {
      if (!order.csReleasedAt) return false;
      return actor.role === "cs_supervisor" || order.csOwnerId === actor.id;
    }
    return (
      actor.role === "clerk" ||
      this.has(actor, "order.read") ||
      this.findQuote(order.quoteId).ownerId === actor.id
    );
  }
  private csInvoiceReadable(actor: Actor, invoice: Invoice): boolean {
    if (actor.role === "admin") return true;
    const order = this.state.orders.find(
      (item) => item.invoiceId === invoice.id,
    );
    return Boolean(
      order?.csReleasedAt &&
        (actor.role === "cs_supervisor" || order.csOwnerId === actor.id),
    );
  }
  private syncCustomerProfile(
    state: AppState,
    actor: Actor,
    customer: Customer,
    ownerId: string,
    team: "A" | "B",
  ): Customer {
    const normalised = normaliseCustomer(customer);
    const key = normalizePhone(normalised.phone);
    const selected = normalised.id
      ? state.customers.find((profile) => profile.id === normalised.id)
      : undefined;
    if (normalised.id && !selected)
      fail("所選客戶主檔已不存在，請重新選擇客戶。");
    const phoneMatch = key
      ? state.customers.find(
          (profile) => normalizePhone(profile.customer.phone) === key,
        )
      : undefined;
    if (selected && phoneMatch && selected.id !== phoneMatch.id)
      fail("此電話已屬於另一位客戶主檔，請先由 Admin 核對。");
    const existing = selected ?? phoneMatch;
    if (existing) {
      if (existing.ownerId !== ownerId && actor.role !== "admin")
        fail("此電話已由其他 Sales 建立，請 Admin 核對客戶資料。");
      const filled = Object.fromEntries(
        Object.entries(normalised).filter(
          ([, value]) => value !== "" && value !== undefined,
        ),
      ) as Partial<Customer>;
      // A masked ID is a read projection, never a value that may overwrite the master record.
      if (filled.idNumber === maskedId(existing.customer.idNumber))
        delete filled.idNumber;
      const merged = normaliseCustomer({
        ...existing.customer,
        ...filled,
        id: existing.id,
      });
      existing.customer = deepCopy(merged);
      existing.updatedAt = NOW;
      return merged;
    }
    if (!key) return normalised;
    const profile: CustomerProfile = {
      id: uid("customer"),
      ownerId,
      team,
      customer: deepCopy(normalised),
      createdAt: NOW,
      updatedAt: NOW,
    };
    profile.customer.id = profile.id;
    state.customers.push(profile);
    return deepCopy(profile.customer);
  }
  private audit(state: AppState, event: Omit<AuditEvent, "id" | "at">): void {
    state.audits.push({ ...event, id: uid("audit"), at: NOW });
  }
  private notify(
    state: AppState,
    actorId: string,
    quoteId: string,
    message: string,
  ): void {
    state.notifications.push({
      id: uid("notice"),
      actorId,
      quoteId,
      message,
      read: false,
      createdAt: NOW,
    });
  }
  private pricingRaw(quote: Quote): RawPricing {
    const version = currentVersion(quote),
      raw = calculatePricing(
        version.lines,
        version.discount,
        this.state.services,
        true,
      );
    const calc = version.calculation;
    return calc
      ? {
          ...raw,
          ...deepCopy(calc),
          subtotalCents: cents(calc.subtotal),
          totalCents: cents(calc.total),
          internalCost: calc.cost ?? raw.internalCost,
          internalCommission: calc.commission ?? raw.internalCommission,
        }
      : raw;
  }
  private paymentsFor(
    quoteId: string,
    versionId: string,
    state = this.state,
  ): Payment[] {
    return state.payments.filter(
      (payment) =>
        payment.quoteId === quoteId && payment.versionId === versionId,
    );
  }
  private validPaid(
    quoteId: string,
    versionId: string,
    state = this.state,
  ): number {
    return fromCents(
      this.paymentsFor(quoteId, versionId, state)
        .filter((payment) => payment.status === "valid")
        .reduce((sum, payment) => sum + cents(payment.amount), 0),
    );
  }
  private effectiveOrderCategory(
    categories: InvoiceCategory[] | undefined,
  ): InvoiceCategory | undefined {
    const priority: InvoiceCategory[] = [
      "self-pay",
      "grant-80k",
      "group-buy",
    ];
    return priority.find((category) => categories?.includes(category));
  }
  private installmentPlan(
    category: InvoiceCategory,
    total: number,
  ): Array<{
    installment: number;
    label: string;
    percentage: number;
    amount: number;
    cumulativeAmount: number;
  }> {
    const definitions: Record<
      InvoiceCategory,
      Array<{ label: string; percentage: number }>
    > = {
      "group-buy": [
        { label: "第一期訂金", percentage: 50 },
        { label: "尾數", percentage: 50 },
      ],
      "grant-80k": [
        { label: "第一期訂金", percentage: 30 },
        { label: "第二期訂金", percentage: 20 },
        { label: "尾數", percentage: 50 },
      ],
      "self-pay": [
        { label: "第一期訂金", percentage: 30 },
        { label: "第二期訂金", percentage: 20 },
        { label: "工程中期款", percentage: 30 },
        { label: "尾數", percentage: 20 },
      ],
    };
    const rows = definitions[category];
    const totalCents = cents(total);
    let used = 0;
    return rows.map((row, index) => {
      const amountCents =
        index === rows.length - 1
          ? totalCents - used
          : cents(D(totalCents).div(100).mul(row.percentage).div(100));
      used += amountCents;
      return {
        installment: index + 1,
        label: row.label,
        percentage: row.percentage,
        amount: fromCents(amountCents),
        cumulativeAmount: fromCents(used),
      };
    });
  }
  private paymentStatusRaw(
    invoice: Invoice,
    state = this.state,
  ): InvoicePaymentStatus {
    const quote = this.findQuote(invoice.quoteId, state);
    const category = invoice.category ?? quote.officeCategory ?? "self-pay";
    const plan =
      invoice.paymentPlan ?? this.installmentPlan(category, invoice.netTotal);
    const payments = this.paymentsFor(
      invoice.quoteId,
      invoice.versionId,
      state,
    ).filter((payment) => payment.invoiceId === invoice.id);
    const validPayments = payments.filter(
      (payment) => payment.status === "valid",
    );
    const pendingPayments = payments.filter(
      (payment) => payment.status === "pending",
    );
    const validPaid = fromCents(
      validPayments.reduce((sum, payment) => sum + cents(payment.amount), 0),
    );
    const pendingPaid = fromCents(
      pendingPayments.reduce((sum, payment) => sum + cents(payment.amount), 0),
    );
    const receipts = state.receipts.filter(
      (receipt) => receipt.invoiceId === invoice.id,
    );
    const installments: InstallmentPlanRow[] = plan.map((stage, index) => {
      const priorStagePaid = plan.slice(0, index).every((prior) => {
        const priorPaid = validPayments
          .filter((payment) => payment.installment === prior.installment)
          .reduce((sum, payment) => sum + payment.amount, 0);
        return priorPaid >= prior.amount;
      });
      const received = validPayments
        .filter((payment) => payment.installment === stage.installment)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const stagePending = pendingPayments
        .filter((payment) => payment.installment === stage.installment)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const paymentIds = validPayments
        .filter((payment) => payment.installment === stage.installment)
        .map((payment) => payment.id);
      const receiptIds = receipts
        .filter((item) => item.installment === stage.installment)
        .map((item) => item.id);
      const hasUnreceiptedPayment = validPayments.some(
        (payment) =>
          payment.installment === stage.installment &&
          !receipts.some((receipt) => receipt.paymentId === payment.id),
      );
      const status: InstallmentPlanRow["status"] = !priorStagePaid
        ? "locked"
        : stagePending > 0
          ? "under_review"
          : hasUnreceiptedPayment
            ? "ready_receipt"
            : received >= stage.amount
              ? "receipted"
              : "awaiting_payment";
      return {
        ...stage,
        received: moneyValue(received),
        pending: moneyValue(stagePending),
        status,
        receiptIds,
        paymentIds,
      };
    });
    const order = state.orders.find((item) => item.invoiceId === invoice.id);
    return {
      invoiceId: invoice.id,
      quoteId: invoice.quoteId,
      category,
      total: invoice.netTotal,
      validPaid,
      pendingPaid,
      percentPaid:
        invoice.netTotal > 0
          ? Number(D(validPaid).div(invoice.netTotal).mul(100).toFixed(2))
          : 0,
      openingDue: plan[0].amount,
      csReleaseDue: moneyValue(D(invoice.netTotal).mul(0.5)),
      releasedToCS: Boolean(order?.csReleasedAt),
      completed: validPaid >= invoice.netTotal,
      installments,
    };
  }
  private quoteNeedsMunicipalOrder(
    state: AppState,
    invoice: Invoice,
  ): boolean {
    const quote = state.quotes.find((item) => item.id === invoice.quoteId);
    if (!quote) return invoice.category === "grant-80k";
    if (quote.orderCategories?.length)
      return quote.orderCategories.includes("grant-80k");
    return invoice.category === "grant-80k";
  }
  private ensureGrantOrders(
    state: AppState,
    invoice: Invoice,
    actorId: string,
  ): void {
    if (!this.quoteNeedsMunicipalOrder(state, invoice)) return;
    const existing = state.orders.find(
      (item) => item.invoiceId === invoice.id,
    );
    if (existing) {
      if (
        !state.municipalOrders.some(
          (item) => item.principalOrderId === existing.id,
        )
      ) {
        const base = existing.number.replace(/A$/, "");
        state.municipalOrders.push(
          this.makeMunicipalOrder(state, invoice, existing, base, actorId),
        );
      }
      return;
    }
    const base = invoice.number.replace(/A$/, "");
    const startDate = addDays(DEMO_TODAY, 10);
    const principal: WorkOrder = {
      id: uid("workorder"),
      number: `${base}A`,
      quoteId: invoice.quoteId,
      invoiceId: invoice.id,
      groupId: `group-${invoice.quoteId}`,
      versionId: invoice.versionId,
      customer: deepCopy(invoice.customer),
      lines: deepCopy(invoice.lines),
      createdAt: NOW,
      startDate,
      endDate: addMonthsClamped(
        startDate,
        invoice.lines.length <= 30 ? 3 : 4,
      ),
      status: "pending",
      dateChanges: [],
    };
    state.orders.push(principal);
    state.municipalOrders.push(
      this.makeMunicipalOrder(state, invoice, principal, base, actorId),
    );
    this.audit(state, {
      quoteId: invoice.quoteId,
      workOrderId: principal.id,
      actorId,
      action: "grant_orders_created",
      detail: `8萬資助建立正單 ${principal.number} 及市政單 ${base}B`,
    });
  }
  private makeMunicipalOrder(
    state: AppState,
    invoice: Invoice,
    principal: WorkOrder,
    base: string,
    actorId: string,
  ): MunicipalOrder {
    const pricing =
      invoice.calculation ??
      calculatePricing(invoice.lines, invoice.discount, [], true);
    const amounts = new Map(
      pricing.lineAmounts.map((amount) => [amount.id, amount]),
    );
    const lines: MunicipalOrderLine[] = invoice.lines.map((line) => {
      const priced = amounts.get(line.id);
      const quantity =
        priced?.billedQty ?? line.quantity ?? 0;
      const dimensions =
        line.itemSnapshot.measure === "area"
          ? `${line.length} × ${line.width} ${line.dimensionUnit}`
          : line.itemSnapshot.measure === "length"
            ? `${line.length} ${line.dimensionUnit}`
            : line.itemSnapshot.measure === "fixed"
              ? "一式"
              : `${line.quantity} ${line.itemSnapshot.unit}`;
      const style = line.productStyle
        ? `${line.productStyle.factoryName} · ${line.productStyle.seriesName} · ${line.productStyle.productCode}`
        : line.style;
      return {
        id: uid("municipal-line"),
        sourceLineId: line.id,
        name: line.itemSnapshot.name,
        description: [
          line.position,
          dimensions,
          line.itemSnapshot.details,
          style,
        ]
          .filter(Boolean)
          .join(" · "),
        quantity,
        unit: line.itemSnapshot.unit,
        unitPrice: line.itemSnapshot.price,
        amount: priced?.amount ?? 0,
      };
    });
    return {
      id: uid("municipal-order"),
      number: `${base}B`,
      quoteId: invoice.quoteId,
      invoiceId: invoice.id,
      principalOrderId: principal.id,
      principalOrderNumber: principal.number,
      customer: deepCopy(invoice.customer),
      lines,
      createdAt: NOW,
      actorId,
    };
  }
  private releaseToCsIfReady(
    state: AppState,
    invoice: Invoice,
    actorId: string,
  ): void {
    this.ensureGrantOrders(state, invoice, actorId);
    const status = this.paymentStatusRaw(invoice, state);
    if (status.validPaid < status.csReleaseDue) return;
    let order = state.orders.find((item) => item.invoiceId === invoice.id);
    if (order?.csReleasedAt) return;
    if (!order) {
      const startDate = addDays(DEMO_TODAY, 10);
      order = {
        id: uid("workorder"),
        number: nextWorkOrderNumber(state),
        quoteId: invoice.quoteId,
        invoiceId: invoice.id,
        groupId: `group-${invoice.quoteId}`,
        versionId: invoice.versionId,
        customer: deepCopy(invoice.customer),
        lines: deepCopy(invoice.lines),
        createdAt: NOW,
        startDate,
        endDate: addMonthsClamped(
          startDate,
          invoice.lines.length <= 30 ? 3 : 4,
        ),
        status: "pending",
        dateChanges: [],
      };
      state.orders.push(order);
    }
    order.csReleasedAt = NOW;
    this.audit(state, {
      quoteId: invoice.quoteId,
      workOrderId: order.id,
      actorId,
      action: "work_order_released_to_cs",
      detail: "累計有效收款已達成交額50%，工程單已發工程部",
    });
    state.actors
      .filter((item) => isCsActor(item))
      .forEach((recipient) =>
        this.notify(
          state,
          recipient.id,
          invoice.quoteId,
          `工程 ${order.number} 已收足50%，可安排工程`,
        ),
      );
  }

  listActors(): Actor[] {
    return deepCopy(this.state.actors);
  }
  listCustomers(actorInput: Actor): CustomerProfile[] {
    const actor = this.actor(actorInput);
    return this.state.customers
      .filter((profile) => this.customerReadable(actor, profile))
      .map((profile) => ({
        ...deepCopy(profile),
        customer:
          actor.role === "admin" || profile.ownerId === actor.id
            ? deepCopy(profile.customer)
            : sanitiseCustomer(profile.customer),
      }));
  }
  getCustomer(actorInput: Actor, id: string): Customer {
    const actor = this.actor(actorInput);
    const profile =
      this.state.customers.find((candidate) => candidate.id === id) ??
      fail("找不到客戶主檔。");
    if (!this.customerReadable(actor, profile))
      fail("你沒有查看此客戶的權限。");
    return actor.role === "admin" || profile.ownerId === actor.id
      ? deepCopy(profile.customer)
      : sanitiseCustomer(profile.customer);
  }
  createCustomer(actorInput: Actor, input: Customer): CustomerProfile {
    const actor = this.actor(actorInput);
    if (!this.canWriteQuote(actor) && actor.role !== "admin")
      fail("你沒有建立客戶主檔的權限。");
    const customer = normaliseCustomer(input);
    const missing = validCustomer(customer);
    if (missing.length) fail(`請先補齊客戶資料：${missing.join("、")}`);
    const key = normalizePhone(customer.phone);
    let output!: CustomerProfile;
    this.mutate((state) => {
      const existing = state.customers.find(
        (profile) => normalizePhone(profile.customer.phone) === key,
      );
      if (existing) fail("此電話已有客戶主檔，請先搜尋並使用現有客戶。");
      const profile: CustomerProfile = {
        id: customer.id || uid("customer"),
        ownerId: actor.id,
        team: actor.team ?? "B",
        customer: deepCopy(customer),
        createdAt: NOW,
        updatedAt: NOW,
      };
      profile.customer.id = profile.id;
      state.customers.push(profile);
      this.audit(state, {
        actorId: actor.id,
        action: "customer_created",
        detail: `建立客戶主檔 ${profile.customer.name}`,
      });
      output = deepCopy(profile);
    });
    return actor.role === "admin"
      ? output
      : { ...output, customer: sanitiseCustomer(output.customer) };
  }
  listServiceCategories(actorInput: Actor): string[] {
    const actor = this.actor(actorInput);
    return deepCopy(this.state.serviceCategories);
  }
  addServiceCategory(actorInput: Actor, name: string): void {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin") fail("只有 Super Admin 可維護工程分類。");
    const value = name.trim();
    if (!value) fail("請輸入工程分類名稱。");
    if (this.state.serviceCategories.includes(value))
      fail("已有相同工程分類。");
    this.mutate((state) => {
      state.serviceCategories.push(value);
      this.audit(state, {
        actorId: actor.id,
        action: "service_category_added",
        detail: `新增工程分類 ${value}`,
      });
    });
  }
  deleteServiceCategories(actorInput: Actor, names: string[]): void {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin") fail("只有 Super Admin 可刪除工程分類。");
    const selected = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!selected.length) fail("請選擇要刪除的工程分類。");
    this.mutate((state) => {
      selected.forEach((name) => {
        const index = state.serviceCategories.indexOf(name);
        if (index >= 0) state.serviceCategories.splice(index, 1);
        state.services.forEach((service) => {
          if (service.category !== name) return;
          service.archived = true;
        });
        this.audit(state, {
          actorId: actor.id,
          action: "service_category_deleted",
          detail: `刪除工程分類 ${name}，相關項目一併移除`,
        });
      });
    });
  }
  listServices(actorInput: Actor): ServiceItem[] {
    const actor = this.actor(actorInput);
    return this.state.services
      .filter(
        (item) =>
          actor.role === "admin" ||
          (item.published && !item.archived),
      )
      .map((item) =>
        actor.role === "admin" ? deepCopy(item) : removeCost(item),
      );
  }
  listProductStyleSuppliers(actorInput: Actor): ProductStyleSupplier[] {
    const actor = this.actor(actorInput);
    const selling = ["sales", "supervisor", "head"].includes(actor.role);
    if (actor.role !== "admin" && !selling)
      fail("你沒有查看產品款式的權限。");
    return this.state.suppliers
      .filter(
        (supplier) =>
          supplier.active &&
          supplier.hasProductStyles &&
          Boolean(supplier.catalogueName?.trim()),
      )
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.catalogueName!.trim(),
        categories: [...supplier.categories],
      }));
  }
  listProductStyles(
    actorInput: Actor,
    supplierId: string,
  ): ProductStyleSeries[] {
    const actor = this.actor(actorInput);
    const selling = ["sales", "supervisor", "head"].includes(actor.role);
    if (actor.role !== "admin" && !selling)
      fail("你沒有查看產品款式的權限。");
    const supplier =
      this.state.suppliers.find((item) => item.id === supplierId) ??
      fail("找不到供應商。");
    if (!supplier.hasProductStyles) return [];
    return deepCopy(
      this.state.productStyles
        .filter((series) => series.supplierId === supplierId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  addProductStyleSeries(
    actorInput: Actor,
    supplierId: string,
    name: string,
  ): ProductStyleSeries {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin")
      fail("只有Super Admin可維護產品款式。");
    if (!name.trim()) fail("請輸入產品款式名稱。");
    let output!: ProductStyleSeries;
    this.mutate((state) => {
      const supplier =
        state.suppliers.find((item) => item.id === supplierId) ??
        fail("找不到供應商。");
      if (!supplier.hasProductStyles)
        fail("此供應商沒有開啟產品款式。");
      output = {
        id: uid("style-series"),
        supplierId,
        name: name.trim(),
        images: [],
        createdAt: NOW,
      };
      state.productStyles.push(output);
      this.audit(state, {
        actorId: actor.id,
        action: "product_style_series_created",
        detail: `新增產品款式 ${name.trim()} · ${supplier.name}`,
      });
    });
    return deepCopy(output);
  }
  addProductStyleImage(
    actorInput: Actor,
    seriesId: string,
    attachment: Attachment,
    productCode: string,
  ): ProductStyleImage {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin")
      fail("只有Super Admin可維護產品款式。");
    if (!attachment?.id) fail("請先上載產品圖片。");
    if (!productCode.trim()) fail("請輸入產品編號。");
    let output!: ProductStyleImage;
    this.mutate((state) => {
      const series =
        state.productStyles.find((item) => item.id === seriesId) ??
        fail("找不到產品款式。");
      output = {
        id: uid("style-image"),
        attachment,
        productCode: productCode.trim(),
        createdAt: NOW,
      };
      series.images.push(output);
      series.updatedAt = NOW;
      this.audit(state, {
        actorId: actor.id,
        action: "product_style_image_added",
        detail: `新增產品圖片 ${productCode.trim()} · ${series.name}`,
      });
    });
    return deepCopy(output);
  }
  listSuppliers(actorInput: Actor): Supplier[] {
    const actor = this.actor(actorInput);
    if (!(isCsActor(actor) || actor.role === "admin"))
      fail("你沒有查看供應商的權限。");
    return deepCopy(
      this.state.suppliers
        .filter((supplier) => supplier.active)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  saveSupplier(actorInput: Actor, supplier: Supplier): Supplier {
    const actor = this.actor(actorInput);
    if (!(actor.role === "cs_supervisor" || actor.role === "admin"))
      fail("只有CS主管或Super Admin可維護供應商。");
    if (!supplier.id || !supplier.name?.trim() || !supplier.phone?.trim() || !supplier.contact?.trim())
      fail("請填寫供應商名稱、聯絡人及聯絡電話。");
    if (!supplier.categories?.length)
      fail("請選擇至少一項工程詳細。");
    if (
      supplier.categories.some((category) => !SUPPLIER_CATEGORIES.includes(category as (typeof SUPPLIER_CATEGORIES)[number]))
    )
      fail("供應商工程分類無效。");
    let output!: Supplier;
    this.mutate((state) => {
      const existing = state.suppliers.find((item) => item.id === supplier.id);
      const next: Supplier = {
        ...supplier,
        name: supplier.name.trim(),
        phone: supplier.phone.trim(),
        contact: supplier.contact.trim(),
        contact2: supplier.contact2?.trim() || "",
        phone2: supplier.phone2?.trim() || "",
        address: supplier.address?.trim() || "",
        catalogueName: supplier.catalogueName?.trim() || "",
        logo: supplier.logo,
        categories: [...supplier.categories],
        supply: supplier.supply?.trim() || supplier.categories.join(", "),
        hasProductStyles: Boolean(supplier.hasProductStyles),
        active: true,
        createdAt: existing?.createdAt ?? supplier.createdAt ?? NOW,
      };
      const index = state.suppliers.findIndex((item) => item.id === supplier.id);
      if (index >= 0) state.suppliers[index] = deepCopy(next);
      else state.suppliers.push(deepCopy(next));
      output = deepCopy(next);
      this.audit(state, {
        actorId: actor.id,
        action: "supplier_saved",
        detail: `儲存供應商 ${next.name}`,
      });
    });
    return output;
  }
  deleteSupplier(actorInput: Actor, id: string): void {
    const actor = this.actor(actorInput);
    if (!(actor.role === "cs_supervisor" || actor.role === "admin"))
      fail("只有CS主管或Super Admin可刪除供應商。");
    this.mutate((state) => {
      const supplier =
        state.suppliers.find((item) => item.id === id) ??
        fail("找不到供應商。");
      supplier.active = false;
      this.audit(state, {
        actorId: actor.id,
        action: "supplier_deleted",
        detail: `刪除供應商 ${supplier.name}`,
      });
    });
  }
  saveContractor(actorInput: Actor, resource: Resource): Resource {
    const actor = this.actor(actorInput);
    if (!(actor.role === "cs_supervisor" || actor.role === "admin"))
      fail("只有CS主管或Super Admin可維護工程師傅。");
    if (
      !resource.id ||
      !resource.name?.trim() ||
      !resource.phone?.trim() ||
      !resource.kind ||
      !resource.mainWork
    )
      fail("請填寫師傅稱呼、聯絡電話、性質及主項工程。");
    if (!["project60", "daily", "fixed"].includes(resource.feeMode ?? ""))
      fail("請選擇有效的收費方式。");
    if (
      resource.feeMode !== "project60" &&
      (!Number.isFinite(resource.feeAmount) || (resource.feeAmount ?? 0) < 0)
    )
      fail("請填寫有效的收費金額。");
    let output!: Resource;
    this.mutate((state) => {
      const existing = state.resources.find((item) => item.id === resource.id);
      if (
        existing?.feeMode &&
        existing.feeMode !== resource.feeMode
      )
        fail("收費方式建立後不可更改；請刪除後重新建立。");
      const next: Resource = {
        ...resource,
        name: resource.name.trim(),
        phone: resource.phone.trim(),
        mainWork: resource.mainWork!.trim(),
        specialty: resource.specialty?.trim() || resource.mainWork!.trim(),
        scope: resource.scope?.trim() || resource.mainWork!.trim(),
        trades: [...resource.trades],
        type: resource.kind === "foreman" ? "contractor" : "staff",
        active: true,
        feeAmount:
          resource.feeMode === "project60"
            ? 0
            : resource.feeAmount ?? 0,
        createdAt: existing?.createdAt ?? resource.createdAt ?? NOW,
      };
      const index = state.resources.findIndex((item) => item.id === resource.id);
      if (index >= 0) state.resources[index] = deepCopy(next);
      else state.resources.push(deepCopy(next));
      output = deepCopy(next);
      this.audit(state, {
        actorId: actor.id,
        action: "contractor_saved",
        detail: `儲存工程師傅 ${next.name}`,
      });
    });
    return output;
  }
  deleteContractor(actorInput: Actor, id: string): void {
    const actor = this.actor(actorInput);
    if (!(actor.role === "cs_supervisor" || actor.role === "admin"))
      fail("只有CS主管或Super Admin可刪除工程師傅。");
    this.mutate((state) => {
      const resource =
        state.resources.find((item) => item.id === id) ??
        fail("找不到工程師傅。");
      resource.active = false;
      this.audit(state, {
        actorId: actor.id,
        action: "contractor_deleted",
        detail: `刪除工程師傅 ${resource.name}`,
      });
    });
  }
  listResources(actorInput: Actor): Resource[] {
    const actor = this.actor(actorInput);
    if (
      !(
        isCsActor(actor) ||
        actor.role === "admin" ||
        this.has(actor, "assignment.write")
      )
    )
      fail("你沒有查看合作資源的權限。");
    return deepCopy(this.state.resources);
  }
  listQuotes(actorInput: Actor): Quote[] {
    const actor = this.actor(actorInput);
    if (isCsActor(actor)) return [];
    return this.state.quotes
      .filter((quote) => this.quoteReadable(actor, quote))
      .map((quote) => sanitiseQuote(quote, actor.role === "admin"));
  }
  quoteParentSummary(
    actorInput: Actor,
    quoteId: string,
  ): { number: string; customerName: string } | undefined {
    const actor = this.actor(actorInput);
    const quote = this.findQuote(quoteId);
    if (
      !this.quoteReadable(actor, quote) &&
      !this.canWriteQuote(actor, quote) &&
      actor.role !== "admin"
    )
      fail("你沒有查看此報價的權限。");
    if (!quote.parentQuoteId) return undefined;
    const parent = this.state.quotes.find(
      (item) => item.id === quote.parentQuoteId,
    );
    if (!parent) return undefined;
    return {
      number: parent.number,
      customerName: currentVersion(parent).customer.name,
    };
  }
  updateQuoteOrderMeta(
    actorInput: Actor,
    quoteId: string,
    input: {
      orderCategories?: InvoiceCategory[];
      isAdditionalOrder?: boolean;
      parentQuoteId?: string;
    },
  ): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote) && actor.role !== "admin")
        fail("你沒有修改此報價訂單資料的權限。");
      if (quote.archived) fail("已封存報價不可修改訂單資料。");
      if (quote.invoiceId) fail("已轉 Invoice 的來源不可修改訂單資料。");
      if (input.orderCategories !== undefined) {
        const valid = input.orderCategories.filter((category) =>
          Object.hasOwn(INVOICE_CATEGORY_NAMES, category),
        );
        quote.orderCategories = [...new Set(valid)];
        // Sales now owns classification. The first selected category drives
        // the single invoice/payment-plan category; all selections are kept.
        quote.officeCategory = this.effectiveOrderCategory(
          quote.orderCategories,
        );
      }
      if (input.isAdditionalOrder !== undefined) {
        quote.isAdditionalOrder = Boolean(input.isAdditionalOrder);
        if (!quote.isAdditionalOrder) {
          quote.parentQuoteId = undefined;
        }
      }
      if (input.parentQuoteId !== undefined) {
        quote.parentQuoteId = input.parentQuoteId || undefined;
      }
      if (quote.isAdditionalOrder) {
        const parent = state.quotes.find((item) => item.id === quote.parentQuoteId);
        if (!parent) fail("請選擇原本的報價單。");
        if (parent.ownerId !== quote.ownerId)
          fail("只可選擇自己之前的報價單。");
        if (parent.id === quote.id) fail("不可選擇目前報價作為原本單據。");
      }
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "quote_order_meta_updated",
        detail: "更新訂單分類／加單資料",
      });
    });
  }
  setOfficeCategory(
    actorInput: Actor,
    quoteId: string,
    category: InvoiceCategory,
  ): void {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可以為提交報價分類。 ");
    if (!Object.hasOwn(INVOICE_CATEGORY_NAMES, category))
      fail("請選擇有效的報價分類。 ");
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      const version = currentVersion(quote);
      if (quote.archived || quote.invoiceId)
        fail("此來源不可再修改開單分類。 ");
      if (!quote.submission || quote.submission.versionId !== version.id)
        fail("只可為已提交Office的目前版本分類。 ");
      quote.officeCategory = category;
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "office_category_selected",
        detail: `開單分類：${INVOICE_CATEGORY_NAMES[category]}`,
      });
    });
  }
  getQuote(actorInput: Actor, id: string): Quote {
    const actor = this.actor(actorInput);
    const quote = this.findQuote(id);
    if (isCsActor(actor)) fail("工程CS不可讀取原報價。");
    if (!this.quoteReadable(actor, quote)) fail("你沒有查看此報價的權限。");
    return sanitiseQuote(quote, actor.role === "admin");
  }
  preview(actorInput: Actor, lines: QuoteLine[], discount: number): Pricing {
    const actor = this.actor(actorInput);
    return publicPricing(
      calculatePricing(lines, discount, this.state.services),
      actor,
    );
  }
  pricing(actorInput: Actor, quoteId: string): Pricing {
    const actor = this.actor(actorInput);
    const quote = this.findQuote(quoteId);
    if (isCsActor(actor) || !this.quoteReadable(actor, quote))
      fail("你沒有查看此計價的權限。");
    return publicPricing(this.pricingRaw(quote), actor);
  }
  invoicePricing(actorInput: Actor, invoiceId: string): Pricing {
    const actor = this.actor(actorInput);
    this.getInvoice(actor, invoiceId);
    const invoice =
      this.state.invoices.find((item) => item.id === invoiceId) ??
      fail("找不到Invoice。");
    const calc = invoice.calculation;
    if (calc)
      return actor.role === "admin" ? deepCopy(calc) : safeCalculation(calc)!;
    return publicPricing(
      calculatePricing(invoice.lines, invoice.discount, [], true),
      actor,
    );
  }
  eligibility(actorInput: Actor, quoteId: string): Eligibility {
    const actor = this.actor(actorInput);
    const quote = this.findQuote(quoteId);
    const version = currentVersion(quote);
    const raw = this.pricingRaw(quote);
    const customerMissing = validCustomer(version.customer);
    const engineeringMissing = validEngineering(version, this.state.services);
    const signed = quoteVersionIsSigned(version);
    const currentSubmission = Boolean(
      quote.submission && quote.submission.versionId === version.id,
    );
    const payments = this.paymentsFor(quote.id, version.id);
    const validPaid = this.validPaid(quote.id, version.id);
    const openingDue = quote.officeCategory
      ? this.installmentPlan(quote.officeCategory, raw.total)[0].amount
      : 0;
    const pendingPaid = fromCents(
      payments
        .filter((payment) => payment.status === "pending")
        .reduce((sum, payment) => sum + cents(payment.amount), 0),
    );
    const missing = [...customerMissing, ...engineeringMissing];
    if (!version.signedDocument) missing.push("已簽報價文件");
    if (!version.signature) missing.push("客戶簽署確認");
    if (
      !payments.some(
        (payment) => payment.status !== "rejected" && payment.amount > 0,
      )
    )
      missing.push("至少一筆付款登記");
    if (raw.costIncomplete) missing.push("工程成本設定未完整");
    if (!raw.costIncomplete && raw.blocked)
      missing.push("成交額不足以覆蓋成本及基本佣金");
    const ownerCanSubmit =
      this.canWriteQuote(actor, quote) || actor.role === "admin";
    const canSubmit =
      ownerCanSubmit &&
      !quote.archived &&
      !quote.invoiceId &&
      !currentSubmission &&
      missing.length === 0;
    const canIssue =
      this.canInvoice(actor) &&
      !quote.archived &&
      !quote.invoiceId &&
      currentSubmission &&
      signed &&
      Boolean(quote.officeCategory) &&
      validPaid > 0 &&
      Boolean(
        this.state.actors.find((a) => a.id === version.signature?.supervisorId)
          ?.code,
      );
    let stage: Eligibility["stage"] = "draft";
    let label = "草稿";
    let nextAction = "補齊資料後儲存";
    if (quote.archived) {
      stage = "archived";
      label = "已封存";
      nextAction = "此來源不可再處理";
    } else if (quote.invoiceId) {
      stage = "issued";
      const invoice = this.state.invoices.find(
        (item) => item.id === quote.invoiceId,
      );
      const paymentStatus = invoice
        ? this.paymentStatusRaw(invoice)
        : undefined;
      label = paymentStatus?.releasedToCS
        ? "已交工程部"
        : "已開Invoice・待收足50%";
      nextAction = paymentStatus?.releasedToCS
        ? "由工程CS安排工程"
        : "累計有效收款達成交額50%後自動發工程部";
    } else if (!signed) {
      const complete =
        validCustomer(version.customer).length === 0 &&
        validEngineering(version, this.state.services).length === 0;
      stage = complete ? "awaiting_signature" : "draft";
      label = complete ? "待客戶簽署" : "草稿";
      nextAction = complete ? "上載已簽文件並確認簽署" : "補齊報價資料";
    } else if (!currentSubmission) {
      stage = "ready_submit";
      label = "待交 Office";
      nextAction = missing.length ? "補齊交接條件" : "提交 Office 跟進";
    } else if (!quote.officeCategory) {
      stage = "ready_invoice";
      label = "待分類";
      nextAction = "由開單員選擇團購、8萬資助或自費";
    } else if (validPaid <= 0) {
      stage = pendingPaid > 0 ? "pending_finance" : "needs_balance";
      label = pendingPaid > 0 ? "待會計核款" : "首期尚欠";
      nextAction =
        pendingPaid > 0 ? "等待會計核對付款" : "登記及核對分類後首期";
    } else {
      stage = "ready_invoice";
      label = "可待開單";
      nextAction =
        validPaid < openingDue
          ? "由開單員轉Invoice，之後在單據管理補足第一期"
          : "由開單員轉 Invoice";
    }
    return {
      stage,
      label,
      nextAction,
      canSubmit,
      canIssue,
      missing,
      officeCategory: quote.officeCategory,
      firstDue: openingDue,
      validPaid,
      pendingPaid,
      balance: Math.max(0, moneyValue(D(openingDue).minus(validPaid))),
      hasSignature: Boolean(version.signature),
      hasDocument: Boolean(version.signedDocument),
      hasSubmission: currentSubmission,
      hasInvoice: Boolean(quote.invoiceId),
    };
  }
  listHandoffs(actorInput: Actor): HandoffRow[] {
    const actor = this.actor(actorInput);
    if (
      !(
        isCsActor(actor) ||
        actor.role === "admin" ||
        this.has(actor, "handoff.read")
      )
    )
      fail("你沒有查看 Office 交接的權限。");
    return this.state.quotes.flatMap((quote) => {
      const version = currentVersion(quote);
      if (
        !quote.submission ||
        quote.submission.versionId !== version.id ||
        !quoteVersionIsSigned(version) ||
        !quote.invoiceId
      )
        return [];
      const owner = this.state.actors.find(
        (candidate) => candidate.id === quote.ownerId,
      );
      const status = this.eligibility(actor, quote.id);
      const order = this.state.orders.find(
        (item) => item.invoiceId === quote.invoiceId,
      );
      if (!order?.csReleasedAt) return [];
      const invoice = this.state.invoices.find(
        (item) => item.id === quote.invoiceId,
      );
      const csOwner = order.csOwnerId
        ? this.state.actors.find((candidate) => candidate.id === order.csOwnerId)
        : undefined;
      return [
        {
          quoteId: quote.id,
          number: quote.number,
          quoteNumber: quote.number,
          workOrderNumber: order.number,
          invoiceNumber: invoice?.number ?? "",
          releasedAt: order.csReleasedAt ?? order.createdAt,
          customerName: version.customer.name,
          phone: version.customer.phone,
          category: invoice?.category ?? quote.officeCategory,
          csOwnerId: order.csOwnerId,
          csOwnerName: csOwner?.name,
          district: version.customer.district,
          address: version.customer.address,
          salesId: quote.ownerId,
          salesName: owner?.name ?? "未知",
          stage: status.stage,
          label: status.label,
          nextAction: status.nextAction,
          firstDue: status.firstDue,
          validPaid: status.validPaid,
          pendingPaid: status.pendingPaid,
          balance: status.balance,
          invoiceId: quote.invoiceId,
          workOrderId: order.id,
          items: version.lines.map((line) => ({
            name: line.itemSnapshot.name,
            position: line.position,
            quantity: line.quantity,
            style: line.style,
          })),
        },
      ];
    });
  }
  listCsTeam(actorInput: Actor): Actor[] {
    const actor = this.actor(actorInput);
    if (!(isCsActor(actor) || actor.role === "admin"))
      fail("你沒有查看工程部CS團隊的權限。");
    return this.state.actors
      .filter((candidate) => isCsActor(candidate))
      .map(deepCopy);
  }
  assignCsOwner(
    actorInput: Actor,
    workOrderId: string,
    csOwnerId: string,
  ): WorkOrder {
    const actor = this.actor(actorInput);
    if (actor.role !== "cs_supervisor" && actor.role !== "admin")
      fail("只有CS主管或Super Admin可以安排跟進同事。");
    let output!: WorkOrder;
    this.mutate((state) => {
      const order =
        state.orders.find((item) => item.id === workOrderId) ??
        fail("找不到工程單。");
      if (!order.csReleasedAt) fail("此工程尚未發到CS，未可安排跟進。");
      const owner = state.actors.find((item) => item.id === csOwnerId);
      if (!owner || !isCsActor(owner)) fail("請選擇有效的CS同事。");
      if (order.csOwnerId === owner.id) {
        output = deepCopy(order);
        return;
      }
      order.csOwnerId = owner.id;
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "cs_followup_assigned",
        detail: `安排CS跟進同事：${owner.name}`,
      });
      output = deepCopy(order);
    });
    return sanitiseOrder(output, actor.role === "admin");
  }
  listPayments(actorInput: Actor): Payment[] {
    const actor = this.actor(actorInput);
    const clerk = actor.role === "clerk";
    const finance =
      actor.role === "finance" ||
      actor.role === "clerk" ||
      actor.role === "admin" ||
      actor.grants.includes("finance.read") ||
      actor.grants.includes("finance.validate");
    if (
      !finance &&
      !clerk &&
      !["sales", "head", "supervisor"].includes(actor.role)
    )
      fail("你沒有查看付款的權限。");
    const rows = this.state.payments
      .filter((payment) =>
        finance || clerk
          ? true
          : this.findQuote(payment.quoteId).ownerId === actor.id,
      )
      .map(deepCopy);
    return rows;
  }
  listInvoices(actorInput: Actor): Invoice[] {
    const actor = this.actor(actorInput);
    const readable = (invoice: Invoice) =>
      actor.role === "admin" ||
      (isCsActor(actor) && this.csInvoiceReadable(actor, invoice)) ||
      actor.role === "clerk" ||
      actor.role === "finance" ||
      this.has(actor, "invoice.read") ||
      this.findQuote(invoice.quoteId).ownerId === actor.id;
    return this.state.invoices
      .filter(readable)
      .map((invoice) => sanitiseInvoice(invoice, actor.role === "admin"));
  }
  listReceipts(actorInput: Actor): Receipt[] {
    const actor = this.actor(actorInput);
    if (
      !["admin", "finance", "clerk", "sales", "head", "supervisor"].includes(
        actor.role,
      )
    )
      fail("你沒有查看收據的權限。");
    return this.state.receipts
      .filter((receipt) => {
        if (
          actor.role === "admin" ||
          actor.role === "finance" ||
          actor.role === "clerk"
        )
          return true;
        return this.findQuote(receipt.quoteId).ownerId === actor.id;
      })
      .map(deepCopy);
  }
  getReceipt(actorInput: Actor, id: string): Receipt {
    const actor = this.actor(actorInput);
    const receipt =
      this.state.receipts.find((item) => item.id === id) ??
      fail("找不到收據。");
    if (
      !["admin", "finance", "clerk", "sales", "head", "supervisor"].includes(
        actor.role,
      )
    )
      fail("你沒有查看收據的權限。");
    if (
      !["admin", "finance", "clerk"].includes(actor.role) &&
      this.findQuote(receipt.quoteId).ownerId !== actor.id
    )
      fail("你沒有查看此收據的權限。");
    return deepCopy(receipt);
  }
  getInvoice(actorInput: Actor, id: string): Invoice {
    const actor = this.actor(actorInput);
    const invoice =
      this.state.invoices.find((item) => item.id === id) ??
      fail("找不到 Invoice。");
    if (
      !(
        actor.role === "admin" ||
        (isCsActor(actor) && this.csInvoiceReadable(actor, invoice)) ||
        actor.role === "clerk" ||
        actor.role === "finance" ||
        this.has(actor, "invoice.read") ||
        this.findQuote(invoice.quoteId).ownerId === actor.id
      )
    )
      fail("你沒有查看此 Invoice 的權限。");
    return sanitiseInvoice(invoice, actor.role === "admin");
  }
  invoicePaymentStatus(
    actorInput: Actor,
    invoiceId: string,
  ): InvoicePaymentStatus {
    const actor = this.actor(actorInput);
    if (isCsActor(actor)) fail("工程CS不可查看付款詳情或收據。 ");
    const invoice =
      this.state.invoices.find((item) => item.id === invoiceId) ??
      fail("找不到Invoice。");
    const readable =
      actor.role === "admin" ||
      actor.role === "finance" ||
      actor.role === "clerk" ||
      this.findQuote(invoice.quoteId).ownerId === actor.id;
    if (!readable) fail("你沒有查看此Invoice付款詳情的權限。 ");
    return deepCopy(this.paymentStatusRaw(invoice));
  }
  listMunicipalOrders(actorInput: Actor): MunicipalOrder[] {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可查看市政單。");
    return deepCopy(
      this.state.municipalOrders.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
  }
  getMunicipalOrder(actorInput: Actor, id: string): MunicipalOrder {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可查看市政單。");
    const order =
      this.state.municipalOrders.find((item) => item.id === id) ??
      fail("找不到市政單。");
    return deepCopy(order);
  }
  updateMunicipalOrder(
    actorInput: Actor,
    id: string,
    lines: MunicipalOrderLine[],
  ): MunicipalOrder {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可修改市政單。");
    if (!lines.length) fail("市政單最少要有一個項目。");
    const clean = lines.map((line, index) => {
      if (!line.name?.trim()) fail(`第 ${index + 1} 項請填寫項目名稱。`);
      if (
        !isFiniteNonNegative(line.quantity) ||
        !isFiniteNonNegative(line.unitPrice) ||
        !isFiniteNonNegative(line.amount)
      )
        fail(`第 ${index + 1} 項的數量或價錢無效。`);
      return {
        id: line.id || uid("municipal-line"),
        sourceLineId: line.sourceLineId,
        name: line.name.trim(),
        description: line.description?.trim() || "",
        quantity: line.quantity,
        unit: line.unit?.trim() || "項",
        unitPrice: line.unitPrice,
        amount: line.amount,
      };
    });
    let output!: MunicipalOrder;
    this.mutate((state) => {
      const order =
        state.municipalOrders.find((item) => item.id === id) ??
        fail("找不到市政單。");
      order.lines = deepCopy(clean);
      order.updatedAt = NOW;
      output = deepCopy(order);
      this.audit(state, {
        quoteId: order.quoteId,
        actorId: actor.id,
        action: "municipal_order_updated",
        detail: `修改市政單 ${order.number}`,
      });
    });
    return output;
  }
  listOrders(actorInput: Actor): WorkOrder[] {
    const actor = this.actor(actorInput);
    return this.state.orders
      .filter((order) => this.orderReadable(actor, order))
      .map((order) => sanitiseOrder(order, actor.role === "admin"));
  }
  getOrder(actorInput: Actor, id: string): WorkOrder {
    const actor = this.actor(actorInput);
    const order =
      this.state.orders.find((item) => item.id === id) ??
      fail("找不到工程單。");
    if (!this.orderReadable(actor, order))
      fail("你沒有查看此工程單的權限。");
    return sanitiseOrder(order, actor.role === "admin");
  }
  /** Quote-version line amounts for a released engineering order, without
   * exposing quote pricing to CS. */
  orderLineAmounts(
    actorInput: Actor,
    workOrderId: string,
  ): Record<string, number> {
    const actor = this.actor(actorInput);
    const order =
      this.state.orders.find((item) => item.id === workOrderId) ??
      fail("找不到工程單。");
    if (!this.orderReadable(actor, order))
      fail("你沒有查看此工程單的權限。");
    const quote = this.state.quotes.find((item) => item.id === order.quoteId);
    if (!quote) return {};
    const version =
      quote.versions.find((item) => item.id === order.versionId) ??
      currentVersion(quote);
    const raw = calculatePricing(
      version.lines,
      version.discount,
      this.state.services,
      true,
    );
    return Object.fromEntries(
      raw.lineAmounts.map((amount) => [amount.id, amount.amount]),
    );
  }
  listAssignments(actorInput: Actor, workOrderId: string): Assignment[] {
    const actor = this.actor(actorInput);
    const order =
      this.state.orders.find((item) => item.id === workOrderId) ??
      fail("找不到工程單。");
    if (!this.orderReadable(actor, order))
      fail("你沒有查看此工程安排的權限。");
    return deepCopy(
      this.state.assignments.filter(
        (assignment) => assignment.workOrderId === workOrderId,
      ),
    );
  }
  listExtraWorks(actorInput: Actor, workOrderId: string): ExtraWork[] {
    const actor = this.actor(actorInput);
    const order =
      this.state.orders.find((item) => item.id === workOrderId) ??
      fail("找不到工程單。");
    if (!this.orderReadable(actor, order))
      fail("你沒有查看此額外工程的權限。");
    return deepCopy(
      this.state.extraWorks.filter(
        (extra) => extra.workOrderId === workOrderId,
      ),
    );
  }
  listAudit(actorInput: Actor, quoteId: string): AuditEvent[] {
    const actor = this.actor(actorInput);
    const quote = this.findQuote(quoteId);
    if (
      !(
        isCsActor(actor) ||
        this.quoteReadable(actor, quote) ||
        actor.role === "admin"
      )
    )
      fail("你沒有查看此歷史的權限。");
    const rows = this.state.audits
      .filter((event) => event.quoteId === quoteId)
      .map(deepCopy);
    if (isCsActor(actor))
      rows.forEach((event) => {
        event.detail = event.action.replace(/_/g, " ");
      });
    return rows;
  }
  performance(actorInput: Actor, month: string): Performance {
    const actor = this.actor(actorInput);
    const entries: PerformanceEntry[] = [];
    this.state.quotes.forEach((quote) => {
      const version = currentVersion(quote);
      const signature = version.signature;
      if (
        !signature ||
        !quote.submission ||
        quote.submission.versionId !== version.id
      )
        return;
      const raw = this.pricingRaw(quote);
      const invoice = quote.invoiceId
        ? this.state.invoices.find((item) => item.id === quote.invoiceId)
        : undefined;
      if (!invoice) return;
      const firstDue = (invoice.paymentPlan ??
        this.installmentPlan(
          invoice.category ?? "self-pay",
          invoice.netTotal,
        ))[0].amount;
      const payments = this.paymentsFor(quote.id, version.id).filter(
        (payment) =>
          payment.status === "valid" && payment.invoiceId === invoice.id,
      );
      const cumulative = payments
        .sort((a, b) => a.validDate!.localeCompare(b.validDate!))
        .reduce((sum, payment) => sum + payment.amount, 0);
      if (cumulative < firstDue) return;
      let running = 0;
      let qualificationDate = "";
      for (const payment of payments.sort((a, b) =>
        a.validDate!.localeCompare(b.validDate!),
      )) {
        running += payment.amount;
        if (running >= firstDue) {
          qualificationDate = payment.validDate ?? payment.date;
          break;
        }
      }
      if (!qualificationDate.startsWith(month)) return;
      const low = factor(version.discount).lt(0.95);
      const owner = this.state.actors.find((a) => a.id === quote.ownerId);
      const supervisor = this.state.actors.find(
        (a) => a.id === signature.supervisorId,
      );
      if (!owner || !supervisor) return;
      let rate = 0;
      if (actor.id === owner.id) rate += low ? 0.06 : 0.08;
      if (quote.team === "A" && actor.id === supervisor.id)
        rate += low ? 0.03 : 0.04;
      if (quote.team === "B" && actor.id === supervisor.id)
        rate += low ? 0.02 : 0.03;
      if (quote.team === "B" && actor.id === "head-don") rate += 0.01;
      if (!rate) return;
      entries.push({
        quoteId: quote.id,
        number: quote.number,
        customerName: version.customer.name,
        total: raw.total,
        rate,
        commission: moneyValue(D(raw.total).mul(rate)),
        date: qualificationDate,
      });
    });
    const managementEntries =
      actor.role === "head"
        ? entries.filter((entry) => this.findQuote(entry.quoteId).team === "A")
        : actor.role === "supervisor"
          ? entries.filter(
              (entry) =>
                currentVersion(this.findQuote(entry.quoteId)).signature
                  ?.supervisorId === actor.id,
            )
          : entries;
    const sales = moneyValue(
      managementEntries.reduce((sum, entry) => D(sum).plus(entry.total), D(0)),
    );
    const commission = moneyValue(
      entries.reduce((sum, entry) => D(sum).plus(entry.commission), D(0)),
    );
    let bonus = 0;
    let nextTarget: number | undefined;
    let nextBonus: number | undefined;
    const ladder =
      actor.role === "head"
        ? [
            [800000, 6000],
            [1000000, 10000],
            [1200000, 15000],
          ]
        : actor.role === "supervisor"
          ? [
              [900000, 3000],
              [1200000, 6000],
              [1500000, 10000],
              [1800000, 15000],
            ]
          : [
              [300000, 3000],
              [400000, 6000],
              [500000, 10000],
              [600000, 15000],
            ];
    ladder.forEach(([target, reward]) => {
      if (sales >= target) bonus = reward;
      else if (nextTarget === undefined) {
        nextTarget = target;
        nextBonus = reward;
      }
    });
    return { sales, commission, bonus, nextTarget, nextBonus, entries };
  }
  notifications(actorInput: Actor): Notification[] {
    const actor = this.actor(actorInput);
    return deepCopy(
      this.state.notifications.filter((item) => item.actorId === actor.id),
    );
  }
  readNotification(actorInput: Actor, id: string): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const row =
        state.notifications.find((item) => item.id === id) ??
        fail("找不到通知。");
      if (row.actorId !== actor.id) fail("你不可讀取其他人的通知。");
      row.read = true;
    });
  }

  saveDraft(
    actorInput: Actor,
    quoteId: string | undefined,
    input: DraftInput,
  ): Quote {
    const actor = this.actor(actorInput);
    let output!: Quote;
    this.mutate((state) => {
      const quote = quoteId ? this.findQuote(quoteId, state) : undefined;
      const clerkCorrection =
        actor.role === "clerk" &&
        Boolean(quote?.submission) &&
        !quote?.invoiceId;
      if (
        !this.canWriteQuote(actor, quote) &&
        actor.role !== "admin" &&
        !clerkCorrection
      )
        fail("你沒有儲存此報價草稿的權限。");
      if (quote?.archived) fail("已封存報價不可修改。");
      if (quote?.invoiceId)
        fail("已轉 Invoice 的來源不可修改，請使用工程變更流程。");
      const services = new Map(state.services.map((item) => [item.id, item]));
      const rebuilt = input.lines.map((line, index) => {
        const service = services.get(line.itemId);
        if (!service || !service.published)
          fail(`第 ${index + 1} 項工程目錄無效或未發布。`);
        return {
          ...deepCopy(line),
          id: line.id || uid("line"),
          itemSnapshot: deepCopy(service),
        };
      });
      const basePricing = calculatePricing(rebuilt, 1, state.services, true);
      const selectedDiscount = resolveDraftDiscount(
        input,
        basePricing.subtotal,
      );
      const phone = normalizePhone(input.customer.phone);
      if (phone) {
        const matches = state.quotes
          .flatMap((candidate) =>
            candidate.versions.map((version) => ({ candidate, version })),
          )
          .filter(
            ({ candidate, version }) =>
              candidate.id !== quote?.id &&
              normalizePhone(version.customer.phone) === phone,
          );
        const foreign = matches.find(
          ({ candidate }) => candidate.ownerId !== (quote?.ownerId ?? actor.id),
        );
        if (foreign && actor.role !== "admin")
          fail("此電話已由其他 Sales 建立，請 Admin 核對客戶資料。");
        const own = matches.find(
          ({ candidate }) => candidate.ownerId === (quote?.ownerId ?? actor.id),
        );
        if (own?.version.customer.id && !input.customer.id)
          input.customer.id = own.version.customer.id;
      }
      const customerInput = {
        ...normaliseCustomer(input.customer),
      };
      const customer = this.syncCustomerProfile(
        state,
        actor,
        customerInput,
        quote?.ownerId ?? actor.id,
        quote?.team ?? actor.team ?? "B",
      );
      if (!quote) {
        const number = `草稿-${actor.code}-${yyMM()}-${String(state.quotes.length + 1).padStart(4, "0")}`;
        const created: Quote = {
          id: uid("quote"),
          number,
          ownerId: actor.id,
          team: actor.team ?? "B",
          versions: [
            {
              id: uid("version"),
              index: 1,
              customer,
              lines: rebuilt,
              discount: selectedDiscount.discount,
              discountMode: selectedDiscount.mode,
              discountValue: selectedDiscount.value,
              createdAt: NOW,
            },
          ],
          createdAt: NOW,
          updatedAt: NOW,
          archived: false,
        };
        state.quotes.push(created);
        this.audit(state, {
          quoteId: created.id,
          actorId: actor.id,
          action: "draft_created",
          detail: "建立草稿",
        });
        output = deepCopy(created);
        return;
      }
      const version = currentVersion(quote);
      if (clerkCorrection) {
        if (!input.reason?.trim())
          fail("開單員更正報價必須填寫更正原因。");
        const nextVersion: QuoteVersion = {
          id: uid("version"),
          index: version.index + 1,
          customer,
          lines: rebuilt,
          discount: selectedDiscount.discount,
          discountMode: selectedDiscount.mode,
          discountValue: selectedDiscount.value,
          createdAt: NOW,
          reason: input.reason.trim(),
        };
        quote.versions.push(nextVersion);
        // Actual payments remain with the source; the corrected version keeps
        // them so accounting does not lose money already received.
        state.payments
          .filter((payment) => payment.quoteId === quote.id)
          .forEach((payment) => {
            payment.versionId = nextVersion.id;
          });
        quote.updatedAt = NOW;
        this.audit(state, {
          quoteId: quote.id,
          actorId: actor.id,
          action: "clerk_quote_corrected",
          detail: `開單員建立更正版本 ${nextVersion.index}：${input.reason.trim()}`,
        });
        output = deepCopy(quote);
        return;
      }
      if (quoteVersionIsSigned(version) || version.printPreparation) {
        if (quoteVersionIsSigned(version) && !input.reason?.trim())
          fail("已簽版本修改必須填寫修改原因並重新簽署。");
        const payments = this.paymentsFor(quote.id, version.id, state);
        if (payments.length)
          fail("此已簽版本已有付款，請先人工核對，不能直接改版。");
        if (quote.submission) {
          delete quote.submission;
          this.audit(state, {
            quoteId: quote.id,
            actorId: actor.id,
            action: "office_submission_invalidated",
            detail: "新版本令舊 Office 交接失效",
          });
        }
        quote.versions.push({
          id: uid("version"),
          index: version.index + 1,
          customer,
          lines: rebuilt,
          discount: selectedDiscount.discount,
          discountMode: selectedDiscount.mode,
          discountValue: selectedDiscount.value,
          createdAt: NOW,
          reason: input.reason?.trim() || "正式報價列印前修改",
        });
      } else {
        delete version.signedDocument;
        version.customer = customer;
        version.lines = rebuilt;
        version.discount = selectedDiscount.discount;
        version.discountMode = selectedDiscount.mode;
        version.discountValue = selectedDiscount.value;
        if (input.reason?.trim()) version.reason = input.reason.trim();
      }
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId: quote.id,
        actorId: actor.id,
        action: "draft_saved",
        detail: "儲存報價草稿",
      });
      output = deepCopy(quote);
    });
    return actor.role === "admin" ? output : sanitiseQuote(output, false);
  }
  prepareQuoteForPrint(
    actorInput: Actor,
    quoteId: string,
    input: { date: string; supervisorId: string },
  ): Quote {
    const actor = this.actor(actorInput);
    let output!: Quote;
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote))
        fail("你沒有準備此報價列印的權限。");
      if (quote.archived || quote.invoiceId)
        fail("此來源不可再準備正式報價單。");
      if (!validPastDate(input.date))
        fail("列印日期必須是有效已發生日期，不可晚於原型今日。");
      const version = currentVersion(quote);
      if (quoteVersionIsSigned(version)) {
        output = deepCopy(quote);
        return;
      }
      if (version.printPreparation) {
        if (
          version.printPreparation.date === input.date &&
          version.printPreparation.supervisorId === input.supervisorId
        ) {
          output = deepCopy(quote);
          return;
        }
        fail(
          "此版本已生成正式報價號；如需改列印日期或當日主管，請先修改報價建立新版本。",
        );
      }
      const required = [
        ...validCustomer(version.customer),
        ...validEngineering(version, state.services),
      ];
      if (required.length) fail(`請先補齊報價資料：${required.join("、")}`);
      const raw = calculatePricing(
        version.lines,
        version.discount,
        state.services,
        true,
      );
      if (raw.costIncomplete) fail("工程成本設定未完整，未可準備正式報價單。");
      if (raw.blocked) fail("成交額不足以覆蓋成本及基本佣金，未可列印。");
      const supervisor =
        state.actors.find((item) => item.id === input.supervisorId) ??
        fail("找不到當日主管。");
      const owner =
        state.actors.find((item) => item.id === quote.ownerId) ??
        fail("找不到此報價的Sales。");
      if (
        !(supervisor.role === "supervisor" || supervisor.role === "head") ||
        (supervisor.role === "supervisor" && supervisor.team !== quote.team)
      )
        fail("當日主管與此報價 Team 不匹配。");
      const month = dateKey(input.date);
      const sequence = (state.quoteSequences[month] ?? 0) + 1;
      state.quoteSequences[month] = sequence;
      const quoteNumber = `Q${supervisor.code}${owner.code}${yyMM(input.date)}${String(sequence).padStart(4, "0")}`;
      version.printPreparation = {
        date: input.date,
        supervisorId: supervisor.id,
        actorId: actor.id,
        quoteNumber,
        createdAt: NOW,
      };
      quote.number = quoteNumber;
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId: quote.id,
        actorId: actor.id,
        action: "quote_prepared_for_print",
        detail: `準備列印正式報價單 ${quoteNumber}`,
      });
      output = deepCopy(quote);
    });
    return actor.role === "admin" ? output : sanitiseQuote(output, false);
  }
  uploadDocument(
    actorInput: Actor,
    quoteId: string,
    attachment: Attachment,
  ): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote))
        fail("你沒有上載此報價文件的權限。");
      if (quote.archived) fail("已封存報價不可上載文件。");
      if (quote.invoiceId) fail("已轉 Invoice 的來源不可改動。");
      if (!attachment?.id || !attachment.name)
        fail("請選擇有效的已簽報價文件。");
      const version = currentVersion(quote);
      if (version.signature) fail("已確認簽署的原檔不可覆改。");
      if (!version.printPreparation)
        fail("請先準備及列印正式報價單，再回來上載已簽紙本。");
      version.signedDocument = deepCopy(attachment);
      version.signedDocumentQuoteNumber = version.printPreparation.quoteNumber;
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "signed_document_uploaded",
        detail: "上載已簽報價文件",
      });
    });
  }
  clearSignedDocument(actorInput: Actor, quoteId: string): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote) && actor.role !== "admin")
        fail("你沒有刪除已簽文件的權限。");
      if (quote.archived) fail("已封存報價不可刪除文件。");
      if (quote.invoiceId) fail("已轉 Invoice 的來源不可刪除文件。");
      const version = currentVersion(quote);
      if (version.signature) fail("已確認簽署後不可刪除已簽文件。");
      version.signedDocument = undefined;
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "signed_document_removed",
        detail: "刪除已簽報價文件",
      });
    });
  }
  recordSignature(
    actorInput: Actor,
    quoteId: string,
    input: { date: string; supervisorId: string; confirmed: boolean },
  ): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote))
        fail("你沒有確認此報價簽署的權限。");
      if (quote.archived) fail("已封存報價不可確認簽署。");
      if (quote.invoiceId) fail("已轉 Invoice 的來源不可再記錄簽署。");
      const version = currentVersion(quote);
      if (!input.confirmed) fail("必須明確確認客戶已簽署指定版本。");
      if (!validPastDate(input.date))
        fail("簽署日期必須是有效已發生日期，不可晚於原型今日。");
      if (!version.signedDocument) fail("請先上載並綁定已簽報價文件。");
      if (version.signature) {
        if (
          version.signature.date === input.date &&
          version.signature.supervisorId === input.supervisorId
        )
          return;
        fail("已確認的簽署日期及主管不可覆改。");
      }
      if (!version.printPreparation)
        fail("請先準備及列印正式報價單，再回來上載已簽紙本。");
      if (
        version.signedDocumentQuoteNumber !==
        version.printPreparation.quoteNumber
      )
        fail("已簽檔未綁定目前正式報價號，請重新上載同一份已簽紙本。");
      if (
        version.printPreparation.date !== input.date ||
        version.printPreparation.supervisorId !== input.supervisorId
      )
        fail(
          "已簽紙本必須與列印時的日期及當日主管相同；如有變動請重新準備列印。",
        );
      const required = [
        ...validCustomer(version.customer),
        ...validEngineering(version, state.services),
      ];
      if (required.length) fail(`請先補齊報價資料：${required.join("、")}`);
      if (
        version.lines.some(
          (line) =>
            JSON.stringify(line.itemSnapshot) !==
            JSON.stringify(
              state.services.find((item) => item.id === line.itemId),
            ),
        )
      )
        fail("價目已更新，請先修改並儲存報價、重新上載對應簽檔，再確認簽署。");
      const supervisor =
        state.actors.find((item) => item.id === input.supervisorId) ??
        fail("找不到簽署日主管。");
      if (
        !(supervisor.role === "supervisor" || supervisor.role === "head") ||
        (supervisor.role === "supervisor" && supervisor.team !== quote.team)
      )
        fail("簽署日主管與此報價 Team 不匹配。");
      version.signature = {
        date: input.date,
        supervisorId: supervisor.id,
        actorId: actor.id,
        createdAt: NOW,
      };
      version.calculation = frozen(
        calculatePricing(version.lines, version.discount, state.services, true),
      );
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "signature_recorded",
        detail: `確認版本 ${version.index} 已簽署`,
      });
    });
  }
  recordPayment(
    actorInput: Actor,
    quoteId: string,
    input: PaymentInput,
  ): Payment {
    const actor = this.actor(actorInput);
    let output!: Payment;
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote)) fail("你沒有登記此付款的權限。");
      if (quote.archived) fail("已封存報價不可登記付款。");
      if (quote.invoiceId)
        fail("此來源已轉 Invoice，請由財務流程處理後續款項。");
      const version = currentVersion(quote);
      if (!quoteVersionIsSigned(version))
        fail("請先完成已簽文件及客戶簽署確認。");
      if (!(input.amount > 0) || !Number.isFinite(input.amount))
        fail("每次只可登記一筆大於零的付款。");
      if (!validPastDate(input.date) || !input.custody)
        fail("請填寫有效已發生付款日期及保管人。");
      output = {
        id: uid("payment"),
        quoteId,
        versionId: version.id,
        amount: moneyValue(input.amount),
        method: input.method,
        date: input.date,
        custody: input.custody,
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        proof: input.proof ? deepCopy(input.proof) : undefined,
        status: "pending",
        createdAt: NOW,
        actorId: actor.id,
      };
      state.payments.push(output);
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "payment_recorded",
        detail: `登記付款 ${output.amount}`,
      });
    });
    return deepCopy(output);
  }
  submitOffice(actorInput: Actor, quoteId: string): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (!this.canWriteQuote(actor, quote) && actor.role !== "admin")
        fail("你沒有提交此 Office 交接的權限。");
      if (quote.archived || quote.invoiceId)
        fail("此來源目前不可提交 Office。");
      const version = currentVersion(quote);
      if (quote.submission?.versionId === version.id) return;
      if (!quoteVersionIsSigned(version))
        fail("請先上載已簽文件並確認客戶簽署。");
      const missing = [
        ...validCustomer(version.customer),
        ...validEngineering(version, state.services),
      ];
      if (missing.length)
        fail(`未可交 Office，請補齊：${missing.join("、")}。`);
      const payment = this.paymentsFor(quote.id, version.id, state).find(
        (item) => item.status !== "rejected" && item.amount > 0,
      );
      if (!payment) fail("請先登記至少一筆客戶付款。");
      const raw = this.pricingRaw(quote);
      if (raw.costIncomplete) fail("工程成本設定未完整，未可交 Office。");
      if (raw.blocked) fail("成交額不足以覆蓋成本及基本佣金，未可交 Office。");
      quote.submission = {
        id: uid("submission"),
        versionId: version.id,
        actorId: actor.id,
        createdAt: NOW,
      };
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId,
        actorId: actor.id,
        action: "office_submitted",
        detail: "提交 Office 跟進",
      });
      state.actors
        .filter((item) => item.role === "finance" || item.role === "clerk")
        .forEach((recipient) =>
          this.notify(
            state,
            recipient.id,
            quoteId,
            `報價 ${quote.number} 已交 Office 跟進`,
          ),
        );
    });
  }
  validatePayment(
    actorInput: Actor,
    paymentId: string,
    input: { date: string; cleared: boolean; notes?: string; reject?: boolean },
  ): void {
    const actor = this.actor(actorInput);
    if (!this.canFinance(actor)) fail("你沒有核對客戶付款的權限。");
    this.mutate((state) => {
      const payment =
        state.payments.find((item) => item.id === paymentId) ??
        fail("找不到付款紀錄。");
      const quote = this.findQuote(payment.quoteId, state);
      const version = currentVersion(quote);
      if (
        !quote.submission ||
        quote.submission.versionId !== payment.versionId ||
        version.id !== payment.versionId
      )
        fail("付款來源並非有效已交 Office 版本。");
      if (!validPastDate(input.date)) fail("有效收款日期不可晚於原型今日。");
      if (input.reject) {
        payment.status = "rejected";
        payment.validatedBy = actor.id;
        payment.validDate = input.date;
        payment.cleared = Boolean(input.cleared);
        payment.notes = [payment.notes, input.notes].filter(Boolean).join("\n");
      } else {
        if (payment.method === "cheque" && !input.cleared)
          fail("支票未兌現，不可核作有效付款。");
        if (
          (payment.method === "fps" || payment.method === "transfer") &&
          !input.cleared
        )
          fail("銀行付款未核實，不可核作有效付款。");
        payment.status = "valid";
        payment.validatedBy = actor.id;
        payment.validDate = input.date;
        payment.cleared = input.cleared;
        payment.notes = [payment.notes, input.notes].filter(Boolean).join("\n");
      }
      this.audit(state, {
        quoteId: quote.id,
        actorId: actor.id,
        action: input.reject ? "payment_rejected" : "payment_validated",
        detail: input.reject ? "付款被拒絕" : "付款已由會計核對",
      });
      if (!input.reject && payment.invoiceId) {
        const invoice = state.invoices.find(
          (item) => item.id === payment.invoiceId,
        );
        if (invoice) this.releaseToCsIfReady(state, invoice, actor.id);
      }
    });
  }
  issueInvoice(actorInput: Actor, quoteId: string): Invoice {
    const actor = this.actor(actorInput);
    if (!this.canInvoice(actor)) fail("你沒有轉Invoice的權限。");
    let output!: Invoice;
    this.mutate((state) => {
      const quote = this.findQuote(quoteId, state);
      if (quote.invoiceId) {
        output = deepCopy(
          state.invoices.find((item) => item.id === quote.invoiceId) ??
            fail("Invoice資料不完整。"),
        );
        return;
      }
      if (quote.archived) fail("已封存來源不可開Invoice。");
      const version = currentVersion(quote);
      const signature = version.signature;
      const category =
        this.effectiveOrderCategory(quote.orderCategories) ??
        quote.officeCategory;
      if (!category) fail("Sales尚未選擇訂單分類，未能開Invoice。");
      if (
        !quote.submission ||
        quote.submission.versionId !== version.id ||
        !quoteVersionIsSigned(version) ||
        !signature
      )
        fail("此來源未完成有效簽署及Office交接。");
      const raw = this.pricingRaw(quote);
      const paymentPlan = this.installmentPlan(category, raw.total);
      if (this.validPaid(quote.id, version.id, state) <= 0)
        fail("請先由會計或開單員核對至少一筆有效收款，才可開Invoice。");
      const supervisor = state.actors.find(
        (item) => item.id === signature.supervisorId,
      );
      const owner = state.actors.find((item) => item.id === quote.ownerId);
      if (!supervisor?.code || !owner?.code)
        fail("主管或Sales代號未完整，未可開Invoice。");
      const month = dateKey(DEMO_TODAY);
      const sequence = (state.monthlySequences[month] ?? 0) + 1;
      state.monthlySequences[month] = sequence;
      const numberBase = `${supervisor.code}${owner.code}${yyMM(DEMO_TODAY)}${String(sequence).padStart(4, "0")}`;
      const hasGrant =
        quote.orderCategories?.length
          ? quote.orderCategories.includes("grant-80k")
          : category === "grant-80k";
      const number = hasGrant ? `${numberBase}A` : numberBase;
      const invoice: Invoice = {
        id: uid("invoice"),
        number,
        quoteId: quote.id,
        versionId: version.id,
        customer: deepCopy(version.customer),
        lines: deepCopy(version.lines),
        discount: version.discount,
        discountMode: version.discountMode,
        discountValue: version.discountValue,
        netTotal: raw.total,
        createdAt: NOW,
        actorId: actor.id,
        supervisorId: supervisor.id,
        category,
        paymentPlan: deepCopy(paymentPlan),
        calculation: frozen(raw),
      };
      state.payments
        .filter(
          (payment) =>
            payment.quoteId === quote.id &&
            payment.versionId === version.id &&
            !payment.invoiceId,
        )
        .forEach((payment) => {
          payment.invoiceId = invoice.id;
          payment.installment = 1;
        });
      state.invoices.push(invoice);
      quote.invoiceId = invoice.id;
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId: quote.id,
        actorId: actor.id,
        action: "invoice_issued",
        detail: `生成 ${number}（${INVOICE_CATEGORY_NAMES[category]}）`,
      });
      this.ensureGrantOrders(state, invoice, actor.id);
      this.releaseToCsIfReady(state, invoice, actor.id);
      output = deepCopy(invoice);
    });
    return this.actor(actorInput).role === "admin"
      ? output
      : sanitiseInvoice(output, false);
  }
  recordInstallmentPayment(
    actorInput: Actor,
    invoiceId: string,
    installment: number,
    input: InstallmentPaymentInput,
  ): Payment {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可以登記後續期款。");
    let output!: Payment;
    this.mutate((state) => {
      const invoice =
        state.invoices.find((item) => item.id === invoiceId) ??
        fail("找不到Invoice。");
      const status = this.paymentStatusRaw(invoice, state);
      const stage = status.installments.find(
        (item) => item.installment === installment,
      );
      if (!stage) fail("付款期數無效。");
      if (stage.status === "locked") fail("請先核足前一期款項。");
      if (stage.received + stage.pending >= stage.amount)
        fail("此期款已足額登記，無需重複新增。");
      if (!(input.amount > 0) || !Number.isFinite(input.amount))
        fail("每次只可登記一筆大於零的付款。");
      const remaining = moneyValue(
        D(stage.amount).minus(stage.received).minus(stage.pending),
      );
      if (input.amount > remaining)
        fail(`本期尚可登記 ${money(remaining)}，請按付款計劃分期登記。`);
      if (!validPastDate(input.date)) fail("請填寫有效已發生付款日期。");
      output = {
        id: uid("payment"),
        quoteId: invoice.quoteId,
        versionId: invoice.versionId,
        invoiceId: invoice.id,
        installment,
        amount: moneyValue(input.amount),
        method: input.method,
        date: input.date,
        custody: "company",
        reference: input.reference ?? "",
        notes: input.notes ?? "",
        proof: input.proof ? deepCopy(input.proof) : undefined,
        status: "pending",
        cleared: input.cleared,
        createdAt: NOW,
        actorId: actor.id,
      };
      state.payments.push(output);
      this.audit(state, {
        quoteId: invoice.quoteId,
        actorId: actor.id,
        action: "installment_payment_recorded",
        detail: `登記第${installment}期款 ${output.amount}，待核對`,
      });
    });
    return deepCopy(output);
  }
  issueReceipt(actorInput: Actor, paymentId: string): Receipt {
    const actor = this.actor(actorInput);
    if (!(actor.role === "clerk" || actor.role === "admin"))
      fail("只有開單員或Super Admin可以發出收據。");
    let output!: Receipt;
    this.mutate((state) => {
      const payment =
        state.payments.find((item) => item.id === paymentId) ??
        fail("找不到付款紀錄。");
      if (!payment.invoiceId || !payment.installment)
        fail("此付款尚未關聯Invoice期款，未可發收據。");
      if (payment.status !== "valid") fail("只可為已核對有效的付款發出收據。");
      const invoice =
        state.invoices.find((item) => item.id === payment.invoiceId) ??
        fail("找不到Invoice。");
      const existing = state.receipts.find(
        (receipt) => receipt.paymentId === payment.id,
      );
      if (existing) {
        output = deepCopy(existing);
        return;
      }
      const stage = (
        invoice.paymentPlan ??
        this.installmentPlan(invoice.category ?? "self-pay", invoice.netTotal)
      ).find((item) => item.installment === payment.installment);
      if (!stage) fail("Invoice付款計劃不完整，未可發收據。");
      const month = dateKey(DEMO_TODAY);
      const sequence = (state.receiptSequences[month] ?? 0) + 1;
      state.receiptSequences[month] = sequence;
      const receipt: Receipt = {
        id: uid("receipt"),
        number: `R-${DEMO_TODAY.slice(0, 4)}${DEMO_TODAY.slice(5, 7)}-${String(sequence).padStart(4, "0")}`,
        invoiceId: invoice.id,
        quoteId: invoice.quoteId,
        installment: payment.installment,
        installmentLabel: stage.label,
        percentage: stage.percentage,
        paymentId: payment.id,
        amount: payment.amount,
        paymentIds: [payment.id],
        issuedAt: NOW,
        actorId: actor.id,
      };
      state.receipts.push(receipt);
      this.audit(state, {
        quoteId: invoice.quoteId,
        actorId: actor.id,
        action: "receipt_issued",
        detail: `發出 ${receipt.number}（${stage.label}）`,
      });
      output = deepCopy(receipt);
    });
    return output;
  }
  assign(
    actorInput: Actor,
    workOrderId: string,
    input: AssignmentInput,
  ): Assignment {
    const actor = this.actor(actorInput);
    if (
      !(
        isCsActor(actor) ||
        actor.role === "admin" ||
        actor.grants.includes("assignment.write")
      )
    )
      fail("你沒有安排工程的權限。");
    let output!: Assignment;
    this.mutate((state) => {
      const order =
        state.orders.find((item) => item.id === workOrderId) ??
        fail("找不到工程單。");
      if (isCsActor(actor) && !order.csReleasedAt)
        fail("此工程尚未收足50%，未可安排工程。 ");
      if (!this.orderReadable(actor, order))
        fail("你沒有安排此工程的權限。");
      const resource =
        state.resources.find((item) => item.id === input.resourceId) ??
        fail("找不到合作資源。");
      if (!resource.active) fail("此合作資源已停用。");
      if (!input.lineIds.length) fail("請選擇至少一項待安排明細。");
      if (!input.date || !input.time) fail("請填寫安排日期及時間。");
      const endDate = input.endDate ?? input.date;
      if (endDate < input.date) fail("完工日期不可早於開工日期。");
      const selected = order.lines.filter((line) =>
        input.lineIds.includes(line.id),
      );
      if (selected.length !== input.lineIds.length)
        fail("所選工程明細不屬於此工程單。");
      const used = new Set(
        state.assignments
          .filter((item) => item.workOrderId === order.id)
          .flatMap((item) => item.lineIds),
      );
      if (selected.some((line) => used.has(line.id)))
        fail("所選明細已有安排，不可重複分派。");
      // CS needs every entered 師傅／判頭 available on every demo order.
      // Resource type/trade is descriptive only; do not block assignments by it.
      output = {
        id: uid("assignment"),
        workOrderId: order.id,
        resourceId: resource.id,
        lineIds: [...input.lineIds],
        date: input.date,
        endDate,
        time: input.time,
        notes: input.notes ?? "",
        actorId: actor.id,
        createdAt: NOW,
      };
      state.assignments.push(output);
      order.status = order.lines.every((line) =>
        [...used, ...input.lineIds].includes(line.id),
      )
        ? "arranged"
        : "pending";
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "assignment_saved",
        detail: "儲存工程安排，未標記為已施工",
      });
    });
    return deepCopy(output);
  }
  updateAssignment(
    actorInput: Actor,
    assignmentId: string,
    input: Omit<AssignmentInput, "lineIds">,
  ): Assignment {
    const actor = this.actor(actorInput);
    if (!(isCsActor(actor) || actor.role === "admin"))
      fail("你沒有修改工程安排的權限。");
    let output!: Assignment;
    this.mutate((state) => {
      const assignment =
        state.assignments.find((item) => item.id === assignmentId) ??
        fail("找不到工程安排。");
      const order =
        state.orders.find((item) => item.id === assignment.workOrderId) ??
        fail("找不到工程單。");
      if (!this.orderReadable(actor, order))
        fail("你沒有修改此工程安排的權限。");
      if (!input.date || !input.time) fail("請填寫安排日期及時間。");
      const endDate = input.endDate ?? input.date;
      if (endDate < input.date) fail("完工日期不可早於開工日期。");
      const resource =
        state.resources.find((item) => item.id === input.resourceId) ??
        fail("找不到合作資源。");
      if (!resource.active) fail("此合作資源已停用。");
      const selected = order.lines.filter((line) =>
        assignment.lineIds.includes(line.id),
      );
      // Resource type/trade is descriptive only; do not block assignments by it.
      assignment.resourceId = input.resourceId;
      assignment.date = input.date;
      assignment.endDate = endDate;
      assignment.time = input.time;
      assignment.notes = input.notes ?? "";
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "assignment_updated",
        detail: `更新施工安排：${resource.name}`,
      });
      output = deepCopy(assignment);
    });
    return output;
  }
  addSitePhotos(
    actorInput: Actor,
    workOrderId: string,
    attachments: Attachment[],
  ): WorkOrder {
    const actor = this.actor(actorInput);
    if (!(isCsActor(actor) || actor.role === "admin"))
      fail("你沒有上載現場環境圖片的權限。");
    if (!attachments.length) fail("請選擇現場環境圖片。");
    let output!: WorkOrder;
    this.mutate((state) => {
      const order =
        state.orders.find((item) => item.id === workOrderId) ??
        fail("找不到工程單。");
      if (!order.csReleasedAt) fail("此工程尚未發到CS。");
      if (!this.orderReadable(actor, order))
        fail("你沒有上載此工程圖片的權限。");
      const fresh = attachments.filter(
        (attachment) =>
          attachment?.id &&
          attachment.name &&
          !(order.sitePhotos ?? []).some(
            (item) => item.id === attachment.id,
          ),
      );
      if (!fresh.length) {
        output = deepCopy(order);
        return;
      }
      order.sitePhotos = [
        ...(order.sitePhotos ?? []),
        ...fresh.map((attachment) => deepCopy(attachment)),
      ];
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "site_photos_uploaded",
        detail: `上載現場環境圖片 ${fresh.length} 張`,
      });
      output = deepCopy(order);
    });
    return sanitiseOrder(output, actor.role === "admin");
  }
  scheduleExtraWork(
    actorInput: Actor,
    workOrderId: string,
    input: ExtraWorkInput,
  ): ExtraWork {
    const actor = this.actor(actorInput);
    if (!(isCsActor(actor) || actor.role === "admin"))
      fail("你沒有安排額外工程的權限。");
    let output!: ExtraWork;
    this.mutate((state) => {
      const order =
        state.orders.find((item) => item.id === workOrderId) ??
        fail("找不到工程單。");
      if (!order.csReleasedAt) fail("此工程尚未發到CS。");
      if (!this.orderReadable(actor, order))
        fail("你沒有安排此額外工程的權限。");
      const kinds: ExtraWorkKind[] = [
        "measure",
        "delivery",
        "transport",
        "fabrication",
      ];
      if (!kinds.includes(input.kind)) fail("請選擇有效的額外工程。");
      const isFabrication = input.kind === "fabrication";
      let resource: Resource | undefined;
      let supplier: Supplier | undefined;
      if (isFabrication) {
        supplier =
          state.suppliers.find((item) => item.id === input.supplierId) ??
          fail("找不到造貨供應商。");
        if (!supplier.active) fail("此供應商已停用。");
        if (
          !input.category ||
          !supplier.categories.includes(input.category)
        )
          fail("請選擇該供應商提供的造貨項目。");
      } else {
        resource =
          state.resources.find((item) => item.id === input.resourceId) ??
          fail("找不到合作資源。");
        if (!resource.active) fail("此合作資源已停用。");
      }
      if (!input.startDate || !input.endDate || !input.time)
        fail("請填寫額外工程的開工、完工日期及時間。");
      if (input.endDate < input.startDate)
        fail("完工日期不可早於開工日期。");
      if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0))
        fail("請填寫有效的額外工程收費。");
      const existing = state.extraWorks.find(
        (item) => item.workOrderId === order.id && item.kind === input.kind,
      );
      const record: ExtraWork = existing ?? {
        id: uid("extra-work"),
        workOrderId: order.id,
        kind: input.kind,
        resourceId: resource?.id ?? "",
        startDate: input.startDate,
        endDate: input.endDate,
        time: input.time,
        notes: input.notes ?? "",
        price: input.price ?? 0,
        supplierId: input.supplierId,
        category: input.category,
        actorId: actor.id,
        createdAt: NOW,
      };
      record.resourceId = resource?.id ?? "";
      record.startDate = input.startDate;
      record.endDate = input.endDate;
      record.time = input.time;
      record.notes = input.notes ?? "";
      record.price = input.price ?? 0;
      record.supplierId = input.supplierId;
      record.category = input.category;
      record.updatedAt = NOW;
      if (!existing) state.extraWorks.push(record);
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "extra_work_scheduled",
        detail: `安排${EXTRA_WORK_LABELS[input.kind]}：${input.startDate} 至 ${input.endDate}`,
      });
      output = deepCopy(record);
    });
    return output;
  }
  archiveQuote(
    actorInput: Actor,
    id: string,
    input: { reason: ArchiveReason; note?: string },
  ): void {
    const actor = this.actor(actorInput);
    this.mutate((state) => {
      const allowedReasons: ArchiveReason[] = [
        "customer_rejected",
        "no_follow_up",
        "duplicate",
        "other",
      ];
      if (!allowedReasons.includes(input.reason)) fail("請選擇有效封存原因。");
      if (input.reason === "other" && !input.note?.trim())
        fail("選擇其他原因時請填寫補充說明。");
      const quote = this.findQuote(id, state);
      if (!this.canWriteQuote(actor, quote) && actor.role !== "admin")
        fail("你沒有封存此報價的權限。");
      if (quote.archived) return;
      if (
        quote.submission ||
        quote.invoiceId ||
        state.payments.some((item) => item.quoteId === quote.id)
      )
        fail(
          "已有 Office 交接、付款或 Invoice 的來源不可直接封存，請人工處理。",
        );
      quote.archived = true;
      quote.archive = {
        reason: input.reason,
        note: input.note?.trim() ?? "",
        actorId: actor.id,
        archivedAt: NOW,
      };
      quote.updatedAt = NOW;
      this.audit(state, {
        quoteId: quote.id,
        actorId: actor.id,
        action: "quote_archived",
        detail: `封存草稿來源：${input.reason}`,
      });
    });
  }
  deleteService(actorInput: Actor, id: string): void {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin") fail("只有 Super Admin 可刪除工程項目。");
    this.mutate((state) => {
      const service =
        state.services.find((item) => item.id === id) ??
        fail("找不到工程項目。");
      if (service.archived) return;
      service.archived = true;
      this.audit(state, {
        actorId: actor.id,
        action: "service_deleted",
        detail: `刪除工程項目 ${service.name}`,
      });
    });
  }
  saveService(actorInput: Actor, item: ServiceItem): void {
    const actor = this.actor(actorInput);
    if (actor.role !== "admin") fail("只有 Super Admin 可維護工程目錄。");
    if (!serviceComplete(item))
      fail("工程目錄資料未完整或不屬目前支援的計價規則。");
    const previous = this.state.services.find(
      (service) => service.id === item.id,
    );
    if (previous && previous.measure !== item.measure)
      fail("計算方式建立後不可更改；請刪除項目後重新建立。");
    if (item.linkedServiceIds?.includes(item.id))
      fail("工程項目不可連貫自己。");
    this.mutate((state) => {
      const index = state.services.findIndex(
        (service) => service.id === item.id,
      );
      if (index >= 0) state.services[index] = deepCopy(item);
      else state.services.push(deepCopy(item));
      this.audit(state, {
        actorId: actor.id,
        action: "service_saved",
        detail: `儲存工程目錄 ${item.code}`,
      });
    });
  }
  updateDates(
    actorInput: Actor,
    woId: string,
    input: { start: string; end: string; reason: string },
  ): void {
    const actor = this.actor(actorInput);
    if (
      !(
        isCsActor(actor) ||
        actor.role === "admin" ||
        actor.grants.includes("assignment.write")
      )
    )
      fail("你沒有修改工程日期的權限。");
    this.mutate((state) => {
      const order =
        state.orders.find((item) => item.id === woId) ?? fail("找不到工程單。");
      if (!this.orderReadable(actor, order))
        fail("你沒有修改此工程日期的權限。");
      if (!input.start || !input.end || input.start > input.end)
        fail("請填寫合理的開工及完工日期。");
      if (!input.reason?.trim()) fail("修改工程日期必須填寫原因。");
      order.dateChanges.push({
        start: order.startDate,
        end: order.endDate,
        reason: input.reason.trim(),
        actorId: actor.id,
        at: NOW,
      });
      order.startDate = input.start;
      order.endDate = input.end;
      this.audit(state, {
        quoteId: order.quoteId,
        workOrderId: order.id,
        actorId: actor.id,
        action: "dates_updated",
        detail: "更新預計工程日期",
      });
    });
  }
  reset(): void {
    this.commit(createSeedState(), true);
  }
}

function attachment(id: string, name: string): Attachment {
  return { id, name, mime: "image/jpeg", size: 1024, createdAt: NOW };
}
function customer(id: string, name: string, phone: string): Customer {
  return {
    id,
    name,
    phone,
    whatsapp: phone,
    email: "",
    idName: `${name}（Demo）`,
    idNumber: `DEMO-${id.toUpperCase()}`,
    source: "朋友介紹",
    isElderly: "no",
    notes: "Demo資料，非真實客戶。",
    emergencyName: "Demo 緊急聯絡人",
    emergencyPhone: "91234567",
    district: "黃大仙",
    street: "龍華街",
    estate: "Demo 花園",
    block: "1座",
    floor: "12樓",
    unit: "A室",
    address: "黃大仙 龍華街 Demo 花園 1座 12樓 A室",
    ownerName: name,
    managementPhone: "",
    parking: "",
    precautions: "無",
    attachment: attachment(`customer-file-${id}`, "demo-customer-document.jpg"),
  };
}
function quoteLine(
  id: string,
  service: ServiceItem,
  override: Partial<QuoteLine> = {},
): QuoteLine {
  return {
    id,
    itemId: service.id,
    itemSnapshot: deepCopy(service),
    position: "客廳",
    length: service.measure === "area" || service.measure === "length" ? 10 : 0,
    width: service.measure === "area" ? 8 : 0,
    dimensionUnit: "呎",
    quantity: service.measure === "quantity" ? 1 : 0,
    style: service.options[0] ?? "",
    notes: "Demo 工程明細",
    ...override,
  };
}

const DEMO_ENGINEERING_NAMES = [
  "陳大文", "李小明", "黃美玲", "張志強", "王雅雯", "劉家豪", "何嘉欣", "梁俊傑",
  "吳淑芬", "周文輝", "鄭麗華", "林志明", "馮詠儀", "曾偉業", "黃家寶", "陳婉婷",
  "李國雄", "張秀蘭", "劉德華", "何美琪", "梁志豪", "吳凱琳", "周家俊", "鄭美儀",
  "林國強", "馮嘉敏", "曾志偉", "黃雅文", "陳家輝", "李美華", "張偉強",
];
const DEMO_ENGINEERING_DISTRICTS = [
  "黃大仙", "觀塘", "沙田", "荃灣", "將軍澳", "屯門", "元朗", "深水埗",
];

function demoLineAmount(line: QuoteLine): number {
  const price = line.itemSnapshot.price;
  if (line.itemSnapshot.measure === "area")
    return Math.round(line.length * line.width * price);
  if (line.itemSnapshot.measure === "length")
    return Math.round(line.length * price);
  if (line.itemSnapshot.measure === "fixed") return price;
  return Math.round(line.quantity * price);
}

function demoEngineeringLines(
  services: ServiceItem[],
  count: number,
  prefix: string,
  offset = 0,
): QuoteLine[] {
  const positions = [
    "客廳", "飯廳", "主人房", "客房", "廚房", "浴室", "走廊", "露台",
    "書房", "工人房",
  ];
  return Array.from({ length: count }, (_, index) => {
    const service = services[(offset + index) % services.length];
    return quoteLine(`${prefix}-line-${index + 1}`, service, {
      id: `${prefix}-line-${index + 1}`,
      position: positions[index % positions.length],
      length:
        service.measure === "area" || service.measure === "length"
          ? 8 + (index % 8)
          : 0,
      width: service.measure === "area" ? 6 + (index % 4) : 0,
      quantity: service.measure === "quantity" ? 1 + (index % 3) : 0,
      notes: "Demo 工程明細",
    });
  });
}

const DEMO_ORDER_NUMBERS = new Set([
  ...Array.from({ length: 30 }, (_, index) => `D2600${String(200 + index)}`),
  "D260099",
]);

function refreshDemoEngineeringOrders(state: AppState): void {
  const active = state.services.filter(
    (service) => service.published && !service.archived,
  );
  if (!active.length) return;
  const demoOrders = state.orders.filter((order) =>
    DEMO_ORDER_NUMBERS.has(order.number),
  );
  const demoIds = new Set(demoOrders.map((order) => order.id));
  demoOrders.forEach((order, index) => {
    const count = order.number === "D260099" ? 20 : 12;
    order.lines = demoEngineeringLines(
      active,
      count,
      `${order.number.toLowerCase()}-v2`,
      index * 3,
    );
    order.status = "pending";
  });
  state.assignments = state.assignments.filter(
    (assignment) => !demoIds.has(assignment.workOrderId),
  );
}

/** 30 張已分派給工程CS的demo工程，另加一張20項、待阿花分派的D260099。 */
function appendDemoEngineeringOrders(seed: AppState): void {
  const services = seed.services.filter(
    (service) => service.published && !service.archived,
  );
  if (!services.length) return;
  const makeDemo = (
    index: number,
    number: string,
    lineCount: number,
    ownerId?: string,
  ) => {
    const customerName =
      DEMO_ENGINEERING_NAMES[index % DEMO_ENGINEERING_NAMES.length];
    const district =
      DEMO_ENGINEERING_DISTRICTS[index % DEMO_ENGINEERING_DISTRICTS.length];
    const demoCustomer = customer(
      `demo-engineering-customer-${index}`,
      customerName,
      `9${String(6100000 + index).padStart(7, "0")}`,
    );
    demoCustomer.district = district;
    demoCustomer.estate = `Demo 屋苑 ${index + 1}`;
    demoCustomer.block = `${(index % 4) + 1}座`;
    demoCustomer.floor = `${(index % 12) + 5}樓`;
    demoCustomer.unit = `${String.fromCharCode(65 + (index % 4))}室`;
    demoCustomer.street = "Demo 工程街";
    demoCustomer.address = `${district} Demo 工程街 Demo 屋苑 ${index + 1} ${demoCustomer.block} ${demoCustomer.floor} ${demoCustomer.unit}`;
    const lines = demoEngineeringLines(
      services,
      lineCount,
      number.toLowerCase(),
      index * 3,
    );
    const total = lines.reduce((sum, line) => sum + demoLineAmount(line), 0);
    const quoteId = `quote-${number.toLowerCase()}`;
    const versionId = `version-${number.toLowerCase()}`;
    const invoiceId = `invoice-${number.toLowerCase()}`;
    const createdAt =
      number === "D260099"
        ? "2026-10-28T10:00:00+08:00"
        : `2026-10-${String((index % 28) + 1).padStart(2, "0")}T09:00:00+08:00`;
    const invoice: Invoice = {
      id: invoiceId,
      number:
        number === "D260099"
          ? "SHMM26100099"
          : `SHMM2610${String(200 + index).padStart(4, "0")}`,
      quoteId,
      versionId,
      customer: deepCopy(demoCustomer),
      lines: deepCopy(lines),
      discount: 0,
      discountMode: "none",
      discountValue: 0,
      netTotal: total,
      createdAt,
      actorId: "clerk",
      supervisorId: "admin",
      category: "self-pay",
    };
    const quote: Quote = {
      id: quoteId,
      number: `QDEMO${number.slice(1)}`,
      ownerId: "sales-mm",
      team: "B",
      versions: [
        {
          id: versionId,
          index: 1,
          customer: deepCopy(demoCustomer),
          lines: deepCopy(lines),
          discount: 1,
          createdAt,
          signedDocument: attachment(
            `signed-${number.toLowerCase()}`,
            `${number}-signed.jpg`,
          ),
          signature: {
            date: "2026-10-20",
            supervisorId: "supervisor-sh",
            actorId: "sales-mm",
            createdAt,
          },
          printPreparation: {
            date: "2026-10-20",
            supervisorId: "supervisor-sh",
            actorId: "sales-mm",
            quoteNumber: `QDEMO${number.slice(1)}`,
            createdAt,
          },
          signedDocumentQuoteNumber: `QDEMO${number.slice(1)}`,
        },
      ],
      createdAt,
      updatedAt: createdAt,
      archived: false,
      submission: {
        id: `submission-${number.toLowerCase()}`,
        versionId,
        actorId: "sales-mm",
        createdAt,
      },
      officeCategory: "self-pay",
      invoiceId,
    };
    const order: WorkOrder = {
      id: `workorder-${number.toLowerCase()}`,
      number,
      quoteId,
      invoiceId,
      groupId: `group-${number.toLowerCase()}`,
      versionId,
      customer: deepCopy(demoCustomer),
      lines: deepCopy(lines),
      createdAt,
      startDate: `2026-11-${String((index % 28) + 1).padStart(2, "0")}`,
      endDate: "2027-03-20",
      status: "pending",
      csReleasedAt: createdAt,
      csOwnerId: ownerId,
      dateChanges: [],
    };
    seed.quotes.push(quote);
    seed.invoices.push(invoice);
    seed.orders.push(order);
  };
  for (let index = 0; index < 30; index += 1)
    makeDemo(index, `D2600${String(200 + index)}`, 12, "cs");
  makeDemo(30, "D260099", 20);
}

const DEMO_CATALOG_SERVICE_IDS = [
  "svc-demo-demolition-kitchen",
  "svc-demo-demolition-toilet",
  "svc-demo-demolition-whole",
  "svc-demo-demolition-living",
  "svc-demo-demolition-balcony",
  "svc-demo-demolition-garden",
];
function createDemoCatalogServices(): ServiceItem[] {
  const rows: Array<[string, string, string, string]> = [
    ["廚房牆身/地台 清拆打鑿", "廚房", "DEM-KIT", "svc-demo-demolition-kitchen"],
    ["廁所牆身/地台 清拆打鑿", "廁所", "DEM-TOI", "svc-demo-demolition-toilet"],
    ["全屋牆身/地台 清拆打鑿", "全屋", "DEM-WHO", "svc-demo-demolition-whole"],
    ["廳房牆身/地台 清拆打鑿", "廳房", "DEM-LIV", "svc-demo-demolition-living"],
    ["露台牆身/地台 清拆打鑿", "露台", "DEM-BAL", "svc-demo-demolition-balcony"],
    ["花園牆身/地台 清拆打鑿", "花園", "DEM-GAR", "svc-demo-demolition-garden"],
  ];
  return rows.map(([name, scope, code, id]) => ({
    id,
    code,
    name,
    category: "打拆",
    scope,
    details:
      "打鑿大約2-3寸，以見到石屎為盡；清拆後廢物另外收費",
    linkedServiceIds: [],
    unit: "平方呎",
    price: 50,
    measure: "area",
    minQty: 100,
    minAmount: 0,
    increment: 0.5,
    minScope: "service",
    execution: "contractor",
    costMode: "ratio",
    costBasis: "line",
    options: [],
    allowPending: false,
    notes: "",
    published: true,
  }));
}

const DEMO_ADDITIONAL_SERVICE_IDS = [
  "svc-demo-water-01", "svc-demo-water-02", "svc-demo-water-03",
  "svc-demo-water-04", "svc-demo-water-05", "svc-demo-water-06",
  "svc-demo-mud-01", "svc-demo-mud-02", "svc-demo-mud-03",
  "svc-demo-mud-04", "svc-demo-mud-05", "svc-demo-mud-06",
  "svc-demo-paint-01", "svc-demo-paint-02", "svc-demo-paint-03",
  "svc-demo-paint-04", "svc-demo-paint-05", "svc-demo-paint-06",
  "svc-demo-furniture-01", "svc-demo-furniture-02", "svc-demo-furniture-03",
  "svc-demo-furniture-04", "svc-demo-furniture-05", "svc-demo-furniture-06",
];
function createAdditionalCatalogServices(): ServiceItem[] {
  const waterDetails =
    "連工包料和清走舊有喉管 來水喉管 舊有鐵喉更換包膠銅喉 (用簪欖做法)";
  const base = (
    id: string,
    code: string,
    name: string,
    category: string,
    details: string,
  ): ServiceItem => ({
    id,
    code,
    name,
    category,
    scope: "",
    details,
    linkedServiceIds: [],
    unit: "平方呎",
    price: 50,
    measure: "area" as const,
    minQty: 0,
    minAmount: 0,
    increment: 0.5,
    minScope: "service" as const,
    execution: "contractor" as const,
    costMode: "ratio" as const,
    costBasis: "line" as const,
    options: [],
    allowPending: false,
    notes: "",
    published: true,
  });
  const water: Array<[string, string, string, number, string]> = [
    ["WTR-ALL-OPEN", "更換所有來水喉管 (明喉)", "全屋", 9000, "01"],
    ["WTR-ALL-HIDDEN", "更換所有來水喉管 (暗喉)", "全屋", 13000, "02"],
    ["WTR-KIT-OPEN", "廚房更換來水喉管 (明喉)", "廚房", 1800, "03"],
    ["WTR-TOI-OPEN", "廁所更換來水喉管 (明喉)", "廁所", 1800, "04"],
    ["WTR-KIT-HIDDEN", "廚房更換來水喉管 (暗喉)", "廚房", 2800, "05"],
    ["WTR-TOI-HIDDEN", "廁所更換來水喉管 (暗喉)", "廁所", 2800, "06"],
  ].map(([code, name, scope, price, suffix]) => [
    code,
    name,
    scope,
    price,
    suffix,
  ] as [string, string, string, number, string]);
  const mud: Array<[string, string, string]> = [
    ["MUD-KIT-WALL-CEIL", "廚房牆身/天花 批盪/地台做底", "廚房"],
    ["MUD-KIT-WALL", "廚房牆身 批盪/地台做底", "廚房"],
    ["MUD-TOI-WALL-CEIL", "廁所牆身/天花 批盪/地台做底", "廁所"],
    ["MUD-TOI-FLOOR", "廁所地台 批盪/地台做底", "廁所"],
    ["MUD-KIT-FLOOR-TILE", "廚房地台 鋪瓷磚 連工(包$20以下一呎瓷磚材料)", "廚房"],
    ["MUD-KIT-WALL-TILE", "廚房牆身 鋪瓷磚 連工(包$20以下一呎瓷磚材料)", "廚房"],
  ];
  const paint: Array<[string, string, string]> = [
    ["PNT-WHOLE", "全屋剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "全屋"],
    ["PNT-KIT-CEIL", "廚房天花剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "廚房"],
    ["PNT-KIT-WALL", "廚房牆身剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "廚房"],
    ["PNT-LIV-CEIL", "大廳天花剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "廳房"],
    ["PNT-ROOM-CEIL", "房間天花剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "廳房"],
    ["PNT-TOI-CEIL", "廁所天花剷走鬆散底灰、批灰及髹油 (有傢俬和雜物)", "廁所"],
  ];
  const furniture: Array<[string, string, string, number, "length" | "fixed"]> = [
    ["FUR-KIT-HANG", "廚房生態夾板吊櫃", "廚房", 1500, "length"],
    ["FUR-KIT-BASE", "廚房生態夾板地櫃連石英石面", "廚房", 1800, "length"],
    ["FUR-KIT-HANG-BASE", "廚房生態夾板吊櫃及地櫃連石英石面", "廚房", 2700, "length"],
    ["FUR-KIT-DRAWER", "廚房地櫃更換抽屜", "廚房", 480, "fixed"],
    ["FUR-KIT-HINGE", "廚房地櫃更換門鉸位 包五金配件 清走舊有廢料", "廚房", 480, "fixed"],
    ["FUR-WARDROBE-DOOR", "衣櫃更換木門 連門鉸 清走舊有櫃門", "廳房", 680, "fixed"],
  ];
  const rows: ServiceItem[] = [];
  water.forEach(([code, name, scope, price, suffix]) => {
    const service = base(
      `svc-demo-water-${suffix}`,
      code,
      name,
      "水喉",
      waterDetails,
    );
    service.scope = scope;
    service.price = price;
    service.measure = "fixed";
    service.unit = "項";
    service.minQty = 0;
    service.increment = 0;
    service.minScope = "line";
    rows.push(service);
  });
  mud.forEach(([code, name, scope], index) => {
    const service = base(
      `svc-demo-mud-${String(index + 1).padStart(2, "0")}`,
      code,
      name,
      "泥水",
      "連工包料",
    );
    service.scope = scope;
    service.minQty = 100;
    rows.push(service);
  });
  paint.forEach(([code, name, scope], index) => {
    const service = base(
      `svc-demo-paint-${String(index + 1).padStart(2, "0")}`,
      code,
      name,
      "油漆",
      "連工包料用立邦五合一油漆",
    );
    service.scope = scope;
    service.minQty = 150;
    rows.push(service);
  });
  furniture.forEach(([code, name, scope, price, measure], index) => {
    const service = base(
      `svc-demo-furniture-${String(index + 1).padStart(2, "0")}`,
      code,
      name,
      "傢俬",
      "包運輸及安裝和五金配件",
    );
    service.scope = scope;
    service.price = price;
    service.measure = measure;
    service.unit = measure === "length" ? "直呎" : "項";
    service.minQty = measure === "length" ? 3 : 0;
    service.increment = measure === "length" ? 0.5 : 0;
    service.minScope = "line";
    rows.push(service);
  });
  return rows;
}

function hydrateDemoCatalogServices(services: ServiceItem[]): void {
  const defaults = [
    ...createDemoCatalogServices(),
    ...createAdditionalCatalogServices(),
  ];
  defaults.forEach((defaultItem) => {
    const service = services.find((item) => item.id === defaultItem.id);
    if (!service) return;
    service.details ??= defaultItem.details;
    service.scope ??= defaultItem.scope;
    service.linkedServiceIds ??= [];
  });
}

function createDemoSuppliers(): Supplier[] {
  const rows: Array<{
    id: string;
    name: string;
    phone: string;
    contact: string;
    categories: string[];
    supply: string;
  }> = [
    { id: "supplier-onfai", name: "安輝傢俬廠", phone: "5645 7789", contact: "蘇生", categories: ["生態板傢俬"], supply: "生態板傢俬" },
    { id: "supplier-yat-tung", name: "逸東傢俬廠", phone: "6210 2220", contact: "阿良", categories: ["生態板傢俬"], supply: "生態板傢俬" },
    { id: "supplier-fung-shing", name: "豐盛木門廠", phone: "9825 6036", contact: "林小姐", categories: ["木門", "PD門"], supply: "木門, PD門, 鐵閘" },
    { id: "supplier-yan-tai", name: "鑫泰鋁材", phone: "6307 6183", contact: "張師傅", categories: ["PD門", "鋁窗", "鋁材", "浴屏"], supply: "PD門, 鋁窗, 鋁材, 浴屏" },
    { id: "supplier-on-tung", name: "安東戶外工程公司", phone: "6341 5090", contact: "權哥", categories: ["戶外板", "太陽能"], supply: "戶外木, 太陽能板" },
    { id: "supplier-fu-wah", name: "富華潔具家品", phone: "6767 0009", contact: "黎小姐", categories: ["座廁", "浴屏", "潔具", "PD門"], supply: "座廁, 浴屏, 潔具, PD門" },
    { id: "supplier-tai-chung-wa", name: "大中華鏡廠", phone: "6123 0388", contact: "陳總", categories: ["玻璃"], supply: "玻璃, 鏡" },
    { id: "supplier-kin-sang", name: "健生雲石廠", phone: "5487 9465", contact: "張小姐", categories: ["雲石", "石英石"], supply: "雲石, 吸咀, 石英石" },
  ];
  return rows.map((row) => ({
    ...row,
    hasProductStyles: true,
    active: true,
    createdAt: NOW,
  }));
}

function createMasterResources(): Resource[] {
  const rows: Array<{
    id: string;
    name: string;
    phone: string;
    kind: ResourceKind;
    specialty: string;
    mainWork: string;
    scope: string;
    feeMode: ResourceFeeMode;
    trades: string[];
  }> = [
    { id: "resource-master-danny", name: "黃日強 (Danny)", phone: "6686 6833", kind: "foreman", specialty: "工程判頭", mainWork: "判頭", scope: "打拆, 水喉, 電力, 泥水, 油漆", feeMode: "project60", trades: ["打拆", "水喉", "電力", "泥水", "油漆"] },
    { id: "resource-master-kam", name: "金城", phone: "6210 2220", kind: "foreman", specialty: "工程判頭", mainWork: "判頭", scope: "打拆, 水喉, 電力, 泥水, 油漆", feeMode: "project60", trades: ["打拆", "水喉", "電力", "泥水", "油漆"] },
    { id: "resource-master-lam", name: "林仔", phone: "9625 6036", kind: "worker", specialty: "油漆師傅", mainWork: "油漆", scope: "油漆", feeMode: "daily", trades: ["油漆"] },
    { id: "resource-master-kan", name: "阿勤", phone: "6300 6183", kind: "worker", specialty: "傢俬師傅", mainWork: "傢俬安裝", scope: "傢俬安裝", feeMode: "fixed", trades: ["傢俬"] },
    { id: "resource-master-ban", name: "阿斌", phone: "6111 5090", kind: "worker", specialty: "雜工師傅", mainWork: "雜工", scope: "執頭執尾", feeMode: "daily", trades: ["其他"] },
    { id: "resource-master-lai", name: "黎生", phone: "6708 0009", kind: "foreman", specialty: "打拆判頭", mainWork: "打拆", scope: "打拆, 清泥頭", feeMode: "project60", trades: ["打拆"] },
    { id: "resource-master-lau", name: "劉水姐", phone: "6335 0388", kind: "foreman", specialty: "打拆判頭", mainWork: "打拆", scope: "打拆, 清泥頭", feeMode: "project60", trades: ["打拆"] },
    { id: "resource-master-kwan", name: "阿軍", phone: "5487 9218", kind: "worker", specialty: "水電師傅", mainWork: "水電", scope: "水喉, 電工", feeMode: "daily", trades: ["水喉", "電力"] },
    { id: "resource-master-wah", name: "華哥", phone: "9019 6153", kind: "worker", specialty: "潔具師傅", mainWork: "潔具", scope: "座廁, 浴屏, 潔具, PD門", feeMode: "daily", trades: ["其他", "裝門"] },
    { id: "resource-master-shek", name: "石仔", phone: "4415 7386", kind: "worker", specialty: "潔具師傅", mainWork: "潔具", scope: "座廁, 潔具, PD門", feeMode: "daily", trades: ["其他", "裝門"] },
    { id: "resource-master-sam", name: "森仔", phone: "6633 2030", kind: "worker", specialty: "搭棚師傅", mainWork: "搭棚", scope: "搭棚", feeMode: "fixed", trades: ["其他"] },
    { id: "resource-master-ken", name: "Ken", phone: "9377 7063", kind: "worker", specialty: "煤氣師傅", mainWork: "煤氣", scope: "煤氣喉, 煤氣爐", feeMode: "fixed", trades: ["其他"] },
  ];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    type: row.kind === "foreman" ? "contractor" : "staff",
    trades: row.trades,
    active: true,
    kind: row.kind,
    specialty: row.specialty,
    mainWork: row.mainWork,
    scope: row.scope,
    details: "",
    feeMode: row.feeMode,
    feeAmount:
      row.feeMode === "daily" ? 1600 : row.feeMode === "fixed" ? 3000 : 0,
    createdAt: NOW,
  }));
}

/**
 * Demo-only data. Prices are representative examples, not a verified company price book.
 * It intentionally contains ordinary draft, submitted, ready-to-invoice, and issued sources.
 */
export function createSeedState(): AppState {
  const services: ServiceItem[] = [
    {
      id: "svc-demolition",
      code: "DEM",
      name: "打拆",
      category: "打拆",
      unit: "平方呎",
      price: 65,
      measure: "area",
      minQty: 20,
      minAmount: 0,
      increment: 0.5,
      minScope: "line",
      execution: "contractor",
      costMode: "ratio",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-plaster",
      code: "PLS",
      name: "批盪",
      category: "泥水",
      unit: "平方呎",
      price: 50,
      measure: "area",
      minQty: 40,
      minAmount: 0,
      increment: 0.5,
      minScope: "line",
      execution: "contractor",
      costMode: "ratio",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-waterproof",
      code: "WPF",
      name: "防水工程",
      category: "防水",
      unit: "項",
      price: 1950,
      measure: "fixed",
      minQty: 1,
      minAmount: 0,
      increment: 1,
      minScope: "line",
      execution: "contractor",
      costMode: "ratio",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-paint",
      code: "PNT",
      name: "油漆",
      category: "油漆",
      unit: "平方呎",
      price: 38,
      measure: "area",
      minQty: 150,
      minAmount: 0,
      increment: 0.5,
      minScope: "service",
      execution: "contractor",
      costMode: "ratio",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-pd-door",
      code: "PDD",
      name: "PD門",
      category: "門窗",
      unit: "套",
      price: 7000,
      measure: "quantity",
      minQty: 1,
      minAmount: 0,
      increment: 1,
      minScope: "line",
      execution: "self",
      costMode: "self",
      materialCost: 2000,
      labourCost: 1500,
      costBasis: "unit",
      options: ["白色", "銀色", "黑色"],
      allowPending: true,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-wood-door",
      code: "WDD",
      name: "木門",
      category: "門窗",
      unit: "套",
      price: 3800,
      measure: "quantity",
      minQty: 1,
      minAmount: 0,
      increment: 1,
      minScope: "line",
      execution: "self",
      costMode: "self",
      materialCost: 1800,
      labourCost: 800,
      costBasis: "unit",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-kitchen",
      code: "KIT",
      name: "廚房地櫃",
      category: "木工／櫥櫃",
      unit: "直呎",
      price: 1800,
      measure: "length",
      minQty: 3,
      minAmount: 0,
      increment: 0.1,
      minScope: "line",
      execution: "self",
      costMode: "self",
      materialCost: 5000,
      labourCost: 1500,
      costBasis: "line",
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
    {
      id: "svc-storage",
      code: "MOV",
      name: "搬運及存倉",
      category: "其他",
      unit: "項",
      price: 6000,
      measure: "fixed",
      minQty: 1,
      minAmount: 0,
      increment: 1,
      minScope: "line",
      execution: "service",
      costMode: "fixed",
      fixedCost: 5000,
      options: [],
      allowPending: false,
      notes: "Demo例值，未核天書。",
      published: true,
    },
  ];
  const actors: Actor[] = [
    {
      id: "sales-mm",
      name: "文文B MM",
      code: "MM",
      role: "sales",
      team: "B",
      grants: ["quote.write"],
    },
    {
      id: "sales-kk",
      name: "嘉嘉B KK",
      code: "KK",
      role: "sales",
      team: "B",
      grants: ["quote.write"],
    },
    {
      id: "head-don",
      name: "Don A DN（測試碼）",
      code: "DN",
      role: "head",
      team: "A",
      grants: ["quote.read"],
    },
    {
      id: "supervisor-sh",
      name: "世雄B SH",
      code: "SH",
      role: "supervisor",
      team: "B",
      grants: ["quote.read"],
    },
    {
      id: "supervisor-to",
      name: "圖B TO（測試碼）",
      code: "TO",
      role: "supervisor",
      team: "B",
      grants: ["quote.read"],
    },
    {
      id: "finance",
      name: "會計",
      code: "FN",
      role: "finance",
      grants: ["finance.read", "finance.validate", "handoff.read"],
    },
    {
      id: "clerk",
      name: "開單員",
      code: "CK",
      role: "clerk",
      grants: ["invoice.write", "handoff.read", "finance.read"],
    },
    {
      id: "cs",
      name: "工程CS",
      code: "CS",
      role: "cs",
      grants: ["handoff.read", "order.read", "assignment.write"],
    },
    ...DEMO_CS_ACTORS,
    {
      id: "admin",
      name: "SuperAdmin",
      code: "SA",
      role: "admin",
      grants: ["admin.all", "finance.read", "invoice.write"],
    },
  ];
  const resources: Resource[] = [
    ...createMasterResources(),
    {
      id: "resource-contractor",
      name: "Demo 判頭",
      phone: "90000001",
      type: "contractor",
      trades: ["打拆", "泥水", "油漆", "防水"],
      active: true,
    },
    {
      id: "resource-staff",
      name: "Demo 公司師傅",
      phone: "90000002",
      type: "staff",
      trades: ["門窗", "木工／櫥櫃"],
      active: true,
    },
    {
      id: "resource-service",
      name: "Demo 搬運服務",
      phone: "90000003",
      type: "service",
      trades: ["其他", "木工／櫥櫃"],
      active: true,
    },
  ];
  const signed = (
    id: string,
    index: number,
    owner: string,
    service: ServiceItem,
    amount: number,
    name: string,
  ): Quote => {
    const salesCode = owner === "sales-mm" ? "MM" : "KK";
    const quoteNumber = `QSH${salesCode}2610${String(index).padStart(4, "0")}`;
    const version: QuoteVersion = {
      id: `version-${id}`,
      index,
      customer: customer(
        `customer-${id}`,
        name,
        `91${String(index).padStart(6, "0")}`,
      ),
      lines: [
        quoteLine(
          `line-${id}`,
          service,
          service.measure === "quantity" ? { quantity: amount } : {},
        ),
      ],
      discount: 1,
      createdAt: NOW,
      signedDocument: attachment(`signed-${id}`, `${id}-signed.jpg`),
      signature: {
        date: "2026-10-20",
        supervisorId: "supervisor-sh",
        actorId: owner,
        createdAt: NOW,
      },
      printPreparation: {
        date: "2026-10-20",
        supervisorId: "supervisor-sh",
        actorId: owner,
        quoteNumber,
        createdAt: NOW,
        legacy: true,
      },
      signedDocumentQuoteNumber: quoteNumber,
    };
    return {
      id,
      number: quoteNumber,
      ownerId: owner,
      team: "B",
      versions: [version],
      createdAt: NOW,
      updatedAt: NOW,
      archived: false,
    };
  };
  services.forEach((service) => {
    service.archived = true;
  });
  services.push(...createDemoCatalogServices());
  services.push(...createAdditionalCatalogServices());
  const draft1: Quote = {
    id: "quote-draft-1",
    number: "QMM26100001",
    ownerId: "sales-mm",
    team: "B",
    versions: [
      {
        id: "version-draft-1",
        index: 1,
        customer: { ...EMPTY_CUSTOMER },
        lines: [],
        discount: 1,
        createdAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
  };
  const draft2: Quote = {
    id: "quote-draft-2",
    number: "QMM26100002",
    ownerId: "sales-mm",
    team: "B",
    versions: [
      {
        id: "version-draft-2",
        index: 1,
        customer: customer("customer-draft-2", "陳小強", "91230002"),
        lines: [quoteLine("line-draft-2", services[0])],
        discount: 1,
        createdAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
  };
  const draft3: Quote = {
    id: "quote-draft-3",
    number: "QKK26100003",
    ownerId: "sales-kk",
    team: "B",
    versions: [
      {
        id: "version-draft-3",
        index: 1,
        customer: customer("customer-draft-3", "太大力", "91230003"),
        lines: [quoteLine("line-draft-3", services[6])],
        discount: 0.94,
        createdAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
  };
  const pending = signed(
    "quote-pending-office",
    4,
    "sales-mm",
    services[4],
    1,
    "李好波",
  );
  pending.submission = {
    id: "submission-pending",
    versionId: "version-quote-pending-office",
    actorId: "sales-mm",
    createdAt: NOW,
  };
  const ready = signed(
    "quote-ready-invoice",
    5,
    "sales-kk",
    services[4],
    2,
    "王小虎",
  );
  ready.submission = {
    id: "submission-ready",
    versionId: "version-quote-ready-invoice",
    actorId: "sales-kk",
    createdAt: NOW,
  };
  ready.officeCategory = "grant-80k";
  const issued = signed(
    "quote-issued",
    6,
    "sales-mm",
    services[5],
    1,
    "張子微",
  );
  issued.submission = {
    id: "submission-issued",
    versionId: "version-quote-issued",
    actorId: "sales-mm",
    createdAt: NOW,
  };
  issued.invoiceId = "invoice-issued";
  issued.officeCategory = "self-pay";
  const invoice: Invoice = {
    id: "invoice-issued",
    number: "SHMM26100001",
    quoteId: issued.id,
    versionId: "version-quote-issued",
    customer: deepCopy(currentVersion(issued).customer),
    lines: deepCopy(currentVersion(issued).lines),
    discount: 1,
    netTotal: 3800,
    createdAt: NOW,
    actorId: "clerk",
    supervisorId: "supervisor-sh",
    category: "self-pay",
    paymentPlan: [
      {
        installment: 1,
        label: "第一期訂金",
        percentage: 30,
        amount: 1140,
        cumulativeAmount: 1140,
      },
      {
        installment: 2,
        label: "第二期訂金",
        percentage: 20,
        amount: 760,
        cumulativeAmount: 1900,
      },
      {
        installment: 3,
        label: "工程中期款",
        percentage: 30,
        amount: 1140,
        cumulativeAmount: 3040,
      },
      {
        installment: 4,
        label: "尾數",
        percentage: 20,
        amount: 760,
        cumulativeAmount: 3800,
      },
    ],
  };
  invoice.calculation = frozen(
    calculatePricing(invoice.lines, invoice.discount, services, true),
  );
  const order: WorkOrder = {
    id: "workorder-issued",
    number: "D2600001",
    quoteId: issued.id,
    invoiceId: invoice.id,
    groupId: "group-quote-issued",
    versionId: invoice.versionId,
    customer: deepCopy(invoice.customer),
    lines: deepCopy(invoice.lines),
    createdAt: NOW,
    startDate: "2026-11-01",
    endDate: "2027-02-01",
    status: "pending",
    csReleasedAt: NOW,
    dateChanges: [],
  };
  const payments: Payment[] = [
    {
      id: "payment-pending-1500",
      quoteId: pending.id,
      versionId: "version-quote-pending-office",
      amount: 1500,
      method: "cash",
      date: "2026-10-20",
      custody: "sales",
      reference: "Demo-1500",
      notes: "Demo誠意金",
      status: "pending",
      createdAt: NOW,
      actorId: "sales-mm",
    },
    {
      id: "payment-ready-1",
      quoteId: ready.id,
      versionId: "version-quote-ready-invoice",
      amount: 4200,
      method: "transfer",
      date: "2026-10-21",
      custody: "company",
      reference: "Demo-ready",
      notes: "Demo已核足首期",
      status: "valid",
      validatedBy: "finance",
      validDate: "2026-10-21",
      cleared: true,
      createdAt: NOW,
      actorId: "sales-kk",
    },
    {
      id: "payment-issued-1",
      quoteId: issued.id,
      versionId: "version-quote-issued",
      invoiceId: invoice.id,
      installment: 1,
      amount: 1140,
      method: "fps",
      date: "2026-10-20",
      custody: "company",
      reference: "Demo-issued",
      notes: "Demo已核足首期",
      status: "valid",
      validatedBy: "finance",
      validDate: "2026-10-20",
      cleared: true,
      createdAt: NOW,
      actorId: "sales-mm",
    },
    {
      id: "payment-issued-2",
      quoteId: issued.id,
      versionId: "version-quote-issued",
      invoiceId: invoice.id,
      installment: 2,
      amount: 760,
      method: "fps",
      date: "2026-10-20",
      custody: "company",
      reference: "Demo-issued-2",
      notes: "Demo第二期已核足",
      status: "valid",
      validatedBy: "finance",
      validDate: "2026-10-20",
      cleared: true,
      createdAt: NOW,
      actorId: "clerk",
    },
  ];
  const seed: AppState = {
    schema: 1,
    actors,
    customers: [],
    services,
    serviceCategories: [...DEFAULT_SERVICE_CATEGORIES],
    quotes: [draft1, draft2, draft3, pending, ready, issued],
    payments,
    invoices: [invoice],
    receipts: [],
    orders: [order],
    assignments: [],
    extraWorks: [],
    resources,
    suppliers: createDemoSuppliers(),
    productStyles: [],
    municipalOrders: [],
    audits: [
      {
        id: "audit-seed-issued",
        quoteId: issued.id,
        workOrderId: order.id,
        actorId: "clerk",
        action: "invoice_issued",
        detail: "Demo seed 正式主鏈記錄",
        at: NOW,
      },
    ],
    notifications: [],
    monthlySequences: { "2026-10": 1 },
    quoteSequences: { "2026-10": 6 },
    receiptSequences: {},
    workOrderSequences: { "26": 1 },
    demoEngineeringVersion: 2,
  };
  appendDemoEngineeringOrders(seed);
  hydrateCustomerProfiles(seed);
  return seed;
}

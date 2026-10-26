import { describe, expect, it } from "vitest";
import type {
  Actor,
  Attachment,
  Customer,
  DraftInput,
  QuoteLine,
  ServiceItem,
} from "../src/domain/types";
import { Engine, createSeedState } from "../src/domain/engine";

class MemoryStorage implements Storage {
  private readonly rows = new Map<string, string>();
  get length(): number {
    return this.rows.size;
  }
  clear(): void {
    this.rows.clear();
  }
  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.rows.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.rows.delete(key);
  }
  setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }
}

const signedFile: Attachment = {
  id: "file-signed-golden",
  name: "golden-signed.jpg",
  mime: "image/jpeg",
  size: 1024,
  createdAt: "2026-10-22T12:00:00+08:00",
};
const paymentProof: Attachment = {
  id: "proof-golden",
  name: "bank-proof.jpg",
  mime: "image/jpeg",
  size: 512,
  createdAt: "2026-10-22T12:00:00+08:00",
};

function actor(engine: Engine, id: string): Actor {
  const found = engine.listActors().find((item) => item.id === id);
  if (!found) throw new Error(`missing actor ${id}`);
  return found;
}
function fullCustomer(phone = "91234567"): Customer {
  return {
    id: "",
    name: "測試 Demo 客戶",
    phone,
    whatsapp: phone,
    email: "",
    idName: "測試 Demo 客戶",
    idNumber: "DEMO-TEST-01",
    source: "Demo 介紹",
    isElderly: "no",
    notes: "無",
    emergencyName: "測試聯絡人",
    emergencyPhone: "92345678",
    district: "九龍",
    street: "測試街",
    estate: "Demo 花園",
    block: "1座",
    floor: "12樓",
    unit: "A室",
    address: "九龍 測試街 Demo 花園 1座 12樓 A室",
    ownerName: "測試 Demo 客戶",
    managementPhone: "",
    parking: "",
    precautions: "無",
    attachment: {
      id: "customer-doc-golden",
      name: "customer-id-demo.jpg",
      mime: "image/jpeg",
      size: 321,
    },
  };
}
function line(
  service: ServiceItem,
  values: Partial<QuoteLine> = {},
): QuoteLine {
  return {
    id: "",
    itemId: service.id,
    itemSnapshot: service,
    position: "客廳",
    length: 0,
    width: 0,
    dimensionUnit: "呎",
    quantity: 1,
    style: service.options[0] ?? "",
    notes: "測試工程",
    ...values,
  };
}
function draft(service: ServiceItem, phone?: string): DraftInput {
  return { customer: fullCustomer(phone), lines: [line(service)], discount: 1 };
}

describe("Engine Golden Path（同一來源跨角色）", () => {
  it("以正式 actions 完成簽署、1500＋48500 首期、Office、核款、唯一 Invoice、工程安排與刷新", () => {
    const storage = new MemoryStorage();
    const engine = new Engine(storage, createSeedState());
    const sales = actor(engine, "sales-mm");
    const finance = actor(engine, "finance");
    const clerk = actor(engine, "clerk");
    const cs = actor(engine, "cs");
    const admin = actor(engine, "admin");
    const pd = engine
      .listServices(admin)
      .find((item) => item.id === "svc-pd-door")!;
    // A controlled catalog price makes this new source exactly $100,000, so its first due is $50,000.
    engine.saveService(admin, {
      ...pd,
      id: "svc-test-100k",
      code: "T100",
      name: "測試十萬元工程",
      price: 100000,
      published: true,
    });
    const hundredK = engine
      .listServices(admin)
      .find((item) => item.id === "svc-test-100k")!;
    const quote = engine.saveDraft(
      sales,
      undefined,
      draft(hundredK, "91239991"),
    );
    const versionId = quote.versions.at(-1)!.id;

    expect(() =>
      engine.recordSignature(sales, quote.id, {
        date: "2026-10-20",
        supervisorId: "supervisor-sh",
        confirmed: true,
      }),
    ).toThrow("先上載");
    const prepared = engine.prepareQuoteForPrint(sales, quote.id, {
      date: "2026-10-20",
      supervisorId: "supervisor-sh",
    });
    expect(prepared.number).toMatch(/^QSHMM2610\d{4}$/);
    expect(prepared.versions.at(-1)!.printPreparation?.quoteNumber).toBe(
      prepared.number,
    );
    engine.uploadDocument(sales, quote.id, signedFile);
    expect(() => engine.submitOffice(sales, quote.id)).toThrow("確認客戶簽署");
    engine.recordSignature(sales, quote.id, {
      date: "2026-10-20",
      supervisorId: "supervisor-sh",
      confirmed: true,
    });
    const custody = engine.recordPayment(sales, quote.id, {
      amount: 1500,
      method: "cash",
      date: "2026-10-20",
      custody: "sales",
      reference: "DEMO-1500",
      notes: "誠意金",
    });
    engine.submitOffice(sales, quote.id);
    engine.submitOffice(sales, quote.id); // idempotent: no second handoff or notification batch
    expect(
      engine.listHandoffs(cs).filter((row) => row.quoteId === quote.id),
    ).toHaveLength(0);
    expect(engine.getQuote(sales, quote.id).versions.at(-1)!.id).toBe(
      versionId,
    );

    engine.validatePayment(finance, custody.id, {
      date: "2026-10-21",
      cleared: true,
    });
    expect(() => engine.issueInvoice(clerk, quote.id)).toThrow("請先選擇");
    engine.setOfficeCategory(clerk, quote.id, "self-pay");
    const partialInvoice = engine.issueInvoice(clerk, quote.id);
    expect(partialInvoice.category).toBe("self-pay");
    const firstBalance = engine.recordInstallmentPayment(clerk, partialInvoice.id, 1, {
      amount: 28500,
      method: "transfer",
      date: "2026-10-21",
      custody: "company",
      reference: "DEMO-48500",
      notes: "銀行款",
      proof: paymentProof,
      cleared: false,
    });
    engine.validatePayment(clerk, firstBalance.id, {
      date: "2026-10-21",
      cleared: true,
    });
    const invoice = engine.issueInvoice(clerk, quote.id);
    expect(invoice.quoteId).toBe(quote.id);
    expect(invoice.versionId).toBe(versionId);
    expect(invoice.category).toBe("self-pay");
    expect(engine.issueInvoice(clerk, quote.id).id).toBe(invoice.id);
    expect(
      engine.listInvoices(clerk).filter((row) => row.quoteId === quote.id),
    ).toHaveLength(1);
    const receipt = engine.issueReceipt(clerk, custody.id);
    expect(receipt.amount).toBe(1500);
    expect(engine.issueReceipt(clerk, custody.id).id).toBe(receipt.id);
    expect(engine.issueReceipt(clerk, firstBalance.id).amount).toBe(28500);
    expect(
      engine.listOrders(cs).filter((row) => row.quoteId === quote.id),
    ).toHaveLength(0);
    const second = engine.recordInstallmentPayment(clerk, invoice.id, 2, {
      amount: 20000,
      method: "fps",
      date: "2026-10-21",
      custody: "company",
      reference: "DEMO-SECOND-20000",
      notes: "第二期",
      proof: paymentProof,
      cleared: false,
    });
    engine.validatePayment(clerk, second.id, {
      date: "2026-10-21",
      cleared: true,
    });
    expect(engine.issueReceipt(clerk, second.id).amount).toBe(20000);
    const order = engine
      .listOrders(cs)
      .find((row) => row.quoteId === quote.id)!;
    expect(order.invoiceId).toBe(invoice.id);
    expect(order.startDate).toBe("2026-11-01");
    expect(order.endDate).toBe("2027-02-01");
    const assignment = engine.assign(cs, order.id, {
      resourceId: "resource-staff",
      lineIds: [order.lines[0].id],
      date: "2026-11-02",
      time: "10:00",
      notes: "Demo 排工",
    });
    expect(assignment.workOrderId).toBe(order.id);
    expect(engine.getOrder(cs, order.id).status).toBe("arranged");
    const earned = engine
      .performance(sales, "2026-10")
      .entries.find((entry) => entry.quoteId === quote.id)!;
    expect(earned.date).toBe("2026-10-21"); // first valid-payment threshold date, not Invoice date.
    expect(earned.commission).toBe(8000);

    const reloaded = new Engine(storage);
    expect(reloaded.getInvoice(clerk, invoice.id).quoteId).toBe(quote.id);
    expect(reloaded.listAssignments(cs, order.id)).toHaveLength(1);
  });
});

describe("Engine 安全投影、負面資格與計價", () => {
  it("8萬資助按30／20／50收款：30%可開單、50%才唯一發工程部及逐筆收據", () => {
    const engine = new Engine(undefined, createSeedState());
    const clerk = actor(engine, "clerk");
    const cs = actor(engine, "cs");
    const invoice = engine.issueInvoice(clerk, "quote-ready-invoice");
    const initial = engine
      .listPayments(clerk)
      .find((payment) => payment.id === "payment-ready-1")!;
    expect(invoice.category).toBe("grant-80k");
    expect(engine.invoicePaymentStatus(clerk, invoice.id).openingDue).toBe(
      4200,
    );
    expect(
      engine.listOrders(cs).some((row) => row.invoiceId === invoice.id),
    ).toBe(false);
    expect(() => engine.getInvoice(cs, invoice.id)).toThrow("沒有查看");
    expect(engine.issueReceipt(clerk, initial.id).amount).toBe(4200);
    const second = engine.recordInstallmentPayment(clerk, invoice.id, 2, {
      amount: 2800,
      method: "fps",
      date: "2026-10-22",
      custody: "company",
      reference: "GRANT-SECOND",
      notes: "第二期",
      cleared: false,
    });
    expect(() => engine.issueReceipt(clerk, second.id)).toThrow("已核對有效");
    engine.validatePayment(clerk, second.id, {
      date: "2026-10-22",
      cleared: true,
    });
    const status = engine.invoicePaymentStatus(clerk, invoice.id);
    expect(status.releasedToCS).toBe(true);
    expect(
      engine.listOrders(cs).filter((row) => row.invoiceId === invoice.id),
    ).toHaveLength(1);
    expect(engine.getInvoice(cs, invoice.id).id).toBe(invoice.id);
    engine.validatePayment(clerk, second.id, {
      date: "2026-10-22",
      cleared: true,
    });
    expect(
      engine.listOrders(cs).filter((row) => row.invoiceId === invoice.id),
    ).toHaveLength(1);
    const receipt = engine.issueReceipt(clerk, second.id);
    expect(receipt.amount).toBe(2800);
    expect(engine.issueReceipt(clerk, second.id).id).toBe(receipt.id);
  });

  it("客戶可獨立建立並重用；三項Sales補充資料選填，封存後不可再處理", () => {
    const engine = new Engine(undefined, createSeedState());
    const sales = actor(engine, "sales-mm");
    const otherSales = actor(engine, "sales-kk");
    const admin = actor(engine, "admin");
    const waterproof = engine
      .listServices(admin)
      .find((item) => item.id === "svc-waterproof")!;
    const standalone = fullCustomer("91236661");
    standalone.notes = "";
    standalone.precautions = "";
    delete standalone.attachment;
    const profile = engine.createCustomer(sales, standalone);
    expect(profile.customer.address).toBe("九龍 測試街 Demo 花園 1座 12樓 A室");
    expect(
      engine.listCustomers(sales).some((item) => item.id === profile.id),
    ).toBe(true);
    expect(
      engine.listCustomers(otherSales).some((item) => item.id === profile.id),
    ).toBe(false);
    expect(() => engine.createCustomer(otherSales, standalone)).toThrow(
      "已有客戶主檔",
    );
    const quote = engine.saveDraft(sales, undefined, {
      customer: { ...standalone, id: profile.id },
      lines: [line(waterproof)],
      discount: 1,
    });
    expect(quote.versions[0].customer.id).toBe(profile.id);
    const originalId = engine.getCustomer(sales, profile.id).idNumber;
    const supervisor = actor(engine, "supervisor-sh");
    expect(engine.getCustomer(supervisor, profile.id).idNumber).toBe(
      `${originalId.slice(0, 1)}***${originalId.slice(-2)}`,
    );
    const changedPhone = {
      ...engine.getCustomer(sales, profile.id),
      phone: "91236662",
      whatsapp: "91236662",
    };
    const edited = engine.saveDraft(sales, quote.id, {
      customer: changedPhone,
      lines: [line(waterproof)],
      discount: 1,
    });
    expect(edited.versions.at(-1)?.customer.id).toBe(profile.id);
    expect(
      engine.listCustomers(sales).filter((p) => p.id === profile.id),
    ).toHaveLength(1);
    expect(engine.getCustomer(sales, profile.id).idNumber).toBe(originalId);
    expect(() =>
      engine.saveDraft(sales, undefined, {
        customer: { ...standalone, id: "unknown-profile" },
        lines: [line(waterproof)],
        discount: 1,
      }),
    ).toThrow("客戶主檔已不存在");
    engine.archiveQuote(sales, quote.id, {
      reason: "customer_rejected",
      note: "客戶暫不接受",
    });
    expect(engine.eligibility(sales, quote.id).stage).toBe("archived");
    expect(() =>
      engine.saveDraft(sales, quote.id, {
        customer: standalone,
        lines: [line(waterproof)],
        discount: 1,
      }),
    ).toThrow("已封存");
    expect(() =>
      engine.recordPayment(sales, quote.id, {
        amount: 1,
        method: "cash",
        date: "2026-10-20",
        custody: "sales",
        reference: "",
        notes: "",
      }),
    ).toThrow("已封存");
  });
  it("不把成本、證件、銀行證明或原報價洩露到錯誤角色", () => {
    const engine = new Engine(undefined, createSeedState());
    const sales = actor(engine, "sales-mm");
    const otherSales = actor(engine, "sales-kk");
    const cs = actor(engine, "cs");
    const clerk = actor(engine, "clerk");
    const admin = actor(engine, "admin");
    const service = engine
      .listServices(sales)
      .find((item) => item.id === "svc-pd-door")!;
    expect(Object.hasOwn(service, "materialCost")).toBe(false);
    expect(Object.hasOwn(service, "costMode")).toBe(false);
    const q = engine.getQuote(sales, "quote-pending-office");
    expect(q.versions[0].customer.idNumber).not.toBe(
      "DEMO-CUSTOMER-QUOTE-PENDING-OFFICE",
    );
    expect(
      Object.hasOwn(q.versions[0].lines[0].itemSnapshot, "materialCost"),
    ).toBe(false);
    expect(() => engine.getQuote(cs, q.id)).toThrow("工程CS不可讀取原報價");
    expect(() => engine.getQuote(otherSales, q.id)).toThrow("你沒有查看此報價");
    const clerkPayment = engine
      .listPayments(clerk)
      .find((row) => row.id === "payment-ready-1")!;
    // 開單員已合併會計核款功能，需讀付款證明及交易參考；成本及原報價仍隔離。
    expect(Object.hasOwn(clerkPayment, "reference")).toBe(true);
    expect(
      engine
        .listHandoffs(cs)
        .some((row) => Object.hasOwn(row as object, "idNumber")),
    ).toBe(false);
    expect(
      engine.listServices(admin).find((item) => item.id === "svc-pd-door")!
        .materialCost,
    ).toBe(2000);
  });

  it("阻止未簽、未有有效收款及未兌現支票，並限制跨 Sales 客戶重複", () => {
    const engine = new Engine(undefined, createSeedState());
    const sales = actor(engine, "sales-mm");
    const otherSales = actor(engine, "sales-kk");
    const finance = actor(engine, "finance");
    const clerk = actor(engine, "clerk");
    const supervisor = actor(engine, "supervisor-sh");
    const admin = actor(engine, "admin");
    const water = engine
      .listServices(admin)
      .find((item) => item.id === "svc-waterproof")!;
    const q = engine.saveDraft(sales, undefined, draft(water, "91238881"));
    expect(() =>
      engine.recordSignature(sales, q.id, {
        date: "2026-10-20",
        supervisorId: supervisor.id,
        confirmed: true,
      }),
    ).toThrow("請先上載");
    engine.prepareQuoteForPrint(sales, q.id, {
      date: "2026-10-20",
      supervisorId: supervisor.id,
    });
    engine.uploadDocument(sales, q.id, signedFile);
    expect(() =>
      engine.recordSignature(sales, q.id, {
        date: "2026-10-20",
        supervisorId: supervisor.id,
        confirmed: false,
      }),
    ).toThrow("明確確認");
    engine.recordSignature(sales, q.id, {
      date: "2026-10-20",
      supervisorId: supervisor.id,
      confirmed: true,
    });
    const cheque = engine.recordPayment(sales, q.id, {
      amount: 975,
      method: "cheque",
      date: "2026-10-20",
      custody: "company",
      reference: "CQ-1",
      notes: "",
    });
    engine.submitOffice(sales, q.id);
    expect(() =>
      engine.validatePayment(finance, cheque.id, {
        date: "2026-10-21",
        cleared: false,
      }),
    ).toThrow("支票未兌現");
    expect(() => engine.issueInvoice(clerk, q.id)).toThrow("請先選擇");
    engine.setOfficeCategory(clerk, q.id, "grant-80k");
    expect(() => engine.issueInvoice(clerk, q.id)).toThrow("至少一筆有效收款");
    expect(() =>
      engine.saveDraft(otherSales, undefined, draft(water, "91238881")),
    ).toThrow("其他 Sales 建立");
  });

  it("按寸轉呎及 service 最低量計價，折扣後以分位最大餘數守恆並以低折扣佣金率計算", () => {
    const engine = new Engine(undefined, createSeedState());
    const admin = actor(engine, "admin");
    const sales = actor(engine, "sales-mm");
    const demo = engine.listServices(admin);
    const demolition = demo.find((item) => item.id === "svc-demolition")!;
    const paint = demo.find((item) => item.id === "svc-paint")!;
    const price = engine.preview(
      admin,
      [
        line(demolition, {
          id: "dem-inch",
          length: 15,
          width: 96,
          dimensionUnit: "寸",
          quantity: 0,
        }),
        line(paint, {
          id: "paint-a",
          length: 5,
          width: 10,
          dimensionUnit: "呎",
          quantity: 0,
        }),
        line(paint, {
          id: "paint-b",
          length: 5,
          width: 10,
          dimensionUnit: "呎",
          quantity: 0,
        }),
      ],
      0.94,
    );
    expect(
      price.lineAmounts.find((item) => item.id === "dem-inch")!.rawQty,
    ).toBe(10);
    expect(
      price.lineAmounts.find((item) => item.id === "dem-inch")!.billedQty,
    ).toBe(20);
    expect(price.subtotal).toBe(7000); // $1,300 demolition minimum + $5,700 paint service minimum.
    expect(price.total).toBe(6580);
    expect(price.lineAmounts.reduce((sum, item) => sum + item.amount, 0)).toBe(
      price.total,
    );
    expect(price.commission).toBe(592.2); // d < .95: 9%, not 12%.
    const salesProjection = engine.preview(
      sales,
      [line(demolition, { id: "sales-raw", length: 1, width: 1, quantity: 0 })],
      1,
    );
    expect(salesProjection.cost).toBeUndefined();
    expect(salesProjection.commission).toBeUndefined();
    expect(salesProjection.lineAmounts[0].billedQty).toBe(20);
  });
});

describe("Sales 客戶表單簡化", () => {
  it("只要求核心聯絡及地址欄位；街道、座數及身份／緊急資料可留空", () => {
    const engine = new Engine(undefined, createSeedState());
    const sales = actor(engine, "sales-mm");
    const minimal = fullCustomer("91237777");
    minimal.street = "";
    minimal.block = "";
    minimal.idName = "";
    minimal.idNumber = "";
    minimal.source = "";
    minimal.isElderly = "";
    minimal.emergencyName = "";
    minimal.emergencyPhone = "";
    minimal.ownerName = "";
    const profile = engine.createCustomer(sales, minimal);
    expect(profile.customer.name).toBe("測試 Demo 客戶");
    expect(profile.customer.address).toBe("九龍 Demo 花園 12樓 A室");
    expect(() =>
      engine.createCustomer(sales, {
        ...minimal,
        name: "另一位客戶",
        phone: "91237778",
        whatsapp: "91237778",
        district: "",
      }),
    ).toThrow("地區");
  });
});

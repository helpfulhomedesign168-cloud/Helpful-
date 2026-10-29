import { it, expect } from "vitest";
import { Engine, createSeedState } from "../src/domain/engine";
const actor = (e: Engine, id: string) =>
  e.listActors().find((a) => a.id === id)!;
it("CS可讀Invoice而不可讀原Q；已簽價及期款不被Admin加價反改", () => {
  const e = new Engine(undefined, createSeedState()),
    admin = actor(e, "admin"),
    cs = actor(e, "cs"),
    csLead = actor(e, "cs-lead-ahfa"),
    sales = actor(e, "sales-mm"),
    clerk = actor(e, "clerk");
  const old = e.pricing(sales, "quote-pending-office");
  const pd = e.listServices(admin).find((s) => s.id === "svc-pd-door")!;
  e.saveService(admin, { ...pd, price: 50000, materialCost: 24000 });
  expect(e.pricing(sales, "quote-pending-office").total).toBe(old.total);
  expect(e.eligibility(cs, "quote-pending-office").firstDue).toBe(0);
  expect(e.eligibility(cs, "quote-pending-office").label).toBe("待分類");
  expect(e.invoicePricing(csLead, "invoice-issued").total).toBe(3800);
  expect(() => e.invoicePricing(cs, "invoice-issued")).toThrow("沒有查看");
  expect(() => e.pricing(csLead, "quote-issued")).toThrow();
  const invoice = e.issueInvoice(clerk, "quote-ready-invoice");
  expect(invoice.netTotal).toBe(14000);
  expect(invoice.number).toBe("SHKK26100002");
  expect(() =>
    e.uploadDocument(sales, "quote-pending-office", {
      id: "new",
      name: "bad.pdf",
    }),
  ).toThrow("不可覆改");
  expect(() =>
    e.recordSignature(sales, "quote-pending-office", {
      date: "2026-10-21",
      supervisorId: "supervisor-sh",
      confirmed: true,
    }),
  ).toThrow("不可覆改");
});
it("Don保留Team B基本佣金但Team B業績不計入Team A Bonus", () => {
  const e = new Engine(undefined, createSeedState());
  const p = e.performance(actor(e, "head-don"), "2026-10");
  expect(p.commission).toBeGreaterThan(0);
  expect(p.sales).toBe(0);
  expect(p.bonus).toBe(0);
});
it("儲存容量不足不能假稱已保存；損壞資料需明確重設", () => {
  const seed = createSeedState();
  let raw = JSON.stringify(seed);
  let fail = false;
  const storage = {
    getItem: () => raw,
    setItem: (_k: string, v: string) => {
      if (fail) throw new Error("quota");
      raw = v;
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 1,
  } as Storage;
  const e = new Engine(storage);
  const admin = actor(e, "admin"),
    s = e.listServices(admin)[0];
  fail = true;
  expect(() => e.saveService(admin, { ...s, name: "不可保存" })).toThrow(
    "沒有保存",
  );
  expect(e.listServices(admin)[0].name).toBe(s.name);
  fail = false;
  raw = "{";
  const broken = new Engine(storage);
  expect(broken.storageWarning).toContain("不能讀取");
  expect(() => broken.saveService(actor(broken, "admin"), s)).toThrow(
    "不能讀取",
  );
  expect(raw).toBe("{");
  broken.reset();
  expect(broken.storageWarning).toBe("");
  expect(JSON.parse(raw).schema).toBe(1);
});

it("未來有效日期不可提前放行；所有已輸入師傅均可分派", () => {
  const seed = createSeedState();
  seed.resources.push({
    id: "wrong-trade",
    name: "只做電力判頭",
    phone: "90000010",
    type: "contractor",
    trades: ["電力"],
    active: true,
  });
  const e = new Engine(undefined, seed),
    finance = actor(e, "finance"),
    sales = actor(e, "sales-mm"),
    csLead = actor(e, "cs-lead-ahfa");
  expect(() =>
    e.validatePayment(finance, "payment-pending-1500", {
      date: "2026-11-01",
      cleared: true,
    }),
  ).toThrow("不可晚於");
  expect(() =>
    e.recordPayment(sales, "quote-pending-office", {
      amount: 1,
      method: "cash",
      date: "2026-11-01",
      custody: "sales",
    }),
  ).toThrow("已發生");
  const order = e.getOrder(csLead, "workorder-issued");
  const assignment = e.assign(csLead, order.id, {
    resourceId: "wrong-trade",
    lineIds: [order.lines[0].id],
    date: "2026-11-01",
    time: "上午",
    notes: "",
  });
  expect(assignment.resourceId).toBe("wrong-trade");
});

it("自訂扣減保存金額與模式，並由正式列印鎖定主管及報價號", () => {
  const e = new Engine(undefined, createSeedState()),
    sales = actor(e, "sales-mm"),
    admin = actor(e, "admin"),
    finance = actor(e, "finance"),
    clerk = actor(e, "clerk");
  const water = e.listServices(admin).find((x) => x.id === "svc-waterproof")!;
  const c = {
    ...createSeedState().quotes[1].versions[0].customer,
    phone: "91235555",
    whatsapp: "91235555",
    street: "測試街",
    district: "黃大仙",
    estate: "測試苑",
    block: "2座",
    floor: "3樓",
    unit: "C室",
    address: "亂填也會被覆蓋",
  };
  const q = e.saveDraft(sales, undefined, {
    customer: c,
    lines: [
      {
        id: "",
        itemId: water.id,
        itemSnapshot: water,
        position: "廁所",
        length: 0,
        width: 0,
        dimensionUnit: "呎",
        quantity: 1,
        style: "",
        notes: "無",
      },
    ],
    discount: 1,
    discountMode: "amount",
    discountValue: 500,
  });
  const v = q.versions[0];
  expect(v.discountMode).toBe("amount");
  expect(v.discountValue).toBe(500);
  expect(e.pricing(sales, q.id).total).toBe(1450);
  expect(e.getQuote(sales, q.id).versions[0].customer.address).toBe(
    "黃大仙 測試街 測試苑 2座 3樓 C室",
  );
  const ready = e.prepareQuoteForPrint(sales, q.id, {
    date: "2026-10-22",
    supervisorId: "supervisor-sh",
  });
  expect(ready.number).toMatch(/^QSHMM2610\d{4}$/);
  expect(() =>
    e.prepareQuoteForPrint(sales, q.id, {
      date: "2026-10-22",
      supervisorId: "supervisor-to",
    }),
  ).toThrow("已生成正式報價號");
  e.uploadDocument(sales, q.id, {
    id: "signed-amount-discount",
    name: "amount-discount-signed.jpg",
    mime: "image/jpeg",
    size: 1,
    createdAt: "2026-10-22T12:00:00+08:00",
  });
  e.recordSignature(sales, q.id, {
    date: "2026-10-22",
    supervisorId: "supervisor-sh",
    confirmed: true,
  });
  const payment = e.recordPayment(sales, q.id, {
    amount: 725,
    method: "cash",
    date: "2026-10-22",
    custody: "sales",
    reference: "AMOUNT-725",
    notes: "",
  });
  e.submitOffice(sales, q.id);
  e.validatePayment(finance, payment.id, {
    date: "2026-10-22",
    cleared: true,
  });
  e.setOfficeCategory(clerk, q.id, "self-pay");
  const invoice = e.issueInvoice(clerk, q.id);
  expect(invoice.discountMode).toBe("amount");
  expect(invoice.discountValue).toBe(500);
});

it("舊Demo儲存資料會重組地址並回建Q號及Invoice月流水", () => {
  const state = createSeedState() as any;
  delete state.quoteSequences;
  delete state.monthlySequences;
  delete state.quotes[0].versions[0].customer.street;
  state.quotes[0].versions[0].customer.address = "舊手填地址";
  let raw = JSON.stringify(state);
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 1,
  } as Storage;
  const e = new Engine(storage);
  expect(e.getState().quoteSequences["2026-10"]).toBeGreaterThanOrEqual(6);
  expect(e.getState().monthlySequences["2026-10"]).toBeGreaterThanOrEqual(1);
  expect(e.getState().quotes[0].versions[0].customer.address).not.toBe(
    "舊手填地址",
  );
});

it("提交報價首訂金額由分類計劃派生，付款證明 metadata 返回同一筆付款", () => {
  const e = new Engine(undefined, createSeedState());
  const clerk = actor(e, "clerk");
  const sales = actor(e, "sales-kk");
  const ready = e.eligibility(clerk, "quote-ready-invoice");
  expect(ready.officeCategory).toBe("grant-80k");
  expect(ready.firstDue).toBe(4200);
  const unclassified = e.eligibility(clerk, "quote-pending-office");
  expect(unclassified.officeCategory).toBeUndefined();
  expect(unclassified.firstDue).toBe(0);
  const payment = e.recordPayment(sales, "quote-ready-invoice", {
    amount: 100,
    method: "fps",
    date: "2026-10-22",
    custody: "company",
    reference: "SUBMISSION-PROOF",
    notes: "提交報價頁示意",
    proof: {
      id: "proof-submission-thumb",
      name: "首訂證明.png",
      mime: "image/png",
      size: 512,
      createdAt: "2026-10-22T12:00:00+08:00",
    },
  });
  expect(payment.proof?.id).toBe("proof-submission-thumb");
  expect(
    e.listPayments(clerk).find((row) => row.id === payment.id)?.proof?.name,
  ).toBe("首訂證明.png");
});

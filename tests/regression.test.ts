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
  expect(invoice.number).toBe("SHKK26100002A");
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

it("CS可讀取工程單所屬報價版本的line金額，供6成師傅費計算", () => {
  const e = new Engine(undefined, createSeedState());
  const csLead = actor(e, "cs-lead-ahfa");
  const amounts = e.orderLineAmounts(csLead, "workorder-issued");
  expect(Object.keys(amounts).length).toBeGreaterThan(0);
  expect(Object.values(amounts).every((amount) => amount > 0)).toBe(true);
});

it("Sales及阿頭的Bonus業績等於該月合資格來源成交額總和", () => {
  const state = createSeedState();
  state.quotes.find((quote) => quote.id === "quote-issued")!.team = "A";
  state.payments = state.payments.filter(
    (payment) => payment.invoiceId !== "invoice-issued",
  );
  const e = new Engine(undefined, state);
  const sales = actor(e, "sales-mm");
  const head = actor(e, "head-don");
  const salesPerformance = e.performance(sales, "2026-10");
  expect(salesPerformance.sales).toBe(
    Number(
      (salesPerformance.bonusEntries ?? []).reduce(
        (sum, entry) => sum + entry.total,
        0,
      ).toFixed(2),
    ),
  );
  expect(
    salesPerformance.bonusEntries?.some(
      (entry) => entry.quoteId === "quote-issued",
    ),
  ).toBe(true);
  const headPerformance = e.performance(head, "2026-10");
  expect(headPerformance.sales).toBeGreaterThan(0);
  expect(
    headPerformance.bonusEntries?.some(
      (entry) => entry.quoteId === "quote-issued",
    ),
  ).toBe(true);
  expect(headPerformance.sales).toBe(
    Number(
      (headPerformance.bonusEntries ?? []).reduce(
        (sum, entry) => sum + entry.total,
        0,
      ).toFixed(2),
    ),
  );
});

it("空的Team即使有已刪成員的殘留monthlyTeam/shift仍可刪除", () => {
  const state = createSeedState();
  state.salesRosterTeams.push({
    id: "team-d",
    month: "2026-10",
    code: "D",
    colorIndex: 3,
    order: 4,
    createdBy: "head-don",
    createdAt: "2026-10-22T12:00:00+08:00",
  });
  state.salesMonthlyTeams.push({
    id: "stale-team",
    actorId: "removed-sale",
    month: "2026-10",
    team: "D",
    updatedBy: "head-don",
    updatedAt: "2026-10-22T12:00:00+08:00",
  });
  state.salesShifts.push({
    id: "stale-shift",
    actorId: "removed-sale",
    date: "2026-10-01",
    assignment: "D",
    updatedBy: "head-don",
    updatedAt: "2026-10-22T12:00:00+08:00",
  });
  const e = new Engine(undefined, state);
  const head = actor(e, "head-don");
  e.deleteSalesRosterTeam(head, "2026-10", "D");
  expect(
    e
      .getSalesSchedule(head, "2026-10")
      .teams.some((team) => team.code === "D"),
  ).toBe(false);
});

it("Super Admin可新增、修改、停用及啟用所有用戶", () => {
  const e = new Engine(undefined, createSeedState());
  const admin = actor(e, "admin");
  const sales = actor(e, "sales-mm");
  expect(() => e.listUsers(sales)).toThrow("Super Admin");
  const user = e.saveUser(admin, {
    name: "測試銷售",
    code: "ET",
    role: "sales",
    team: "A",
    username: "et.sales",
    password: "demo1234",
  });
  expect(user.active).toBe(true);
  expect(user.username).toBe("et.sales");
  expect(e.listUsers(admin).some((item) => item.id === user.id)).toBe(true);
  expect(() =>
    e.saveUser(admin, {
      name: "重複登入名",
      code: "EU",
      role: "sales",
      team: "B",
      username: "ET.SALES",
      password: "demo1234",
    }),
  ).toThrow("登入用戶名已存在");
  expect(() =>
    e.saveUser(admin, {
      name: "重複Code",
      code: "ET",
      role: "sales",
      team: "B",
    }),
  ).toThrow("Code已存在");
  const updated = e.saveUser(admin, {
    id: user.id,
    name: "測試主管",
    code: "ET",
    role: "supervisor",
    team: "A",
    username: "et.supervisor",
    password: "",
  });
  expect(updated.code).toBe("ET");
  expect(updated.username).toBe("et.supervisor");
  expect(updated.password).toBe("demo1234");
  expect(updated.role).toBe("supervisor");
  e.setUserActive(admin, user.id, false);
  expect(
    e.listUsers(admin).find((item) => item.id === user.id)?.active,
  ).toBe(false);
  e.setUserActive(admin, user.id, true);
  expect(
    e.listUsers(admin).find((item) => item.id === user.id)?.active,
  ).toBe(true);
  expect(() => e.setUserActive(admin, "admin", false)).toThrow("自己");
});

it("會計主管Vinson有開單員功能；Admin不可管理用戶", () => {
  const e = new Engine(undefined, createSeedState());
  const vinson = actor(e, "finance-vinson");
  expect(vinson.role).toBe("finance_supervisor");
  expect(e.listInvoices(vinson).length).toBeGreaterThan(0);
  const admin = actor(e, "admin");
  const adminStaff = e.saveUser(admin, {
    name: "Admin同事",
    code: "AD",
    role: "admin_staff",
    username: "admin.staff",
    password: "demo1234",
  });
  expect(adminStaff.role).toBe("admin_staff");
  expect(e.listInvoices(adminStaff).length).toBeGreaterThan(0);
  expect(() => e.listUsers(adminStaff)).toThrow("Super Admin");
});

it("會計主管可讀營運Dashboard，普通開單員不可", () => {
  const e = new Engine(undefined, createSeedState());
  const vinson = actor(e, "finance-vinson");
  const dashboard = e.accountingDashboard(vinson, "2026-10");
  expect(dashboard.jobs.length).toBeGreaterThan(0);
  expect(dashboard.turnover).toBeGreaterThan(0);
  expect(dashboard.months).toHaveLength(6);
  expect(dashboard.myobNote).toContain("MYOB");
  expect(dashboard.turnover).toBe(
    Number(
      dashboard.jobs
        .reduce((sum, job) => sum + job.revenue, 0)
        .toFixed(2),
    ),
  );
  const mm = dashboard.sales.find((row) => row.name.includes("文文"));
  expect(mm?.commission).toBeGreaterThan(100000);
  expect(dashboard.commissions).toBeGreaterThanOrEqual(
    mm?.commission ?? 0,
  );
  expect(() =>
    e.accountingDashboard(actor(e, "clerk"), "2026-10"),
  ).toThrow("會計主管");
});

it("營業單及年／月／星期趨勢可讀取", () => {
  const e = new Engine(undefined, createSeedState());
  const vinson = actor(e, "finance-vinson");
  const orders = e.businessOrders(vinson, "2026-10");
  expect(orders.length).toBeGreaterThan(0);
  const monthTrend = e.accountingTrend(vinson, "2026-10", "month");
  expect(monthTrend).toHaveLength(31);
  expect(e.accountingTrend(vinson, "2026-10", "week")).toHaveLength(5);
  expect(e.accountingTrend(vinson, "2026-10", "year")).toHaveLength(12);
  expect(monthTrend.reduce((sum, point) => sum + point.revenue, 0)).toBe(
    Number(orders.reduce((sum, order) => sum + order.revenue, 0).toFixed(2)),
  );
});

it("多項訂單分類按自費 > 8萬資助 > 團購決定收款分類", () => {
  const e = new Engine(undefined, createSeedState());
  const sales = actor(e, "sales-mm");
  const cases: Array<[string[], string]> = [
    [["group-buy", "grant-80k"], "grant-80k"],
    [["grant-80k", "self-pay"], "self-pay"],
    [["group-buy", "self-pay"], "self-pay"],
    [["group-buy", "grant-80k", "self-pay"], "self-pay"],
  ];
  const total = e.pricing(sales, "quote-pending-office").total;
  for (const [categories, expected] of cases) {
    e.updateQuoteOrderMeta(sales, "quote-pending-office", {
      orderCategories: categories as any,
    });
    expect(e.getQuote(sales, "quote-pending-office").officeCategory).toBe(
      expected,
    );
  }
  e.updateQuoteOrderMeta(sales, "quote-pending-office", {
    orderCategories: ["group-buy"],
  });
  expect(e.eligibility(sales, "quote-pending-office").firstDue).toBe(
    Math.round(total * 50) / 100,
  );
  e.updateQuoteOrderMeta(sales, "quote-pending-office", {
    orderCategories: ["grant-80k"],
  });
  expect(e.eligibility(sales, "quote-pending-office").firstDue).toBe(
    Math.round(total * 30) / 100,
  );
  e.updateQuoteOrderMeta(sales, "quote-pending-office", {
    orderCategories: ["self-pay"],
  });
  expect(e.eligibility(sales, "quote-pending-office").firstDue).toBe(
    Math.round(total * 30) / 100,
  );
});

it("Sales排班只准阿頭改全部Team、主管改自己Team，普通Sales只讀自己", () => {
  const state = createSeedState();
  const teamASales = state.actors.find((a) => a.id === "sales-mm")!;
  teamASales.team = "A";
  const e = new Engine(undefined, state);
  const head = actor(e, "head-don");
  const supervisor = actor(e, "supervisor-sh");
  const sales = actor(e, "sales-mm");
  expect(() =>
    e.setSalesShift(sales, "sales-mm", "2026-10-05", "A"),
  ).toThrow("只有Sales阿頭或主管");
  expect(() =>
    e.setSalesShift(supervisor, "sales-mm", "2026-10-05", "A"),
  ).toThrow("權限");
  e.setSalesShift(head, "sales-mm", "2026-10-05", "A");
  expect(
    e
      .getSalesSchedule(head, "2026-10")
      .shifts.some((shift) => shift.actorId === "sales-mm"),
  ).toBe(true);
  expect(e.getSalesSchedule(sales, "2026-10").members).toHaveLength(1);
  expect(
    e.getSalesSchedule(supervisor, "2026-10").members.map((m) => m.id),
  ).not.toContain("sales-mm");
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

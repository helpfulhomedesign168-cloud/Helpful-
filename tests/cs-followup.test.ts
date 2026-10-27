import { describe, expect, it } from "vitest";
import type { Actor } from "../src/domain/types";
import { Engine, createSeedState } from "../src/domain/engine";

const actor = (engine: Engine, id: string): Actor =>
  engine.listActors().find((item) => item.id === id)!;

describe("CS跟進同事安排", () => {
  it("工程單使用獨立D編號，CS主管可安排／更改，普通CS只讀", () => {
    const engine = new Engine(undefined, createSeedState());
    const lead = actor(engine, "cs-lead-ahfa");
    const normal = actor(engine, "cs");
    const team = engine.listCsTeam(lead).map((member) => member.name);
    expect(team).toEqual(
      expect.arrayContaining(["工程CS", "阿花", "Joe", "Nicole", "Fandy"]),
    );

    const row = engine
      .listHandoffs(lead)
      .find((item) => item.workOrderNumber === "D2600001")!;
    expect(row).toBeDefined();
    expect(row.invoiceNumber).toBe("SHMM26100001");
    expect(row.phone).toBe("91000006");
    expect(row.category).toBe("self-pay");
    expect(row.csOwnerName).toBeUndefined();
    expect(() =>
      engine.assignCsOwner(normal, row.workOrderId!, "cs-joe"),
    ).toThrow("只有CS主管");

    const assigned = engine.assignCsOwner(lead, row.workOrderId!, "cs-joe");
    expect(assigned.csOwnerId).toBe("cs-joe");
    expect(
      engine
        .listHandoffs(lead)
        .find((item) => item.workOrderId === row.workOrderId)?.csOwnerName,
    ).toBe("Joe");
    const firstAuditCount = engine
      .listAudit(lead, row.quoteId)
      .filter((event) => event.action === "cs_followup_assigned").length;
    expect(firstAuditCount).toBe(1);

    engine.assignCsOwner(lead, row.workOrderId!, "cs-joe");
    expect(
      engine
        .listAudit(lead, row.quoteId)
        .filter((event) => event.action === "cs_followup_assigned").length,
    ).toBe(firstAuditCount);

    engine.assignCsOwner(lead, row.workOrderId!, "cs-nicole");
    expect(
      engine
        .listHandoffs(lead)
        .find((item) => item.workOrderId === row.workOrderId)?.csOwnerName,
    ).toBe("Nicole");

    const admin = actor(engine, "admin");
    engine.assignCsOwner(admin, row.workOrderId!, "cs-fandy");
    expect(
      engine
        .listHandoffs(lead)
        .find((item) => item.workOrderId === row.workOrderId)?.csOwnerName,
    ).toBe("Fandy");
  });
});

it("舊LocalStorage會補CS帳戶及WorkOrder sequence，不重寫舊工程單號", () => {
  const state = createSeedState() as any;
  state.actors = state.actors.filter(
    (item: Actor) =>
      !["cs-lead-ahfa", "cs-joe", "cs-nicole", "cs-fandy"].includes(item.id),
  );
  delete state.workOrderSequences;
  state.orders[0].number = "SHMM26100001D";
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
  const engine = new Engine(storage);
  const names = engine.listActors().map((item) => item.name);
  expect(names).toEqual(
    expect.arrayContaining(["阿花", "Joe", "Nicole", "Fandy"]),
  );
  expect(engine.getState().workOrderSequences).toBeDefined();
  expect(engine.getState().orders[0].number).toBe("SHMM26100001D");
});

it("普通CS只看自己被分派的工程；主管及Admin看全部；現場圖片屬整張工程", () => {
  const engine = new Engine(undefined, createSeedState());
  const lead = actor(engine, "cs-lead-ahfa");
  const joe = actor(engine, "cs-joe");
  const nicole = actor(engine, "cs-nicole");
  const admin = actor(engine, "admin");
  const orderId = "workorder-issued";
  engine.assignCsOwner(lead, orderId, "cs-joe");

  expect(engine.listOrders(joe).map((order) => order.id)).toContain(orderId);
  expect(engine.listOrders(nicole)).toHaveLength(0);
  expect(engine.listOrders(lead).map((order) => order.id)).toContain(orderId);
  expect(engine.listOrders(admin).map((order) => order.id)).toContain(orderId);
  expect(() => engine.getOrder(nicole, orderId)).toThrow("權限");
  expect(() => engine.getInvoice(nicole, "invoice-issued")).toThrow("權限");
  expect(engine.getInvoice(joe, "invoice-issued").number).toBe("SHMM26100001");

  const order = engine.getOrder(joe, orderId);
  const assignment = engine.assign(joe, orderId, {
    resourceId: "resource-staff",
    lineIds: [order.lines[0].id],
    date: "2026-11-01",
    time: "上午",
    notes: "初次安排",
  });
  const updatedAssignment = engine.updateAssignment(joe, assignment.id, {
    resourceId: "resource-staff",
    date: "2026-11-02",
    time: "下午",
    notes: "更新安排",
  });
  expect(updatedAssignment.date).toBe("2026-11-02");
  expect(updatedAssignment.time).toBe("下午");
  expect(updatedAssignment.notes).toBe("更新安排");
  expect(() =>
    engine.updateAssignment(nicole, assignment.id, {
      resourceId: "resource-staff",
      date: "2026-11-03",
      time: "上午",
      notes: "",
    }),
  ).toThrow("權限");

  const photo = {
    id: "site-photo-1",
    name: "環境.jpg",
    mime: "image/jpeg",
    size: 1024,
    createdAt: "2026-10-22T12:00:00+08:00",
  };
  const updated = engine.addSitePhotos(joe, orderId, [photo]);
  expect(updated.sitePhotos?.[0].id).toBe("site-photo-1");
  expect(engine.getOrder(admin, orderId).sitePhotos?.[0].name).toBe("環境.jpg");
  expect(() => engine.addSitePhotos(nicole, orderId, [photo])).toThrow("權限");
});

it("Demo工程CS有30張10項以上工程；阿花分派D260099後變31張", () => {
  const engine = new Engine(undefined, createSeedState());
  const lead = actor(engine, "cs-lead-ahfa");
  const cs = actor(engine, "cs");
  const demoOrders = engine.listOrders(cs);
  expect(demoOrders).toHaveLength(30);
  demoOrders.forEach((order) =>
    expect(order.lines.length).toBeGreaterThanOrEqual(10),
  );
  expect(demoOrders.some((order) => order.number === "D260099")).toBe(false);
  const pending = engine.listOrders(lead).find((order) => order.number === "D260099");
  expect(pending?.lines).toHaveLength(20);
  engine.assignCsOwner(lead, pending!.id, "cs");
  expect(engine.listOrders(cs)).toHaveLength(31);
});

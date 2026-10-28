import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PenLine, ArrowUpRight, Check, Trash2, X } from "lucide-react";
import { useApp } from "../context";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  Search,
  Section,
} from "../components/ui";
import {
  Customer,
  EMPTY_CUSTOMER,
  ServiceItem,
  currentVersion,
  money,
} from "../domain/types";
import { CustomerForm } from "./Quotes";
const SERVICE_SCOPES = ["廚房", "廁所", "全屋", "廳房", "露台", "花園", "其他"];
const MEASURE_OPTIONS: Array<{ value: ServiceItem["measure"]; label: string }> = [
  { value: "area", label: "面積(長X闊)" },
  { value: "length", label: "直呎" },
  { value: "fixed", label: "固定價" },
  { value: "quantity", label: "件數／套數" },
];

export function Services() {
  const { actor, engine, run } = useApp();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("打拆");
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [linkPicker, setLinkPicker] = useState(false);
  const [deleting, setDeleting] = useState<ServiceItem | null>(null);
  const [tagEditor, setTagEditor] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagsToDelete, setTagsToDelete] = useState<string[]>([]);
  const [confirmTagDelete, setConfirmTagDelete] = useState(false);
  const admin = actor.role === "admin";
  const categories = engine.listServiceCategories(actor);
  const allItems = engine.listServices(actor);
  const items = allItems.filter((item) => item.published && !item.archived);
  const isExisting = Boolean(
    editing && allItems.some((item) => item.id === editing.id),
  );
  const visible = items.filter((item) => {
    if (activeCategory !== "全部" && item.category !== activeCategory)
      return false;
    return `${item.name}${item.code}${item.category}${item.scope ?? ""}${item.details ?? ""}`.includes(
      search,
    );
  });
  function newItem(category?: string) {
    setEditing({
      id: crypto.randomUUID(),
      code: `S-${String(allItems.length + 1).padStart(3, "0")}`,
      name: "",
      category:
        category ??
        (activeCategory === "全部"
          ? categories[0] ?? "其他"
          : activeCategory),
      scope: "廚房",
      details: "",
      linkedServiceIds: [],
      unit: "平方呎",
      price: 0,
      measure: "area",
      minQty: 0,
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
    });
  }
  const set = (data: Partial<ServiceItem>) =>
    setEditing((current) => (current ? { ...current, ...data } : null));
  const linked = (editing?.linkedServiceIds ?? [])
    .map((id) => allItems.find((service) => service.id === id))
    .filter((service): service is ServiceItem => Boolean(service));
  const retailLabel =
    editing?.measure === "area"
      ? "零售價（HKD／平方呎）"
      : editing?.measure === "length"
        ? "零售價（HKD／直呎）"
        : editing?.measure === "quantity"
          ? "零售價／件"
          : "零售價";
  const lowLabel =
    editing?.measure === "length" ? "低銷價（直呎）" : "低銷價（平方呎）";
  return (
    <>
      <PageHead title="工程價目" />
      <div className="list-panel service-catalog">
        <div className="service-tabs" role="tablist" aria-label="工程分類">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "全部"}
            className={activeCategory === "全部" ? "active" : ""}
            onClick={() => setActiveCategory("全部")}
          >
            全部
          </button>
          {categories.map((category) => (
            <button
              type="button"
              role="tab"
              key={category}
              aria-selected={activeCategory === category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}項目
            </button>
          ))}
          {admin && (
            <button
              type="button"
              className="service-tags-edit"
              onClick={() => {
                setTagDraft("");
                setTagsToDelete([]);
                setTagEditor(true);
              }}
            >
              編輯
            </button>
          )}
        </div>
        <div className="service-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程名稱或代號"
          />
          {admin && (
            <Button
              variant="primary"
              aria-label="新增工程項目"
              onClick={() => newItem()}
            >
              <Plus size={20} />
              新增項目
            </Button>
          )}
        </div>
        {visible.length === 0 ? (
          <Empty
            title="此分類未有工程項目"
            description="可按右上角「新增項目」加入，或切換其他分類。"
          />
        ) : (
          <div className="table-scroll">
            <table className="service-table">
              <thead>
                <tr>
                  <th>工程名稱</th>
                  <th>價格</th>
                  <th>低銷</th>
                  <th>工程範圍</th>
                  <th>編輯</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <strong>{service.name}</strong>
                      {service.details && <small>{service.details}</small>}
                    </td>
                    <td>
                      <strong>{money(service.price)}</strong>
                      <small>每{service.unit}</small>
                    </td>
                    <td>
                      {service.minQty > 0
                        ? `${service.minQty}${service.unit}`
                        : service.minAmount > 0
                          ? money(service.minAmount)
                          : "無"}
                    </td>
                    <td>{service.scope || "—"}</td>
                    <td>
                      {admin && (
                        <div className="service-row-actions">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditing(structuredClone(service));
                              setLinkPicker(false);
                            }}
                            aria-label={`修改${service.name}`}
                          >
                            <PenLine size={20} />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleting(service)}
                            aria-label={`刪除${service.name}`}
                          >
                            <Trash2 size={19} />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <Dialog
          wide
          title={isExisting ? "修改工程項目" : "新增工程項目"}
          onClose={() => {
            setEditing(null);
            setLinkPicker(false);
          }}
        >
          <div className="service-form-top">
            <Field label="工程名稱" required>
              <input
                value={editing.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            <Field label="工程分類" required>
              <select
                value={editing.category}
                onChange={(event) => set({ category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="工程範圍" required>
              <select
                value={editing.scope ?? ""}
                onChange={(event) => set({ scope: event.target.value })}
              >
                {SERVICE_SCOPES.map((scope) => (
                  <option key={scope}>{scope}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="工程詳細">
            <textarea
              className="service-details-input"
              value={editing.details ?? ""}
              onChange={(event) => set({ details: event.target.value })}
            />
          </Field>
          <div className="measure-section">
            <div className="measure-head">
              <strong>計算方式</strong>
              <span>*決定好計算方式後，日後並不能更改。</span>
            </div>
            <div className="measure-options">
              {MEASURE_OPTIONS.map((option) => (
                <label
                  className={`measure-option ${isExisting ? "locked" : ""}`}
                  key={option.value}
                >
                  <input
                    type="radio"
                    name="measure"
                    checked={editing.measure === option.value}
                    disabled={isExisting}
                    onChange={() =>
                      set({
                        measure: option.value,
                        unit:
                          option.value === "area"
                            ? "平方呎"
                            : option.value === "length"
                              ? "直呎"
                              : option.value === "quantity"
                                ? "件"
                                : "項",
                        minQty:
                          option.value === "area" || option.value === "length"
                            ? editing.minQty
                            : 0,
                      })
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div className="service-price-grid">
            <Field label={retailLabel} required>
              <input
                type="number"
                min=".01"
                value={editing.price || ""}
                onChange={(event) => set({ price: Number(event.target.value) })}
              />
            </Field>
            {(editing.measure === "area" || editing.measure === "length") && (
              <Field label={lowLabel}>
                <input
                  type="number"
                  min="0"
                  value={editing.minQty || ""}
                  onChange={(event) =>
                    set({ minQty: Number(event.target.value) })
                  }
                />
              </Field>
            )}
            <Field label="合併低銷價">
              <select
                value={editing.minScope === "service" ? "可以" : "不可以"}
                onChange={(event) =>
                  set({
                    minScope:
                      event.target.value === "可以" ? "service" : "line",
                  })
                }
              >
                <option>可以</option>
                <option>不可以</option>
              </select>
            </Field>
          </div>
          <div className="linked-services">
            <strong>連貫工程</strong>
            {linked.map((service) => (
              <div className="linked-row" key={service.id}>
                <span>
                  <strong>{service.name}</strong>
                  <small>{service.details}</small>
                </span>
                <button
                  type="button"
                  aria-label={`移除連貫工程${service.name}`}
                  onClick={() =>
                    set({
                      linkedServiceIds: (editing.linkedServiceIds ?? []).filter(
                        (id) => id !== service.id,
                      ),
                    })
                  }
                >
                  <X size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="linked-add"
              onClick={() => setLinkPicker(true)}
            >
              <Plus size={19} />
              新增連貫工程
            </button>
          </div>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                setEditing(null);
                setLinkPicker(false);
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.saveService(actor, editing);
                  return true;
                }, "工程項目已保存；舊簽署版本不會反寫。");
                if (ok) {
                  setEditing(null);
                  setLinkPicker(false);
                }
              }}
            >
              <Check size={20} />
              儲存工程項目
            </Button>
          </div>
        </Dialog>
      )}
      {editing && linkPicker && (
        <Dialog
          title="新增連貫工程"
          onClose={() => setLinkPicker(false)}
        >
          <p className="dialog-intro">
            選擇要連貫的工程項目。只顯示分類、名稱及工程詳細。
          </p>
          <div className="linked-picker">
            {categories.map((category) => {
              const rows = items.filter(
                (service) =>
                  service.category === category && service.id !== editing.id,
              );
              if (!rows.length) return null;
              return (
                <div className="linked-picker-group" key={category}>
                  <h4>{category}項目</h4>
                  {rows.map((service) => (
                    <label className="linked-option" key={service.id}>
                      <input
                        type="checkbox"
                        checked={(editing.linkedServiceIds ?? []).includes(
                          service.id,
                        )}
                        onChange={(event) => {
                          const current = editing.linkedServiceIds ?? [];
                          set({
                            linkedServiceIds: event.target.checked
                              ? [...current, service.id]
                              : current.filter((id) => id !== service.id),
                          });
                        }}
                      />
                      <span>
                        <strong>{service.name}</strong>
                        {service.details && <small>{service.details}</small>}
                      </span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="dialog-actions">
            <Button variant="primary" onClick={() => setLinkPicker(false)}>
              完成
            </Button>
          </div>
        </Dialog>
      )}
      {tagEditor && (
        <Dialog title="編輯工程分類" onClose={() => setTagEditor(false)}>
          <div className="tag-editor-add">
            <label className="field-label">新增項目</label>
            <div className="tag-add-row">
              <input
                aria-label="新增分類名稱"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="輸入新分類名稱"
              />
              <Button
                variant="primary"
                disabled={!tagDraft.trim()}
                onClick={() => {
                  const name = tagDraft.trim();
                  const ok = run(() => {
                    engine.addServiceCategory(actor, name);
                    return true;
                  }, "工程分類已新增。");
                  if (ok) {
                    setTagDraft("");
                    setActiveCategory(name);
                  }
                }}
              >
                新增
              </Button>
            </div>
          </div>
          <div className="tag-editor-delete">
            <h4>刪除項目</h4>
            {categories.map((category) => (
              <label className="tag-delete-row" key={category}>
                <span>{category}項目</span>
                <input
                  type="checkbox"
                  checked={tagsToDelete.includes(category)}
                  onChange={(event) =>
                    setTagsToDelete(
                      event.target.checked
                        ? [...tagsToDelete, category]
                        : tagsToDelete.filter((item) => item !== category),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <Button
              disabled={!tagsToDelete.length}
              onClick={() => setConfirmTagDelete(true)}
            >
              刪除
            </Button>
            <Button onClick={() => setTagEditor(false)}>取消</Button>
          </div>
        </Dialog>
      )}
      {confirmTagDelete && (
        <Dialog title="確認刪除" onClose={() => setConfirmTagDelete(false)}>
          <p>
            是否確定真的要刪除
            {tagsToDelete.map((category) => `${category}項目`).join("、")}
            ？一旦刪除，工程項目入面的工程全部都會一齊刪除掉。
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setConfirmTagDelete(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.deleteServiceCategories(actor, tagsToDelete);
                  return true;
                }, "工程分類及相關項目已刪除。");
                if (ok) {
                  if (tagsToDelete.includes(activeCategory))
                    setActiveCategory("全部");
                  setTagsToDelete([]);
                  setConfirmTagDelete(false);
                  setTagEditor(false);
                }
              }}
            >
              確定刪除
            </Button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="刪除工程項目" onClose={() => setDeleting(null)}>
          <p>
            確定刪除「{deleting.name}」？項目會從價目表移除；舊報價的
            snapshot 不會被改寫。
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.deleteService(actor, deleting.id);
                  return true;
                }, "工程項目已刪除。");
                if (ok) setDeleting(null);
              }}
            >
              刪除
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function Customers() {
  const { actor, engine, run } = useApp();
  const [search, setSearch] = useState("");
  const [salesFilter, setSalesFilter] = useState("all");
  const [active, setActive] = useState<Customer | null>(null);
  const [creating, setCreating] = useState<Customer | null>(null);
  const nav = useNavigate();
  const csRole = ["cs", "cs_supervisor"].includes(actor.role);
  const canCreate = ["sales", "head", "supervisor", "admin"].includes(
    actor.role,
  );
  let qs = [] as ReturnType<typeof engine.listQuotes>;
  try {
    if (!csRole) qs = engine.listQuotes(actor);
  } catch {}
  const isClerk = actor.role === "clerk";
  let profiles: ReturnType<typeof engine.listCustomers> = [];
  try {
    if (!csRole) profiles = engine.listCustomers(actor);
  } catch {}
  let clients: Customer[] = profiles.map((profile) => profile.customer);
  if (csRole) clients = engine.listOrders(actor).map((o) => o.customer);
  const ownerByCustomer = new Map<string, string>();
  profiles.forEach((profile) => {
    ownerByCustomer.set(
      profile.customer.id || profile.customer.phone,
      profile.ownerId,
    );
    ownerByCustomer.set(profile.customer.phone, profile.ownerId);
  });
  const salesActors = engine
    .listActors()
    .filter((candidate) =>
      ["sales", "supervisor", "head"].includes(candidate.role),
    );
  const ownerName = (customer: Customer) => {
    const ownerId =
      ownerByCustomer.get(customer.id || "") ??
      ownerByCustomer.get(customer.phone);
    return salesActors.find((candidate) => candidate.id === ownerId)?.name ??
      "—";
  };
  const list = clients
    .filter(
      (c, i, all) => c.name && all.findIndex((a) => a.phone === c.phone) === i,
    )
    .filter((c) => {
      if (!isClerk || salesFilter === "all") return true;
      const ownerId =
        ownerByCustomer.get(c.id || "") ??
        ownerByCustomer.get(c.phone);
      return ownerId === salesFilter;
    })
    .filter((c) => `${c.name}${c.phone}${c.address}`.includes(search));
  return (
    <>
      <PageHead
        eyebrow="聯絡與來源"
        title={
          ["sales", "head", "supervisor"].includes(actor.role)
            ? "我的客戶"
            : "客戶"
        }
        actions={
          canCreate && (
            <Button
              variant="primary"
              onClick={() => setCreating(structuredClone(EMPTY_CUSTOMER))}
            >
              <Plus size={20} />
              新增客戶
            </Button>
          )
        }
      />
      <div className="list-panel">
        <div className="list-toolbar customer-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋客戶姓名、電話或地址"
          />
          {isClerk && (
            <select
              className="customer-sales-filter"
              aria-label="Sales"
              value={salesFilter}
              onChange={(event) => setSalesFilter(event.target.value)}
            >
              <option value="all">全部 Sales</option>
              {salesActors.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {list.length === 0 ? (
          <Empty
            title="暫無可見客戶"
            description={
              canCreate
                ? "先新增客戶主檔，或建立報價時直接記錄客戶。"
                : "尚未有可查看的工程客戶。"
            }
            action={
              canCreate ? (
                <Button
                  onClick={() => setCreating(structuredClone(EMPTY_CUSTOMER))}
                >
                  <Plus size={20} />
                  新增客戶
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">客戶姓名</th>
                  {isClerk && <th scope="col">Sales</th>}
                  <th scope="col">聯絡電話</th>
                  <th scope="col">工程地址</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id || c.phone}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    {isClerk && <td>{ownerName(c)}</td>}
                    <td>{c.phone}</td>
                    <td>
                      {c.district} · {c.estate}
                      <small>{c.address}</small>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setActive(c)}
                        aria-label={`查看${c.name}`}
                      >
                        <ArrowUpRight size={22} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {creating && (
        <Dialog wide title="新增客戶" onClose={() => setCreating(null)}>
          <p className="dialog-intro">
            先建立客戶及住宅主檔；儲存後不會自動建立報價，可在需要時再從報價頁選取。
          </p>
          <CustomerForm
            value={creating}
            onChange={setCreating}
          />
          <div className="dialog-actions">
            <Button onClick={() => setCreating(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.createCustomer(actor, creating);
                  return true;
                }, "客戶主檔已新增，可日後直接選取建立報價。");
                if (ok) setCreating(null);
              }}
            >
              <Check size={20} />
              儲存客戶
            </Button>
          </div>
        </Dialog>
      )}
      {active && (
        <Dialog title={active.name} onClose={() => setActive(null)}>
          <div className="review-details">
            <div>
              <span>電話</span>
              <strong>{active.phone}</strong>
            </div>
            <div>
              <span>WhatsApp</span>
              <strong>{active.whatsapp}</strong>
            </div>
            <div>
              <span>工程地址</span>
              <strong>{active.address}</strong>
            </div>
          </div>
          <h3>相關授權單據</h3>
          {qs
            .filter(
              (q) =>
                currentVersion(q).customer.id === active.id ||
                currentVersion(q).customer.phone === active.phone,
            )
            .map((q) => (
              <button
                className="customer-option"
                key={q.id}
                onClick={() => {
                  setActive(null);
                  nav("/quotes/" + q.id);
                }}
              >
                <span>{q.number}</span>
                <ArrowUpRight size={22} />
              </button>
            ))}
          {csRole &&
            engine
              .listOrders(actor)
              .filter((o) => o.customer.phone === active.phone)
              .map((o) => (
                <button
                  className="customer-option"
                  key={o.id}
                  onClick={() => {
                    setActive(null);
                    nav("/orders/" + o.id);
                  }}
                >
                  <span>{o.number}</span>
                  <ArrowUpRight size={22} />
                </button>
              ))}
        </Dialog>
      )}
    </>
  );
}
export function Performance() {
  const { actor, engine } = useApp();
  const [month, setMonth] = useState("2026-10");
  const [info, setInfo] = useState(false);
  const p = engine.performance(actor, month);
  const nav = useNavigate();
  const management = actor.role === "head" || actor.role === "supervisor";
  return (
    <>
      <PageHead
        eyebrow="只看本人收益"
        title="我的業績"
        actions={
          <Field label="業績月份">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        }
      />
      <div className="performance-stats">
        <div>
          <span>{management ? "管理Bonus合資格業績" : "本月合資格業績"}</span>
          <strong>{money(p.sales)}</strong>
        </div>
        <div>
          <span>基本佣金</span>
          <strong>{money(p.commission)}</strong>
        </div>
        <div>
          <span>本月Bonus</span>
          <strong>{money(p.bonus)}</strong>
        </div>
      </div>
      <Section
        title="Bonus進度"
        action={
          <Button variant="ghost" onClick={() => setInfo(true)}>
            查看本人規則
          </Button>
        }
      >
        {p.nextTarget ? (
          <>
            <div className="bonus-top">
              <span>下一級 {money(p.nextTarget)}</span>
              <strong>還差 {money(Math.max(0, p.nextTarget - p.sales))}</strong>
            </div>
            <div className="bonus-track">
              <div
                style={{
                  width: `${Math.min(100, (p.sales / p.nextTarget) * 100)}%`,
                }}
              />
            </div>
            <p className="muted">
              達標Bonus {money(p.nextBonus || 0)} · 取最高一級
            </p>
          </>
        ) : (
          <div className="bonus-top">
            <strong>已達最高Bonus級別</strong>
            <Badge strong>{money(p.bonus)}</Badge>
          </div>
        )}
      </Section>
      <Section title="本月合資格來源">
        {p.entries.length === 0 ? (
          <Empty
            title="本月暫無合資格來源"
            description="會計核足適用首期後，業績及佣金才會計入。"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>來源／客戶</th>
                  <th>首期達標日</th>
                  <th className="numeric">成交額</th>
                  <th className="numeric">本人比例</th>
                  <th className="numeric">基本佣金</th>
                </tr>
              </thead>
              <tbody>
                {p.entries.map((e, i) => (
                  <tr key={e.quoteId + i}>
                    <td>
                      <button
                        className="source-link text-button"
                        onClick={() => nav("/quotes/" + e.quoteId)}
                      >
                        {e.number}
                      </button>
                      <small>{e.customerName}</small>
                    </td>
                    <td>{e.date}</td>
                    <td className="numeric">{money(e.total)}</td>
                    <td className="numeric">
                      {Number((e.rate * 100).toFixed(2))}%
                    </td>
                    <td className="numeric money">{money(e.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="muted">合資格金額不等已發放薪金；月結及發放由會計處理。</p>
      {info && (
        <Dialog title="本人的佣金與Bonus" onClose={() => setInfo(false)}>
          {actor.role === "sales" ? (
            <>
              <p>本人來源一般佣金8%；折扣低於95折時為6%。</p>
              <p>
                個人合資格業績：30萬／40萬／50萬／60萬，對應Bonus為3,000／6,000／10,000／15,000。
              </p>
            </>
          ) : actor.role === "supervisor" ? (
            <>
              <p>
                歸屬本人主管的Team
                B来源為3%；低於95折為2%。本人成交另有Sales佣金。
              </p>
              <p>
                本人歸屬Team
                B業績90萬／120萬／150萬／180萬，對應Bonus為3,000／6,000／10,000／15,000。
              </p>
            </>
          ) : (
            <>
              <p>
                Team A管理佣金4%，低於95折為3%；Team
                B管理佣金1%。本人成交另有Sales佣金。
              </p>
              <p>
                Team
                A管理Bonus按80萬／100萬／120萬，對應6,000／10,000／15,000；不享Team
                B Bonus。
              </p>
            </>
          )}
          <p>折後成交額作基數，實際收足首期的月份計入；Bonus不累加。</p>
        </Dialog>
      )}
    </>
  );
}

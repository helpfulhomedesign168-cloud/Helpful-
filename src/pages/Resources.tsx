import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PenLine, ArrowUpRight, Check, ChevronDown } from "lucide-react";
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
export function Services() {
  const { actor, engine, run } = useApp();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [more, setMore] = useState(false);
  const admin = actor.role === "admin";
  const items = engine.listServices(actor);
  function newItem() {
    setMore(false);
    setEditing({
      id: crypto.randomUUID(),
      code: `S-${String(items.length + 1).padStart(3, "0")}`,
      name: "",
      category: "泥水",
      unit: "平方呎",
      price: 0,
      measure: "area",
      minQty: 0,
      minAmount: 0,
      increment: 0,
      minScope: "line",
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
    setEditing((e) => (e ? { ...e, ...data } : null));
  return (
    <>
      <PageHead
        eyebrow={admin ? "主檔管理" : "只讀參考"}
        title="工程目錄"
        actions={
          admin && (
            <Button variant="primary" onClick={newItem}>
              <Plus size={20} />
              新增工程項目
            </Button>
          )
        }
      />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程名稱或代號"
          />
          <Badge>示例價目 · 待公司核准</Badge>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>工程名稱</th>
                <th>分類</th>
                <th className="numeric">出街單價</th>
                <th>低消</th>
                <th>執行方式</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items
                .filter((s) =>
                  `${s.name}${s.code}${s.category}`.includes(search),
                )
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>
                        {s.code}
                        {!s.published ? " · 已停用" : ""}
                      </small>
                    </td>
                    <td>{s.category}</td>
                    <td className="numeric">
                      {money(s.price)}
                      <small>／{s.unit}</small>
                    </td>
                    <td>
                      {s.minQty > 0
                        ? `${s.minQty} ${s.unit}`
                        : s.minAmount > 0
                          ? money(s.minAmount)
                          : "無"}
                    </td>
                    <td>
                      <Badge>
                        {s.execution === "contractor"
                          ? "外判"
                          : s.execution === "self"
                            ? "公司自營"
                            : "服務供應商"}
                      </Badge>
                    </td>
                    <td>
                      {admin && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditing(structuredClone(s));
                            setMore(false);
                          }}
                          aria-label={`修改${s.name}`}
                        >
                          <PenLine size={21} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <Dialog
          wide
          title={
            items.some((s) => s.id === editing.id)
              ? "修改工程項目"
              : "新增工程項目"
          }
          onClose={() => setEditing(null)}
        >
          <div className="form-grid two">
            <Field label="工程名稱" required>
              <input
                value={editing.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label="工程分類" required>
              <input
                value={editing.category}
                onChange={(e) => set({ category: e.target.value })}
                list="service-categories"
              />
              <datalist id="service-categories">
                {[
                  "打拆",
                  "泥水",
                  "水電",
                  "油漆",
                  "木工",
                  "門窗",
                  "防水",
                  "搬運",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </Field>
            <Field label="怎樣計價" required>
              <select
                value={editing.measure}
                onChange={(e) => {
                  const measure = e.target.value as ServiceItem["measure"];
                  set({
                    measure,
                    unit:
                      measure === "area"
                        ? "平方呎"
                        : measure === "length"
                          ? "直呎"
                          : measure === "quantity"
                            ? "套"
                            : "項",
                  });
                }}
              >
                <option value="area">面積（長 × 闊）</option>
                <option value="length">長度／直呎</option>
                <option value="quantity">件數／套數</option>
                <option value="fixed">固定一項價</option>
              </select>
            </Field>
            <Field label={`出街單價（HKD／${editing.unit}）`} required>
              <input
                type="number"
                min=".01"
                value={editing.price || ""}
                onChange={(e) => set({ price: Number(e.target.value) })}
              />
            </Field>
            <Field label="最低計費量（沒有可留空）">
              <input
                type="number"
                min="0"
                value={editing.minQty || ""}
                onChange={(e) => set({ minQty: Number(e.target.value) })}
              />
            </Field>
            <Field label="執行方式" required>
              <select
                value={editing.execution}
                onChange={(e) => {
                  const execution = e.target.value as ServiceItem["execution"];
                  set({
                    execution,
                    costMode:
                      execution === "contractor"
                        ? "ratio"
                        : execution === "self"
                          ? "self"
                          : "fixed",
                  });
                }}
              >
                <option value="contractor">一般判頭外判</option>
                <option value="self">公司自營安裝</option>
                <option value="service">固定服務供應商</option>
              </select>
            </Field>
          </div>
          {editing.execution === "contractor" ? (
            <div className="tools-note">
              外判成本自動按該明細折後成交額的60%計算，Sales不能修改。
            </div>
          ) : editing.execution === "service" ? (
            <Field label="固定服務成本（HKD）" required>
              <input
                type="number"
                min="0"
                value={editing.fixedCost ?? ""}
                onChange={(e) =>
                  set({
                    fixedCost:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
            </Field>
          ) : (
            <div className="form-grid two">
              <Field label="物料預算（HKD）" required>
                <input
                  type="number"
                  min="0"
                  value={editing.materialCost ?? ""}
                  onChange={(e) =>
                    set({
                      materialCost:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="安裝人工預算（HKD）" required>
                <input
                  type="number"
                  min="0"
                  value={editing.labourCost ?? ""}
                  onChange={(e) =>
                    set({
                      labourCost:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="成本適用範圍">
                <select
                  value={editing.costBasis}
                  onChange={(e) =>
                    set({ costBasis: e.target.value as "unit" | "line" })
                  }
                >
                  <option value="unit">每計量單位</option>
                  <option value="line">這項明細一次</option>
                </select>
              </Field>
            </div>
          )}
          <Field label="Sales施工提示">
            <textarea
              value={editing.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="包含／不包含、連工包料及現場需留意內容"
            />
          </Field>
          <Button variant="ghost" onClick={() => setMore(!more)}>
            <ChevronDown size={20} />
            其他規則
          </Button>
          {more && (
            <div className="expanded-form">
              <div className="form-grid two">
                <Field label="最低收費金額（HKD）">
                  <input
                    type="number"
                    min="0"
                    value={editing.minAmount || ""}
                    onChange={(e) => set({ minAmount: Number(e.target.value) })}
                  />
                </Field>
                <Field label="低消計算範圍">
                  <select
                    value={editing.minScope}
                    onChange={(e) =>
                      set({ minScope: e.target.value as "line" | "service" })
                    }
                  >
                    <option value="line">每條明細各自計算</option>
                    <option value="service">同項工程合計</option>
                  </select>
                </Field>
                <Field label="計費進位">
                  <select
                    value={editing.increment}
                    onChange={(e) => set({ increment: Number(e.target.value) })}
                  >
                    <option value="0">保留精確數量</option>
                    <option value="0.5">向上半呎／半單位</option>
                    <option value="1">向上整呎／整單位</option>
                  </select>
                </Field>
                <Field label="款式／顏色（以逗號分隔）">
                  <input
                    value={editing.options.join("，")}
                    onChange={(e) =>
                      set({
                        options: e.target.value
                          .split(/[,，]/)
                          .map((o) => o.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editing.allowPending}
                  onChange={(e) => set({ allowPending: e.target.checked })}
                />
                同價款式可待選
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) => set({ published: e.target.checked })}
                />
                啟用於新報價
              </label>
            </div>
          )}
          <div className="dialog-actions">
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.saveService(actor, editing);
                  return true;
                }, "工程項目已保存；舊簽署版本不會反寫。");
                if (ok) setEditing(null);
              }}
            >
              <Check size={20} />
              儲存工程項目
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
  const [active, setActive] = useState<Customer | null>(null);
  const [creating, setCreating] = useState<Customer | null>(null);
  const nav = useNavigate();
  const canCreate = ["sales", "head", "supervisor", "admin"].includes(
    actor.role,
  );
  let qs = [] as ReturnType<typeof engine.listQuotes>;
  try {
    if (actor.role !== "cs") qs = engine.listQuotes(actor);
  } catch {}
  let clients: Customer[] = [];
  try {
    clients = engine.listCustomers(actor).map((profile) => profile.customer);
  } catch {}
  if (actor.role === "cs")
    clients = engine.listOrders(actor).map((o) => o.customer);
  const list = clients
    .filter(
      (c, i, all) => c.name && all.findIndex((a) => a.phone === c.phone) === i,
    )
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
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋客戶姓名、電話或地址"
          />
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
                  <th>客戶姓名</th>
                  <th>聯絡電話</th>
                  <th>工程地址</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id || c.phone}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
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
          {actor.role === "cs" &&
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

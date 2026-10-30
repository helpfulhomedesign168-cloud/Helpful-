import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  ArrowUpRight,
  Trash2,
  Check,
  Printer,
  PenLine,
  FileCheck2,
  Send,
  Wallet,
  Archive,
  Search as SearchIcon,
} from "lucide-react";
import { getAttachmentBlob, useApp } from "../context";
import {
  Customer,
  Quote,
  QuoteLine,
  ServiceItem,
  EMPTY_CUSTOMER,
  DEMO_TODAY,
  currentVersion,
  money,
  PaymentInput,
  METHOD_NAMES,
  Pricing,
  DiscountMode,
  discountLabel,
  composeCustomerAddress,
  SUPPLIER_CATEGORIES,
  ProductStyleSeries,
  ProductStyleSnapshot,
  ProductStyleSupplier,
  InvoiceCategory,
  INVOICE_CATEGORY_NAMES,
} from "../domain/types";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  Progress,
  Search,
  Section,
  UploadField,
  Pagination,
  usePagination,
} from "../components/ui";
function feetNumber(value: number, unit: "呎" | "寸") {
  return unit === "寸" ? value / 12 : value;
}

function roundDimension(value: number) {
  return Math.round(value * 100) / 100;
}

function QuoteStylePicture({
  attachment,
  alt,
}: {
  attachment: ProductStyleSnapshot["attachment"];
  alt: string;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    getAttachmentBlob(attachment).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);
  return url ? (
    <img src={url} alt={alt} />
  ) : (
    <span className="quote-style-thumb-empty" />
  );
}

function QuoteStyleThumb({ snapshot }: { snapshot: ProductStyleSnapshot }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    getAttachmentBlob(snapshot.attachment).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [snapshot.attachment.id]);
  return url ? (
    <img className="quote-style-thumb" src={url} alt={snapshot.productCode} />
  ) : (
    <span className="quote-style-thumb quote-style-thumb-empty" />
  );
}

const salesRoles = ["sales", "supervisor", "head"];
export function quoteListPath(role: string) {
  if (role === "finance") return "/finance";
  if (role === "clerk") return "/submissions";
  if (role === "cs") return "/handoff";
  return "/quotes";
}
export function Quotes() {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(
    new URLSearchParams(location.search).get("tab") || "pending",
  );
  const qs = engine.listQuotes(actor);
  function bucket(q: Quote) {
    if (q.archived) return "archived";
    if (q.submission || q.invoiceId) return "submitted";
    const e = engine.eligibility(actor, q.id);
    return e.stage === "draft" ? "draft" : "pending";
  }
  const shown = qs
    .filter((q) => bucket(q) === tab)
    .filter((q) =>
      `${q.number} ${currentVersion(q).customer.name} ${currentVersion(q).customer.district} ${currentVersion(q).customer.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pager = usePagination(shown, `${tab}|${search}`);
  return (
    <>
      <PageHead
        eyebrow="日常接單"
        title="報價管理"
        actions={
          salesRoles.includes(actor.role) && (
            <Button variant="primary" onClick={() => nav("/quotes/new")}>
              <Plus size={22} />
              建立報價
            </Button>
          )
        }
      />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋報價編號、客戶或電話"
          />
          <span className="muted">{qs.length} 張報價</span>
        </div>
        <div className="tabs">
          {[
            ["pending", "待提交"],
            ["submitted", "已提交"],
            ["draft", "草稿"],
            ["archived", "封存"],
          ].map(([key, label]) => (
            <button
              className={tab === key ? "selected" : ""}
              key={key}
              onClick={() => {
                setTab(key);
                nav(`/quotes?tab=${key}`, { replace: true });
              }}
            >
              {label}
              <span>{qs.filter((q) => bucket(q) === key).length}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <Empty
            title="這裏暫時沒有報價"
            description="建立新報價，或切換其他狀態查看。"
            action={
              salesRoles.includes(actor.role) && (
                <Button onClick={() => nav("/quotes/new")}>
                  <Plus size={20} />
                  建立報價
                </Button>
              )
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>報價／版本</th>
                  <th>客戶／工程地區</th>
                  <th className="numeric">成交金額</th>
                  <th>目前進度</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pager.items.map((q) => {
                  const v = currentVersion(q),
                    p = engine.pricing(actor, q.id),
                    e = engine.eligibility(actor, q.id);
                  return (
                    <tr key={q.id}>
                      <td>
                        <Link className="source-link" to={"/quotes/" + q.id}>
                          {q.number}
                        </Link>
                        <small>版本 {v.index}</small>
                      </td>
                      <td>
                        <strong>{v.customer.name || "未填客戶"}</strong>
                        <small>
                          {v.customer.district || "待填工程地址"}
                          {v.customer.estate ? " · " + v.customer.estate : ""}
                        </small>
                      </td>
                      <td className="numeric money">{money(p.total)}</td>
                      <td>
                        <Badge strong={e.stage === "issued"}>{e.label}</Badge>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => nav("/quotes/" + q.id)}
                          aria-label={`查看${q.number}`}
                        >
                          <ArrowUpRight size={22} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pager.total > 0 && (
          <Pagination
            page={pager.page}
            pages={pager.pages}
            total={pager.total}
            onChange={pager.setPage}
          />
        )}
      </div>
      <div className="list-footnote">
        <span className="small-dot" />
        已提交代表已交Office；會計核足首期後才開Invoice及安排工程。
      </div>
    </>
  );
}
export function CustomerForm({
  value,
  onChange,
}: {
  value: Customer;
  onChange: (v: Customer) => void;
}) {
  const address = composeCustomerAddress(value);
  const set = (key: keyof Customer, val: string) => {
    const next = { ...value, [key]: val };
    onChange({ ...next, address: composeCustomerAddress(next) });
  };
  function name(val: string) {
    onChange({ ...value, name: val });
  }
  const text = (key: keyof Customer, label: string, required = true) => (
    <Field label={label} required={required}>
      <input
        value={String(value[key] || "")}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );
  return (
    <>
      <div className="form-grid three">
        <Field label="客戶姓名" required>
          <input
            value={value.name}
            onChange={(e) => name(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label="聯絡電話" required>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
          />
        </Field>
        <Field label="WhatsApp電話" required>
          <input
            type="tel"
            value={value.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
          />
        </Field>
      </div>
      <div className="form-grid three">
        <Field label="工程地區" required>
          <select
            value={value.district}
            onChange={(e) => set("district", e.target.value)}
          >
            <option value="">選擇地區</option>
            {[
              "中西區",
              "灣仔",
              "東區",
              "南區",
              "油尖旺",
              "深水埗",
              "九龍城",
              "黃大仙",
              "觀塘",
              "葵青",
              "荃灣",
              "屯門",
              "元朗",
              "北區",
              "大埔",
              "沙田",
              "西貢",
              "離島",
            ].map((district) => (
              <option key={district}>{district}</option>
            ))}
          </select>
        </Field>
        {text("street", "街道", false)}
        {text("estate", "屋苑／大廈")}
      </div>
      <div className="form-grid three">
        {text("block", "座數", false)}
        {text("floor", "樓層")}
        {text("unit", "單位")}
      </div>
      <Field
        label="完整地址"
        required
        hint="由上方地區、街道、屋苑／大廈、座數、樓層及單位自動組合"
      >
        <output className="readonly-input" aria-live="polite">
          {address || "請先填寫上方地址資料"}
        </output>
      </Field>
      <div className="expanded-form">
        <div className="form-grid three">
          {text("idNumber", "身份證號碼（Demo佔位）", false)}
          <Field label="是否長者">
            <select
              value={value.isElderly}
              onChange={(e) => set("isElderly", e.target.value)}
            >
              <option value="">選擇</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          </Field>
          <Field label="客戶來源">
            <select
              value={value.source}
              onChange={(e) => set("source", e.target.value)}
            >
              <option value="">選擇來源</option>
              {["Facebook", "街站", "朋友介紹", "舊客", "其他"].map(
                (source) => (
                  <option key={source}>{source}</option>
                ),
              )}
            </select>
          </Field>
          {text("email", "電郵", false)}
          {text("emergencyName", "緊急聯絡人", false)}
          {text("emergencyPhone", "緊急聯絡電話", false)}
          {text("managementPhone", "管理處電話", false)}
        </div>
        <div className="form-grid two">
          {text("parking", "停車／上落貨資料", false)}
          {text("precautions", "現場特別注意事項", false)}
          <Field label="Sales備註">
            <textarea
              value={value.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          <Field label="客戶附件">
            <UploadField
              attachment={value.attachment}
              label="上載客戶文件"
              onSave={(attachment) =>
                onChange({ ...value, attachment, address })
              }
              onClear={() =>
                onChange({ ...value, attachment: undefined, address })
              }
            />
          </Field>
        </div>
      </div>
    </>
  );
}
export function QuoteEditor() {
  const { actor, engine, run } = useApp();
  const { id } = useParams();
  const nav = useNavigate();
  let existing: Quote | undefined;
  try {
    if (id) existing = engine.getQuote(actor, id);
  } catch {}
  const base = existing ? currentVersion(existing) : undefined;
  let masterCustomer = base?.customer;
  try {
    if (base?.customer.id)
      masterCustomer = engine.getCustomer(actor, base.customer.id);
  } catch {
    // A removed master profile must not prevent the Sales from seeing this historical draft.
  }
  const [customer, setCustomer] = useState<Customer>(
    masterCustomer
      ? structuredClone(masterCustomer)
      : structuredClone(EMPTY_CUSTOMER),
  );
  const [lines, setLines] = useState<QuoteLine[]>(
    base ? structuredClone(base.lines) : [],
  );
  const [discountMode, setDiscountMode] = useState<DiscountMode>(
    base?.discountMode ??
      (base?.discount && base.discount < 1 ? "rate" : "none"),
  );
  const [discountValue, setDiscountValue] = useState(
    base?.discountValue ??
      (base?.discount && base.discount < 1 ? base.discount * 100 : 0),
  );
  const [ratePreset, setRatePreset] = useState<"95" | "custom">(
    base?.discountMode === "rate" &&
      (base.discountValue ?? base.discount * 100) === 95
      ? "95"
      : "custom",
  );
  const [reason, setReason] = useState("");
  const [picker, setPicker] = useState(false);
  const [customers, setCustomers] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [cat, setCat] = useState("全部");
  const [linkedPrompt, setLinkedPrompt] = useState<string | null>(null);
  const [styleLineIndex, setStyleLineIndex] = useState<number | null>(null);
  const [styleCategory, setStyleCategory] = useState("all");
  const [styleFactoryId, setStyleFactoryId] = useState("");
  const services = engine.listServices(actor).filter((s) => s.published);
  let styleSuppliers: ProductStyleSupplier[] = [];
  try {
    styleSuppliers = engine.listProductStyleSuppliers(actor);
  } catch {}
  const styleFactory = styleSuppliers.find(
    (supplier) => supplier.id === styleFactoryId,
  );
  let styleSeries: ProductStyleSeries[] = [];
  try {
    if (styleFactory) {
      styleSeries = engine.listProductStyles(actor, styleFactory.id);
    }
  } catch {}
  const filteredStyleSuppliers = styleSuppliers.filter(
    (supplier) =>
      styleCategory === "all" ||
      supplier.categories.includes(styleCategory),
  );
  const categories = ["全部", ...new Set(services.map((s) => s.category))];
  let baseSubtotal = 0;
  try {
    baseSubtotal = engine.preview(actor, lines, 1).subtotal;
  } catch {}
  const discount =
    discountMode === "none"
      ? 1
      : discountMode === "rate"
        ? Math.max(0, Math.min(100, discountValue || 0)) / 100
        : baseSubtotal > 0
          ? Math.max(0, baseSubtotal - Math.max(0, discountValue || 0)) /
            baseSubtotal
          : 1;
  let pricing: Pricing = {
    subtotal: 0,
    total: 0,
    firstDue: 0,
    lineAmounts: [],
    blocked: false,
    costIncomplete: false,
  };
  try {
    pricing = engine.preview(actor, lines, discount);
  } catch {}
  const clerkEditor = actor.role === "clerk";
  const own =
    salesRoles.includes(actor.role) &&
    (!existing || existing.ownerId === actor.id);
  const canEdit = own || clerkEditor || actor.role === "admin";
  if (!canEdit || (id && !existing)) {
    return (
      <Empty
        title="沒有這張報價的編輯權限"
        action={<Button onClick={() => nav("/quotes")}>返回報價管理</Button>}
      />
    );
  }
  function save(destination: "draft" | "deal") {
    const q = run(
      () =>
        engine.saveDraft(actor, id, {
          customer,
          lines,
          discount,
          discountMode,
          discountValue,
          reason,
        }),
      destination === "deal"
        ? "已保存。下一步請準備列印正式報價單。"
        : existing?.versions.some((v) => v.signature || v.printPreparation)
          ? "新版本草稿已保存，請重新準備列印及客戶簽署。"
          : "報價草稿已保存。",
    );
    if (q)
      nav(
        clerkEditor
          ? "/quotes/" + q.id
          : destination === "deal"
            ? "/quotes/" + q.id
            : "/quotes/" + q.id + "/edit",
      );
  }
  function add(s: ServiceItem) {
    if (
      lines.some((l) => l.itemId === s.id) &&
      !window.confirm("已有相同工程項目。是否新增另一位置／尺寸的明細？")
    )
      return;
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        itemId: s.id,
        itemSnapshot: structuredClone(s),
        position: s.scope ?? "",
        length: 0,
        width: 0,
        dimensionUnit: "呎",
        quantity: 1,
        style: s.allowPending ? "待選" : "",
        notes: "",
      },
    ]);
    setPicker(false);
  }
  function update(index: number, values: Partial<QuoteLine>) {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...values } : l)));
  }
  function changeDimensionUnit(index: number, unit: "呎" | "寸") {
    const line = lines[index];
    if (!line || line.dimensionUnit === unit) return;
    const factor =
      line.dimensionUnit === "呎" && unit === "寸"
        ? 12
        : line.dimensionUnit === "寸" && unit === "呎"
          ? 1 / 12
          : 1;
    update(index, {
      dimensionUnit: unit,
      length: line.length ? roundDimension(line.length * factor) : 0,
      width: line.width ? roundDimension(line.width * factor) : 0,
    });
  }
  const linkedSource = linkedPrompt
    ? lines.find((line) => line.id === linkedPrompt)
    : undefined;
  const linkedChoices = (linkedSource?.itemSnapshot.linkedServiceIds ?? [])
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is ServiceItem => Boolean(service))
    .filter(
      (service) => !lines.some((line) => line.itemId === service.id),
    );
  function addLinkedWorks() {
    if (!linkedChoices.length) {
      setLinkedPrompt(null);
      return;
    }
    setLines([
      ...lines,
      ...linkedChoices.map((service) => ({
        id: crypto.randomUUID(),
        itemId: service.id,
        itemSnapshot: structuredClone(service),
        position: service.scope ?? "",
        length: 0,
        width: 0,
        dimensionUnit: "呎" as const,
        quantity: 1,
        style: service.allowPending ? "待選" : "",
        notes: "",
      })),
    ]);
    setLinkedPrompt(null);
  }
  const customerCandidates = engine
    .listCustomers(actor)
    .map((profile) => profile.customer);
  return (
    <>
      <PageHead
        eyebrow={
          existing
            ? `${existing.number} · 版本 ${base?.index}`
            : "報價管理 / 新報價"
        }
        title={existing ? "修改報價" : "建立報價"}
        actions={
          <>
            <Button
              onClick={() =>
                nav(existing ? "/quotes/" + existing.id : "/quotes")
              }
            >
              返回
            </Button>
            <Button variant="primary" onClick={() => save("draft")}>
              <Check size={20} />
              {clerkEditor ? "儲存更正" : "儲存草稿"}
            </Button>
          </>
        }
      />
      {clerkEditor && (
        <p className="inline-warning">
          開單員更正模式：儲存後會建立新版本，項目及價錢會更新；原版本保留，
          需要重新準備列印、客戶簽署及提交Office。
        </p>
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <Section
            number="01"
            title="客戶資料"
            action={
              <Button onClick={() => setCustomers(true)}>選擇現有客戶</Button>
            }
          >
            <CustomerForm value={customer} onChange={setCustomer} />
          </Section>
          <Section
            number="02"
            title="工程項目"
            action={
              <Button onClick={() => setPicker(true)}>
                <Plus size={20} />
                新增工程
              </Button>
            }
          >
            {lines.length === 0 ? (
              <Empty
                title="加入今次需要做的工程"
                description="選工程，再輸入現場尺寸及位置。"
                action={
                  <Button onClick={() => setPicker(true)}>
                    <Plus size={20} />
                    選擇工程
                  </Button>
                }
              />
            ) : (
              <div className="quote-lines">
                {lines.map((l, i) => {
                  const s = l.itemSnapshot,
                    a = pricing.lineAmounts.find((a) => a.id === l.id);
                  return (
                    <article className="line-card" key={l.id}>
                      <div className="line-head">
                        <span className="line-index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h3>{s.name}</h3>
                          {s.details && (
                            <small className="line-service-details">
                              {s.details}
                            </small>
                          )}
                          <span className="muted">
                            {money(s.price)}／{s.unit}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          aria-label={`移除${s.name}`}
                          onClick={() =>
                            setLines(lines.filter((_, n) => n !== i))
                          }
                        >
                          <Trash2 size={20} />
                        </Button>
                      </div>
                      <div className="form-grid line-inputs">
                        {s.measure === "area" || s.measure === "length" ? (
                          <>
                            <Field
                              label={
                                s.measure === "area" ? "長度" : "長度／尺數"
                              }
                              required
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={l.length || ""}
                                onChange={(e) =>
                                  update(i, { length: Number(e.target.value) })
                                }
                              />
                            </Field>
                            {s.measure === "area" && (
                              <Field label="闊度" required>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={l.width || ""}
                                  onChange={(e) =>
                                    update(i, { width: Number(e.target.value) })
                                  }
                                />
                              </Field>
                            )}
                            <Field label="單位">
                              <select
                                value={l.dimensionUnit}
                                onChange={(event) =>
                                  changeDimensionUnit(
                                    i,
                                    event.target.value as "呎" | "寸",
                                  )
                                }
                              >
                                <option value="呎">呎</option>
                                <option value="寸">寸</option>
                              </select>
                            </Field>
                          </>
                        ) : (
                          <Field
                            label={
                              s.measure === "fixed" ? "項目數量" : "數量／套數"
                            }
                            required
                          >
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={l.quantity}
                              onChange={(e) =>
                                update(i, { quantity: Number(e.target.value) })
                              }
                            />
                          </Field>
                        )}
                        {s.options.length > 0 && (
                          <Field label="款式／顏色">
                            <select
                              value={l.style}
                              onChange={(e) =>
                                update(i, { style: e.target.value })
                              }
                            >
                              {s.allowPending && <option>待選</option>}
                              {!s.allowPending && (
                                <option value="">選擇款式</option>
                              )}
                              {s.options.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          </Field>
                        )}
                      </div>
                      {s.measure === "area" || s.measure === "length" ? (
                        <div className="measurement-conversion">
                          {s.measure === "area"
                            ? `輸入 ${l.length || 0} × ${l.width || 0} ${l.dimensionUnit} = ${roundDimension(feetNumber(l.length, l.dimensionUnit))} × ${roundDimension(feetNumber(l.width, l.dimensionUnit))} ${s.unit}`
                            : `輸入 ${l.length || 0} ${l.dimensionUnit} = ${roundDimension(feetNumber(l.length, l.dimensionUnit))} ${s.unit}`}
                          {a?.billedQty
                            ? ` · 計費 ${a.billedQty} ${s.unit}`
                            : ""}
                        </div>
                      ) : null}
                      <div className="quote-product-style">
                        <span className="field-label">產品款式</span>
                        {l.productStyle ? (
                          <div className="quote-product-style-selected">
                            <QuoteStyleThumb snapshot={l.productStyle} />
                            <div>
                              <strong>
                                {l.productStyle.factoryName} ·{" "}
                                {l.productStyle.seriesName}
                              </strong>
                              <small>{l.productStyle.productCode}</small>
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setStyleCategory("all");
                                setStyleFactoryId("");
                                setStyleLineIndex(i);
                              }}
                            >
                              更改
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                update(i, { productStyle: undefined })
                              }
                            >
                              移除
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => {
                              setStyleCategory("all");
                              setStyleFactoryId("");
                              setStyleLineIndex(i);
                            }}
                          >
                            選擇產品款式
                          </Button>
                        )}
                      </div>
                      <details className="line-notes">
                        <summary>現場要求及注意事項（選填）</summary>
                        <textarea
                          rows={2}
                          value={l.notes}
                          placeholder="客戶要求、施工難點或需要特別留意的位置"
                          onChange={(e) => update(i, { notes: e.target.value })}
                        />
                      </details>
                      <div className="line-footer">
                        <span>
                          {a?.minApplied
                            ? `按最低 ${a.billedQty} ${s.unit}計費`
                            : s.details || "按現場實際範圍計價"}
                        </span>
                        <strong>{money(a?.preDiscount || 0)}</strong>
                      </div>
                      {(s.linkedServiceIds ?? []).some(
                        (id) => !lines.some((line) => line.itemId === id),
                      ) && (
                        <button
                          type="button"
                          className="linked-quote-button"
                          onClick={() => setLinkedPrompt(l.id)}
                        >
                          <Plus size={17} />
                          需要加連貫工程？
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Section>
          {base?.signature && (
            <Section title="版本修改原因">
              <Field label="修改原因" required>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="儲存後建立新版本，原簽署版本保留。"
                />
              </Field>
            </Section>
          )}
        </div>
        <aside className="quote-summary">
          <h2>報價摘要</h2>
          <div className="summary-row">
            <span>工程小計</span>
            <strong>{money(pricing.subtotal)}</strong>
          </div>
          <Field label="全單折扣">
            <select
              value={discountMode === "rate" ? ratePreset : discountMode}
              onChange={(e) => {
                const choice = e.target.value;
                if (choice === "95") {
                  setDiscountMode("rate");
                  setDiscountValue(95);
                  setRatePreset("95");
                } else if (choice === "rate") {
                  setDiscountMode("rate");
                  setRatePreset("custom");
                  if (!discountValue) setDiscountValue(95);
                } else {
                  setDiscountMode(choice as DiscountMode);
                  setDiscountValue(0);
                  setRatePreset("custom");
                }
              }}
            >
              <option value="none">原價（不打折）</option>
              <option value="95">95折</option>
              <option value="rate">自訂折扣</option>
              <option value="amount">自訂扣減</option>
            </select>
          </Field>
          {discountMode === "rate" && (
            <Field label="折後百分比" hint="例如95 = 95折">
              <input
                type="number"
                min="0"
                max="100"
                step=".1"
                value={discountValue || ""}
                onChange={(e) => {
                  setRatePreset("custom");
                  setDiscountValue(Number(e.target.value));
                }}
              />
            </Field>
          )}
          {discountMode === "amount" && (
            <Field label="扣減金額（HKD）" hint="由工程小計直接扣減">
              <input
                type="number"
                min="0"
                max={pricing.subtotal}
                step=".01"
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
              />
            </Field>
          )}
          {discountMode !== "none" && (
            <div className="summary-row discount-row">
              <span>
                {discountMode === "amount" ? "本次扣減" : "折扣後扣減"}
              </span>
              <strong>−{money(pricing.subtotal - pricing.total)}</strong>
            </div>
          )}
          {discount < 0.95 && (
            <p className="inline-warning">
              低於95折將降低佣金，請先與主管商量。
            </p>
          )}
          <div className="summary-total">
            <span>成交金額</span>
            <strong>{money(pricing.total)}</strong>
          </div>
          {clerkEditor ? (
            <Button
              className="full-width"
              variant="primary"
              onClick={() => save("draft")}
            >
              儲存更正
            </Button>
          ) : (
            <Button
              className="full-width"
              variant="primary"
              onClick={() => save("deal")}
            >
              前往預覽及成交 <ArrowRight size={20} />
            </Button>
          )}
        </aside>
      </div>
      {styleLineIndex !== null && (
        <Dialog
          wide
          title="選擇產品款式"
          onClose={() => {
            setStyleLineIndex(null);
            setStyleFactoryId("");
          }}
        >
          {!styleFactory ? (
            <>
              <div className="category-chips">
                <button
                  type="button"
                  className={styleCategory === "all" ? "selected" : ""}
                  onClick={() => setStyleCategory("all")}
                >
                  全部
                </button>
                {SUPPLIER_CATEGORIES.map((category) => (
                  <button
                    type="button"
                    key={category}
                    className={styleCategory === category ? "selected" : ""}
                    onClick={() => setStyleCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {filteredStyleSuppliers.length === 0 ? (
                <p className="section-empty">
                  此分類暫未設定產品款式；請先由Super Admin建立工廠相簿。
                </p>
              ) : (
                <div className="quote-style-factories">
                  {filteredStyleSuppliers.map((supplier) => (
                    <button
                      type="button"
                      className="quote-style-factory"
                      key={supplier.id}
                      onClick={() => setStyleFactoryId(supplier.id)}
                    >
                      {supplier.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="text-button"
                onClick={() => setStyleFactoryId("")}
              >
                ← 返回工廠
              </button>
              <h3 className="quote-style-factory-title">
                {styleFactory.name}
              </h3>
              {styleSeries.length === 0 ? (
                <p className="section-empty">
                  此工廠尚未有產品款式圖片。
                </p>
              ) : (
                <div className="quote-style-series">
                  {styleSeries.map((item) => (
                    <div key={item.id}>
                      <h4>{item.name}</h4>
                      <div className="quote-style-images">
                        {item.images.map((image) => (
                          <button
                            type="button"
                            className="quote-style-image-choice"
                            key={image.id}
                            onClick={() => {
                              if (styleLineIndex === null) return;
                              update(styleLineIndex, {
                                productStyle: {
                                  supplierId: styleFactory.id,
                                  factoryName: styleFactory.name,
                                  seriesId: item.id,
                                  seriesName: item.name,
                                  imageId: image.id,
                                  productCode: image.productCode,
                                  attachment: image.attachment,
                                },
                              });
                              setStyleLineIndex(null);
                              setStyleFactoryId("");
                            }}
                          >
                            <span className="quote-style-image-frame">
                              <QuoteStylePicture
                                attachment={image.attachment}
                                alt={image.productCode}
                              />
                            </span>
                            <small>{image.productCode}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Dialog>
      )}
      {linkedPrompt && linkedSource && (
        <Dialog title="連貫工程" onClose={() => setLinkedPrompt(null)}>
          <p className="dialog-intro">
            「{linkedSource.itemSnapshot.name}」有建議連貫工程。是否一併加入報價？
          </p>
          <div className="quote-linked-list">
            {linkedChoices.length === 0 ? (
              <p className="section-empty">所有連貫工程已加入此報價。</p>
            ) : (
              linkedChoices.map((service) => (
                <div className="quote-linked-row" key={service.id}>
                  <strong>{service.name}</strong>
                  {service.details && <small>{service.details}</small>}
                </div>
              ))
            )}
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setLinkedPrompt(null)}>暫不加入</Button>
            <Button
              variant="primary"
              disabled={linkedChoices.length === 0}
              onClick={addLinkedWorks}
            >
              加入連貫工程
            </Button>
          </div>
        </Dialog>
      )}
      {picker && (
        <Dialog wide title="新增工程項目" onClose={() => setPicker(false)}>
          <Search
            value={itemSearch}
            onChange={setItemSearch}
            placeholder="搜尋工程名稱"
          />
          <div className="category-chips">
            {categories.map((c) => (
              <button
                className={cat === c ? "selected" : ""}
                key={c}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="service-options">
            {services
              .filter(
                (s) =>
                  (cat === "全部" || s.category === cat) &&
                  `${s.name}${s.code}`.includes(itemSearch),
              )
              .map((s) => (
                <button
                  key={s.id}
                  className="service-option"
                  onClick={() => add(s)}
                >
                  <span className="service-option-main">
                    <strong>{s.name}</strong>
                    <small>
                      {s.category} · {s.details || s.notes}
                    </small>
                  </span>
                  <span className="numeric">
                    {money(s.price)}
                    <small>／{s.unit}</small>
                  </span>
                </button>
              ))}
          </div>
          <p className="muted">初階原型示例價，未當作公司正式天書價目。</p>
        </Dialog>
      )}
      {customers && (
        <Dialog title="選擇現有客戶" onClose={() => setCustomers(false)}>
          {customerCandidates.length === 0 ? (
            <p>暫無可重用的客戶，請在報價填寫新客戶資料。</p>
          ) : (
            customerCandidates.map((c) => (
              <button
                className="customer-option"
                key={c.phone}
                onClick={() => {
                  setCustomer(structuredClone(c));
                  setCustomers(false);
                }}
              >
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.phone} · {c.district} · {c.estate}
                  </small>
                </span>
                <ArrowUpRight size={22} />
              </button>
            ))
          )}
        </Dialog>
      )}
    </>
  );
}
export function PaymentDialog({
  quoteId,
  onClose,
}: {
  quoteId: string;
  onClose: () => void;
}) {
  const { actor, engine, run } = useApp();
  const [input, setInput] = useState<PaymentInput>({
    amount: 1500,
    method: "cash",
    date: DEMO_TODAY,
    custody: "sales",
    reference: "",
    notes: "",
  });
  return (
    <Dialog title="登記客戶付款" onClose={onClose}>
      <div className="form-grid two">
        <Field label="付款金額（HKD）" required>
          <input
            type="number"
            min=".01"
            step=".01"
            value={input.amount || ""}
            onChange={(e) =>
              setInput({ ...input, amount: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="付款方式" required>
          <select
            value={input.method}
            onChange={(e) => {
              const method = e.target.value as PaymentInput["method"];
              setInput({
                ...input,
                method,
                custody: method === "cash" ? "sales" : "company",
              });
            }}
          >
            {Object.entries(METHOD_NAMES).map(([key, val]) => (
              <option value={key} key={key}>
                {val}
              </option>
            ))}
          </select>
        </Field>
        <Field label="實際收款日期" required>
          <input
            type="date"
            value={input.date}
            onChange={(e) => setInput({ ...input, date: e.target.value })}
          />
        </Field>
        <Field label="收款／保管位置">
          <select
            value={input.custody}
            onChange={(e) =>
              setInput({
                ...input,
                custody: e.target.value as "sales" | "company",
              })
            }
          >
            <option value="sales">Sales保管</option>
            <option value="company">公司戶口／公司</option>
          </select>
        </Field>
      </div>
      <Field label="交易／支票參考">
        <input
          value={input.reference || ""}
          onChange={(e) => setInput({ ...input, reference: e.target.value })}
        />
      </Field>
      <Field label="付款證明">
        <UploadField
          label="上載付款證明"
          attachment={input.proof}
          onSave={(proof) => setInput({ ...input, proof })}
          onClear={() => setInput({ ...input, proof: undefined })}
        />
      </Field>
      <Field label="備註">
        <textarea
          value={input.notes || ""}
          onChange={(e) => setInput({ ...input, notes: e.target.value })}
        />
      </Field>
      <p className="muted">這是付款登記，會計核對後才算有效收款。</p>
      <div className="dialog-actions">
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="primary"
          onClick={() => {
            const p = run(
              () => engine.recordPayment(actor, quoteId, input),
              "付款已登記，待會計核對。",
            );
            if (p) onClose();
          }}
        >
          儲存付款記錄
        </Button>
      </div>
    </Dialog>
  );
}
export function QuoteDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [prepare, setPrepare] = useState(false);
  const [printDate, setPrintDate] = useState(DEMO_TODAY);
  const [printSupervisor, setPrintSupervisor] = useState("");
  const [payment, setPayment] = useState(false);
  const [archive, setArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState("customer_rejected");
  const [archiveNote, setArchiveNote] = useState("");
  const [additionalOrder, setAdditionalOrder] = useState(false);
  const [parentQuoteId, setParentQuoteId] = useState("");
  let q: Quote | undefined;
  try {
    q = engine.getQuote(actor, id);
  } catch {}
  if (!q)
    return (
      <Empty
        title="沒有這張報價的查看權限"
        action={
          <Button onClick={() => nav(quoteListPath(actor.role))}>返回</Button>
        }
      />
    );
  const v = currentVersion(q),
    p = engine.pricing(actor, id),
    e = engine.eligibility(actor, id);
  const own = salesRoles.includes(actor.role) && q.ownerId === actor.id;
  const canEditOrderMeta = own && !q.archived && !q.invoiceId;
  const ownPreviousQuotes = engine
    .listQuotes(actor)
    .filter((item) => item.ownerId === actor.id && item.id !== q.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  useEffect(() => {
    setAdditionalOrder(Boolean(q.isAdditionalOrder));
    setParentQuoteId(q.parentQuoteId ?? "");
  }, [q.id, q.isAdditionalOrder, q.parentQuoteId]);
  const preparation = v.printPreparation;
  let payments = [] as ReturnType<typeof engine.listPayments>;
  try {
    payments = engine.listPayments(actor).filter((x) => x.quoteId === id);
  } catch {}
  const canArchive =
    own &&
    !q.archived &&
    !q.submission &&
    !q.invoiceId &&
    payments.length === 0;
  const supervisors = engine
    .listActors()
    .filter(
      (a) =>
        a.role === "head" ||
        (a.role === "supervisor" && a.team === q!.team),
    );
  const audit = engine.listAudit(actor, id);
  return (
    <>
      <PageHead
        eyebrow={`${q.number} · 版本 ${v.index}`}
        title={v.customer.name ? `${v.customer.name}的報價` : "報價詳情"}
        actions={
          <>
            <Button onClick={() => nav(quoteListPath(actor.role))}>
              返回列表
            </Button>
            <Button
              onClick={() =>
                own && !preparation
                  ? setPrepare(true)
                  : nav("/documents/quote/" + id)
              }
            >
              <Printer size={20} />
              {own && !preparation ? "準備列印報價單" : "預覽／列印報價單"}
            </Button>
            {own && !q.archived && !q.invoiceId && !q.submission && (
              <Button onClick={() => nav("/quotes/" + id + "/edit")}>
                <PenLine size={20} />
                修改報價
              </Button>
            )}
            {canArchive && (
              <Button variant="danger" onClick={() => setArchive(true)}>
                <Archive size={20} />
                封存報價
              </Button>
            )}
          </>
        }
      />
      <Progress q={q} e={e} />
      <div className="detail-layout">
        <div>
          <Section
            title="工程內容"
            action={<Badge strong={e.hasSubmission}>{e.label}</Badge>}
          >
            <div className="customer-strip">
              <strong>{v.customer.name || "未填客戶"}</strong>
              <span>{v.customer.phone}</span>
              <span>{v.customer.address || "工程地址待填"}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>工程項目／位置</th>
                    <th>尺寸／數量</th>
                    <th className="numeric">折前金額</th>
                  </tr>
                </thead>
                <tbody>
                  {v.lines.map((l) => {
                    const a = p.lineAmounts.find((a) => a.id === l.id);
                    return (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.itemSnapshot.name}</strong>
                          <small>
                            {l.position}
                            {l.style ? " · " + l.style : ""}
                          </small>
                          {l.productStyle && (
                            <div className="quote-detail-style">
                              <QuoteStyleThumb snapshot={l.productStyle} />
                              <small>
                                {l.productStyle.factoryName} ·{" "}
                                {l.productStyle.seriesName} ·{" "}
                                {l.productStyle.productCode}
                              </small>
                            </div>
                          )}
                        </td>
                        <td>
                          {l.itemSnapshot.measure === "area"
                            ? `${l.length} × ${l.width} ${l.dimensionUnit}`
                            : l.itemSnapshot.measure === "length"
                              ? `${l.length} ${l.dimensionUnit}`
                              : l.itemSnapshot.measure === "fixed"
                                ? "一式"
                                : `${l.quantity} ${l.itemSnapshot.unit}`}
                          {(l.itemSnapshot.measure === "area" ||
                            l.itemSnapshot.measure === "length") && (
                            <small>
                              換算{" "}
                              {l.itemSnapshot.measure === "area"
                                ? `${roundDimension(feetNumber(l.length, l.dimensionUnit))} × ${roundDimension(feetNumber(l.width, l.dimensionUnit))}`
                                : roundDimension(
                                    feetNumber(l.length, l.dimensionUnit),
                                  )}{" "}
                              {l.itemSnapshot.unit}
                            </small>
                          )}
                          {a?.minApplied && (
                            <small>
                              按最低 {a.billedQty} {l.itemSnapshot.unit}計費
                            </small>
                          )}
                        </td>
                        <td className="numeric money">
                          {money(a?.preDiscount || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
          {own && !q.archived && (
            <Section
              number="01"
              title="客戶簽署"
              action={
                v.signature && (
                  <Badge strong>
                    <Check size={16} />
                    已確認
                  </Badge>
                )
              }
            >
              {v.signature ? (
                <div className="completed-row">
                  <FileCheck2 size={25} />
                  <div>
                    <strong>客戶已簽版本 {v.index}</strong>
                    <p>
                      {v.signature.date} ·{" "}
                      {
                        engine
                          .listActors()
                          .find((a) => a.id === v.signature?.supervisorId)?.name
                      }
                    </p>
                  </div>
                </div>
              ) : !preparation ? (
                <div className="print-readiness">
                  <Printer size={28} />
                  <div>
                    <strong>先準備正式報價單，才可交客人簽署</strong>
                    <p>確認當日主管後會產生報價號，再開啟紙本預覽。</p>
                  </div>
                  <Button variant="primary" onClick={() => setPrepare(true)}>
                    準備列印報價單
                  </Button>
                </div>
              ) : (
                <>
                  <div className="prepared-quote">
                    <span>正式報價號</span>
                    <strong>{preparation.quoteNumber}</strong>
                    <span>列印／簽署日期</span>
                    <strong>{preparation.date}</strong>
                    <span>當日主管</span>
                    <strong>
                      {
                        engine
                          .listActors()
                          .find((a) => a.id === preparation.supervisorId)?.name
                      }
                    </strong>
                  </div>
                  <p className="muted">
                    請列印此版本交客人簽署，回來上載同一份已簽紙本。若日期或主管不同，請重新準備列印。
                  </p>
                  <Field label={`已簽報價文件 · 版本 ${v.index}`} required>
                    <UploadField
                      label="上載已簽文件"
                              attachment={v.signedDocument}
                      onSave={(attachment) =>
                        engine.uploadDocument(actor, id, attachment)
                      }
                      onClear={
                        v.signature
                          ? undefined
                          : () => engine.clearSignedDocument(actor, id)
                      }
                    />
                  </Field>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />
                    我確認客戶已簽署上述正式報價版本
                  </label>
                  <Button
                    variant="primary"
                    onClick={() =>
                      run(
                        () =>
                          engine.recordSignature(actor, id, {
                            date: preparation.date,
                            supervisorId: preparation.supervisorId,
                            confirmed: confirm,
                          }),
                        "指定版本的客戶簽署已確認。",
                      )
                    }
                  >
                    <Check size={20} />
                    確認客戶已簽
                  </Button>
                </>
              )}
            </Section>
          )}
          {own && !q.archived && (
            <Section
              number="02"
              title="客戶付款登記"
              action={
                <Button
                  disabled={!v.signature}
                  title={!v.signature ? "請先確認客戶已簽報價" : undefined}
                  onClick={() => setPayment(true)}
                >
                  <Plus size={20} />
                  登記付款
                </Button>
              }
            >
              {payments.length === 0 ? (
                <p className="section-empty">
                  {v.signature
                    ? "還未登記付款。誠意金或已付首期都在這裏記錄。"
                    : "完成客戶簽署確認後，才可登記誠意金或首期付款。"}
                </p>
              ) : (
                <div className="payment-list">
                  {payments.map((pay) => (
                    <div className="payment-row" key={pay.id}>
                      <Wallet size={23} />
                      <div>
                        <strong>{money(pay.amount)}</strong>
                        <small>
                          {METHOD_NAMES[pay.method]} ·{" "}
                          {pay.custody === "sales" ? "Sales保管" : "公司"} ·{" "}
                          {pay.date}
                        </small>
                      </div>
                      <Badge strong={pay.status === "valid"}>
                        {pay.status === "valid"
                          ? "會計已核"
                          : pay.status === "rejected"
                            ? "待補資料"
                            : "待會計核對"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
          {own && !q.archived && (
            <Section number="03" title="交Office跟進">
              {q.submission ? (
                <div className="completed-row office-submission-card">
                  <Send size={25} />
                  <div>
                    <strong>已提交Office</strong>
                    <p>{e.nextAction}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="checklist">
                    <div className={!!v.signature ? "complete" : ""}>
                      <Check size={19} />
                      指定版本已簽署
                    </div>
                    <div className={e.hasDocument ? "complete" : ""}>
                      <Check size={19} />
                      已上載簽署文件
                    </div>
                    <div className={payments.length ? "complete" : ""}>
                      <Check size={19} />
                      至少一筆付款已登記
                    </div>
                  </div>
                  {e.missing.length > 0 && (
                    <div className="missing-note">
                      <strong>尚未完成</strong>
                      <p>{e.missing.join("、")}</p>
                      {e.missing.some((s) =>
                        /客戶|地址|電話|備註|附件|位置|尺|數量/.test(s),
                      ) && (
                        <Button onClick={() => nav("/quotes/" + id + "/edit")}>
                          補齊報價資料
                        </Button>
                      )}
                    </div>
                  )}
                  <Button
                    variant="primary"
                    className="office-submit-button"
                    disabled={e.missing.length > 0}
                    title={
                      e.missing.length > 0
                        ? "請先完成上方提示的成交步驟"
                        : undefined
                    }
                    onClick={() =>
                      run(
                        () => engine.submitOffice(actor, id),
                        "已交Office；開單、會計及CS將按同一來源跟進。",
                      )
                    }
                  >
                    <Send size={20} />
                    提交Office
                  </Button>
                </>
              )}
            </Section>
          )}
          {audit.length > 0 && (
            <Section title="處理紀錄">
              <div className="audit-list">
                {audit
                  .slice()
                  .reverse()
                  .slice(0, 7)
                  .map((a) => (
                    <div key={a.id}>
                      <span className="audit-dot" />
                      <div>
                        <strong>{a.action}</strong>
                        <p>{a.detail}</p>
                        <small>
                          {
                            engine.listActors().find((x) => x.id === a.actorId)
                              ?.name
                          }{" "}
                          · {a.at.slice(0, 16).replace("T", " ")}
                        </small>
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          )}
        </div>
        <aside className="quote-summary">
          <span className="eyebrow">版本 {v.index} 的金額</span>
          <h2>成交摘要</h2>
          <div className="summary-row">
            <span>工程小計</span>
            <strong>{money(p.subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>全單折扣</span>
            <strong>
              {discountLabel(v.discount, v.discountMode, v.discountValue)}
            </strong>
          </div>
          <div className="summary-total">
            <span>成交金額</span>
            <strong>{money(p.total)}</strong>
          </div>
          <div className="summary-order-block">
            <span className="summary-order-label">訂單分類</span>
            <div className="order-category-chips">
              {(Object.keys(INVOICE_CATEGORY_NAMES) as InvoiceCategory[]).map(
                (category) => {
                  const active = (q.orderCategories ?? []).includes(category);
                  return (
                    <button
                      type="button"
                      key={category}
                      className={active ? "selected" : ""}
                      disabled={!canEditOrderMeta}
                      onClick={() => {
                        const current = q.orderCategories ?? [];
                        const next = active
                          ? current.filter((item) => item !== category)
                          : [...current, category];
                        run(
                          () =>
                            engine.updateQuoteOrderMeta(actor, q.id, {
                              orderCategories: next,
                            }),
                          "訂單分類已更新。",
                        );
                      }}
                    >
                      {INVOICE_CATEGORY_NAMES[category]}
                    </button>
                  );
                },
              )}
            </div>
            {(q.orderCategories?.length ?? 0) > 1 && (
              <small className="summary-order-hint">
                多於一個分類時，收款計劃按自費 ＞ 8萬資助 ＞ 團購的優先次序計算。
              </small>
            )}
          </div>
          <div className="summary-order-block">
            <span className="summary-order-label">是否加單？</span>
            <div className="additional-order-options">
              <button
                type="button"
                className={!additionalOrder ? "selected" : ""}
                disabled={!canEditOrderMeta}
                onClick={() => {
                  setAdditionalOrder(false);
                  setParentQuoteId("");
                  run(
                    () =>
                      engine.updateQuoteOrderMeta(actor, q.id, {
                        isAdditionalOrder: false,
                      }),
                    "已設為非加單。",
                  );
                }}
              >
                不是
              </button>
              <button
                type="button"
                className={additionalOrder ? "selected" : ""}
                disabled={!canEditOrderMeta}
                onClick={() => setAdditionalOrder(true)}
              >
                是
              </button>
            </div>
            {additionalOrder && (
              <select
                aria-label="原本報價單"
                value={parentQuoteId}
                disabled={!canEditOrderMeta}
                onChange={(event) => {
                  const value = event.target.value;
                  setParentQuoteId(value);
                  if (!value) return;
                  run(
                    () =>
                      engine.updateQuoteOrderMeta(actor, q.id, {
                        isAdditionalOrder: true,
                        parentQuoteId: value,
                      }),
                    "加單資料已更新。",
                  );
                }}
              >
                <option value="">選擇自己之前的報價單</option>
                {ownPreviousQuotes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.number} · {currentVersion(item).customer.name} ·{" "}
                    {item.createdAt.slice(0, 10)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Badge strong={e.hasInvoice}>{e.label}</Badge>
          {q.invoiceId && (
            <Button
              className="full-width"
              onClick={() => nav("/documents/invoice/" + q!.invoiceId)}
            >
              查看Invoice <ArrowRight size={20} />
            </Button>
          )}
        </aside>
      </div>
      {prepare && (
        <Dialog title="準備列印正式報價單" onClose={() => setPrepare(false)}>
          <p>
            這一步會以當日主管及Sales代號生成正式報價號；完成後開啟列印預覽。這不是Invoice，亦未提交Office。
          </p>
          <div className="form-grid two">
            <Field label="列印／簽署日期" required>
              <input
                type="date"
                max={DEMO_TODAY}
                value={printDate}
                onChange={(e) => setPrintDate(e.target.value)}
              />
            </Field>
            <Field label="當日主管" required>
              <select
                value={printSupervisor}
                onChange={(e) => setPrintSupervisor(e.target.value)}
              >
                <option value="">選擇當日主管</option>
                {supervisors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setPrepare(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ready = run(
                  () =>
                    engine.prepareQuoteForPrint(actor, id, {
                      date: printDate,
                      supervisorId: printSupervisor,
                    }),
                  "已鎖定正式報價號，現在可列印交客人簽署。",
                );
                if (ready) {
                  setPrepare(false);
                  nav("/documents/quote/" + id);
                }
              }}
            >
              <Printer size={20} />
              確認並開啟報價單
            </Button>
          </div>
        </Dialog>
      )}
      {archive && (
        <Dialog title="封存這張報價？" onClose={() => setArchive(false)}>
          <p className="dialog-intro">
            封存後會移入「封存」列表，不能再修改、簽署、登記付款、提交Office或開Invoice。
          </p>
          <Field label="封存原因" required>
            <select
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
            >
              <option value="customer_rejected">客戶拒絕報價</option>
              <option value="no_follow_up">客戶暫不跟進</option>
              <option value="duplicate">重複／錯誤草稿</option>
              <option value="other">其他</option>
            </select>
          </Field>
          <Field label="補充說明（選填）">
            <textarea
              value={archiveNote}
              onChange={(event) => setArchiveNote(event.target.value)}
              placeholder="例如客戶決定延後裝修"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setArchive(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                const archived = run(() => {
                  engine.archiveQuote(actor, id, {
                    reason: archiveReason as
                      | "customer_rejected"
                      | "no_follow_up"
                      | "duplicate"
                      | "other",
                    note: archiveNote,
                  });
                  return true;
                }, "報價已封存，不會再出現在日常待辦。");
                if (archived) {
                  setArchive(false);
                  nav("/quotes?tab=archived");
                }
              }}
            >
              <Archive size={20} />
              確認封存
            </Button>
          </div>
        </Dialog>
      )}
      {payment && (
        <PaymentDialog quoteId={id} onClose={() => setPayment(false)} />
      )}
    </>
  );
}

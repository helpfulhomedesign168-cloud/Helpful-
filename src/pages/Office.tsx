import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  FileText,
  Plus,
  Hammer,
  Printer,
  PenLine,
} from "lucide-react";
import {
  useApp,
  showAttachment,
  getAttachmentBlob,
  saveAttachment,
} from "../context";
import {
  Badge,
  Button,
  CategoryChips,
  Dialog,
  Empty,
  Field,
  PageHead,
  Search,
  Section,
  UploadField,
  Pagination,
  usePagination,
} from "../components/ui";
import {
  Attachment,
  Payment,
  Quote,
  HandoffRow,
  DEMO_TODAY,
  METHOD_NAMES,
  currentVersion,
  money,
  WorkOrder,
  Invoice,
  InvoiceCategory,
  INVOICE_CATEGORY_NAMES,
  ROLE_NAMES,
  Assignment,
  EXTRA_WORK_LABELS,
  ExtraWorkKind,
  ExtraWork,
  Resource,
  ResourceFeeMode,
} from "../domain/types";

type ProofPreview =
  | { kind: "loading" }
  | { kind: "image"; url: string }
  | { kind: "file" }
  | { kind: "missing" };
function OrderStyleThumb({
  attachment,
}: {
  attachment: Attachment;
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
    <img className="order-style-thumb" src={url} alt="產品款式" />
  ) : (
    <span className="order-style-thumb order-style-thumb-empty" />
  );
}

const RESOURCE_FEE_LABELS: Record<ResourceFeeMode, string> = {
  project60: "項目6成",
  daily: "日薪",
  fixed: "固定價",
};

function resourceOptionLabel(resource: Resource) {
  return resource.mainWork
    ? `${resource.name}（${resource.mainWork}）`
    : resource.name;
}

function ProofThumb({ attachment }: { attachment: Attachment }) {
  const { run } = useApp();
  const [preview, setPreview] = useState<ProofPreview>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setPreview({ kind: "loading" });
    getAttachmentBlob(attachment)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setPreview({ kind: "missing" });
          return;
        }
        const mime = blob.type || attachment.mime || "";
        if (mime.startsWith("image/")) {
          objectUrl = URL.createObjectURL(blob);
          setPreview({ kind: "image", url: objectUrl });
          return;
        }
        setPreview({ kind: "file" });
      })
      .catch(() => {
        if (!cancelled) setPreview({ kind: "missing" });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (preview.kind === "loading")
    return (
      <span className="proof-thumb proof-thumb-loading" aria-hidden="true">
        <FileText size={20} />
      </span>
    );
  if (preview.kind === "missing")
    return (
      <span
        className="proof-thumb proof-thumb-missing"
        role="img"
        aria-label={`${attachment.name}未附原件`}
        title="未附原件"
      >
        <FileText size={20} />
      </span>
    );
  return (
    <button
      type="button"
      className="proof-thumb"
      aria-label={`開啟 ${attachment.name}`}
      title={attachment.name}
      onClick={() =>
        showAttachment(attachment).catch((error) =>
          run(() => {
            throw error;
          }),
        )
      }
    >
      {preview.kind === "image" ? (
        <img src={preview.url} alt="" />
      ) : (
        <FileText size={21} />
      )}
    </button>
  );
}
export function Finance() {
  const { actor, engine, run } = useApp();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Payment | null>(null);
  const [date, setDate] = useState(DEMO_TODAY);
  const [cleared, setCleared] = useState(false);
  const [notes, setNotes] = useState("");
  const payments = engine.listPayments(actor);
  const nav = useNavigate();
  const shown = [...payments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((p) => tab === "all" || p.status === "pending")
    .filter((p) => {
      let q;
      try {
        q = engine.getQuote(actor, p.quoteId);
      } catch {}
      return `${q?.number || ""} ${q ? currentVersion(q).customer.name : ""} ${p.reference}`.includes(
        search,
      );
    });
  const pager = usePagination(shown, `${tab}|${search}`);
  return (
    <>
      <PageHead eyebrow="會計工作區" title="收款核對" />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋報價、客戶或交易參考"
          />
        </div>
        <div className="tabs">
          <button
            className={tab === "pending" ? "selected" : ""}
            onClick={() => setTab("pending")}
          >
            待核對{" "}
            <span>{payments.filter((p) => p.status === "pending").length}</span>
          </button>
          <button
            className={tab === "all" ? "selected" : ""}
            onClick={() => setTab("all")}
          >
            全部收款 <span>{payments.length}</span>
          </button>
        </div>
        {shown.length === 0 ? (
          <Empty
            title="暫無待核對的收款"
            description="Sales交Office的付款會在這裏出現。"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>來源／客戶</th>
                  <th>方式／收款位置</th>
                  <th className="numeric">本筆金額</th>
                  <th>首期進度</th>
                  <th>狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pager.items.map((pay) => {
                  const q = engine.getQuote(actor, pay.quoteId),
                    e = engine.eligibility(actor, pay.quoteId);
                  return (
                    <tr key={pay.id}>
                      <td>
                        <strong>{q.number}</strong>
                        <small>
                          {currentVersion(q).customer.name} · {pay.date}
                        </small>
                      </td>
                      <td>
                        {METHOD_NAMES[pay.method]}
                        <small>
                          {pay.custody === "sales"
                            ? "Sales保管"
                            : "公司戶口／公司"}
                        </small>
                      </td>
                      <td className="numeric money">{money(pay.amount)}</td>
                      <td>
                        <strong>已核 {money(e.validPaid)}</strong>
                        <small>首期應收 {money(e.firstDue)}</small>
                      </td>
                      <td>
                        <Badge strong={pay.status === "valid"}>
                          {pay.status === "valid"
                            ? "已核對"
                            : pay.status === "rejected"
                              ? "退回補資料"
                              : "待核對"}
                        </Badge>
                      </td>
                      <td>
                        {pay.status === "pending" ? (
                          <Button
                            onClick={() => {
                              setActive(pay);
                              setCleared(false);
                              setNotes("");
                            }}
                          >
                            核對收款
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => nav("/quotes/" + q.id)}
                          >
                            <ArrowUpRight size={22} />
                          </Button>
                        )}
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
      {active && (
        <Dialog title="核對這筆客戶收款" onClose={() => setActive(null)}>
          <div className="review-amount">
            <span>
              {METHOD_NAMES[active.method]} ·{" "}
              {active.custody === "sales" ? "Sales保管" : "公司"}
            </span>
            <strong>{money(active.amount)}</strong>
          </div>
          <div className="review-details">
            <div>
              <span>來源報價</span>
              <strong>{engine.getQuote(actor, active.quoteId).number}</strong>
            </div>
            <div>
              <span>交易參考</span>
              <strong>{active.reference || "未填／現金記錄"}</strong>
            </div>
          </div>
          {active.proof && (
            <Button
              onClick={() =>
                showAttachment(active.proof!).catch((e) =>
                  run(() => {
                    throw e;
                  }),
                )
              }
            >
              <FileText size={20} />
              查看付款證明
            </Button>
          )}
          <Field label="有效收款日期" required>
            <input
              type="date"
              max={DEMO_TODAY}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {active.method !== "cash" && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={cleared}
                onChange={(e) => setCleared(e.target.checked)}
              />
              {active.method === "cheque"
                ? "支票已成功兌現"
                : "我已核實公司銀行收到這筆款項"}
            </label>
          )}
          <Field label="核對備註／退回原因">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="按銀行紀錄或合法現金来源核對"
            />
          </Field>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                const r = run(() => {
                  engine.validatePayment(actor, active.id, {
                    date,
                    cleared,
                    notes,
                    reject: true,
                  });
                  return true;
                }, "已退回補資料。");
                if (r) setActive(null);
              }}
            >
              退回補資料
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = run(() => {
                  engine.validatePayment(actor, active.id, {
                    date,
                    cleared,
                    notes,
                  });
                  return true;
                }, "收款已核對，首期資格已同步更新。");
                if (r) setActive(null);
              }}
            >
              <Check size={20} />
              確認有效收款
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function PaymentReviewDialog({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const { actor, engine, run } = useApp();
  const [date, setDate] = useState(DEMO_TODAY);
  const [cleared, setCleared] = useState(Boolean(payment.cleared));
  const [notes, setNotes] = useState("");
  const quote = engine.getQuote(actor, payment.quoteId);
  return (
    <Dialog title="核對這筆客戶收款" onClose={onClose}>
      <div className="review-amount">
        <span>
          {METHOD_NAMES[payment.method]} ·{" "}
          {payment.custody === "sales" ? "Sales保管" : "公司戶口／公司"}
        </span>
        <strong>{money(payment.amount)}</strong>
      </div>
      <div className="review-details">
        <div>
          <span>來源</span>
          <strong>{payment.invoiceId ? "Invoice期款" : quote.number}</strong>
        </div>
        {payment.installment && (
          <div>
            <span>付款期數</span>
            <strong>第{payment.installment}期</strong>
          </div>
        )}
        <div>
          <span>交易參考</span>
          <strong>{payment.reference || "未填／現金記錄"}</strong>
        </div>
      </div>
      <div className="payment-proof-preview">
        <span>付款證明</span>
        {payment.proof ? (
          <ProofThumb attachment={payment.proof} />
        ) : (
          <p className="muted">未上載付款證明</p>
        )}
      </div>
      <Field label="有效收款日期" required>
        <input
          type="date"
          max={DEMO_TODAY}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {payment.method !== "cash" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={cleared}
            onChange={(e) => setCleared(e.target.checked)}
          />
          {payment.method === "cheque"
            ? "支票已成功兌現"
            : "我已核實公司銀行收到這筆款項"}
        </label>
      )}
      <Field label="核對備註／退回原因">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="按銀行紀錄或合法現金來源核對"
        />
      </Field>
      <div className="dialog-actions">
        <Button
          onClick={() => {
            const done = run(() => {
              engine.validatePayment(actor, payment.id, {
                date,
                cleared,
                notes,
                reject: true,
              });
              return true;
            }, "已退回補資料。");
            if (done) onClose();
          }}
        >
          退回補資料
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const done = run(() => {
              engine.validatePayment(actor, payment.id, {
                date,
                cleared,
                notes,
              });
              return true;
            }, "收款已核對；達50%時會自動發工程部。");
            if (done) onClose();
          }}
        >
          <Check size={20} />
          確認有效收款
        </Button>
      </div>
    </Dialog>
  );
}

export function Submissions() {
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | InvoiceCategory
  >("all");
  const [teamFilter, setTeamFilter] = useState<"all" | "A" | "B">("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState<
    "all" | "new" | "additional"
  >("all");
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const parentSummaryOf = (quote: Quote) =>
    quote.parentQuoteId
      ? engine.quoteParentSummary(actor, quote.id)
      : undefined;
  const sources = engine.listQuotes(actor)
    .filter((quote) => quote.submission && !quote.invoiceId && !quote.archived)
    .filter(
      (quote) => {
        const categories = quote.orderCategories?.length
          ? quote.orderCategories
          : quote.officeCategory
            ? [quote.officeCategory]
            : [];
        return (
          (categoryFilter === "all" ||
            categories.includes(categoryFilter)) &&
          (orderFilter === "all" ||
            (orderFilter === "additional"
              ? Boolean(quote.isAdditionalOrder)
              : !quote.isAdditionalOrder)) &&
          (teamFilter === "all" || quote.team === teamFilter) &&
          (salesFilter === "all" || quote.ownerId === salesFilter) &&
          `${quote.number} ${currentVersion(quote).customer.name} ${currentVersion(quote).customer.address} ${parentSummaryOf(quote)?.number ?? ""}`.includes(
            search,
          )
        );
      },
    );
  const sortedSources = [...sources].sort((a, b) =>
    (b.submission?.createdAt ?? b.updatedAt).localeCompare(
      a.submission?.createdAt ?? a.updatedAt,
    ),
  );
  const pager = usePagination(
    sortedSources,
    `${search}|${categoryFilter}|${orderFilter}|${teamFilter}|${salesFilter}`,
  );
  const payments = engine.listPayments(actor);
  const salesActors = engine
    .listActors()
    .filter((candidate) =>
      ["sales", "supervisor", "head"].includes(candidate.role),
    );
  return (
    <>
      <PageHead title="提交報價" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程名稱或代號"
          />
          <div className="submission-filters">
            <select
              aria-label="來源分類"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as "all" | InvoiceCategory,
                )
              }
            >
              <option value="all">全部分類</option>
              {(Object.keys(INVOICE_CATEGORY_NAMES) as InvoiceCategory[]).map(
                (category) => (
                  <option key={category} value={category}>
                    {INVOICE_CATEGORY_NAMES[category]}
                  </option>
                ),
              )}
            </select>
            <select
              aria-label="單類"
              value={orderFilter}
              onChange={(event) =>
                setOrderFilter(
                  event.target.value as "all" | "new" | "additional",
                )
              }
            >
              <option value="all">全部單類</option>
              <option value="new">新訂單</option>
              <option value="additional">後加單</option>
            </select>
            <select
              aria-label="來源Team"
              value={teamFilter}
              onChange={(e) =>
                setTeamFilter(e.target.value as "all" | "A" | "B")
              }
            >
              <option value="all">全部 Team</option>
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
            <select
              aria-label="Sales"
              value={salesFilter}
              onChange={(e) => setSalesFilter(e.target.value)}
            >
              <option value="all">全部 Sales</option>
              {salesActors.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}（Team {candidate.team ?? "—"}）
                </option>
              ))}
            </select>
          </div>
        </div>
        {sources.length === 0 ? (
          <Empty
            title="暫無已提交報價"
            description="Sales完成簽署、登記付款並提交Office後，會在這裏出現。"
          />
        ) : (
          <div className="table-scroll">
            <table className="submission-table">
              <thead>
                <tr>
                  <th scope="col">報價單</th>
                  <th scope="col">日期</th>
                  <th scope="col">客戶／地區</th>
                  <th scope="col">Sales</th>
                  <th scope="col" className="numeric">成交額</th>
                  <th scope="col">分類</th>
                  <th scope="col">狀態</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((quote) => {
                  const version = currentVersion(quote);
                  const eligibility = engine.eligibility(actor, quote.id);
                  const sourcePayments = payments.filter(
                    (payment) =>
                      payment.quoteId === quote.id &&
                      payment.versionId === version.id,
                  );
                  const pending = sourcePayments.filter(
                    (payment) => payment.status === "pending",
                  );
                  const sales = salesActors.find(
                    (candidate) => candidate.id === quote.ownerId,
                  );
                  const openInvoice = () => {
                    const invoice = run(
                      () => engine.issueInvoice(actor, quote.id),
                      "Invoice已開立，已轉入單據管理。",
                    );
                    if (invoice) nav("/invoices/" + invoice.id);
                  };
                  return (
                    <tr
                      key={quote.id}
                      className="submission-clickable-row"
                      tabIndex={0}
                      onClick={() => nav(`/quotes/${quote.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          nav(`/quotes/${quote.id}`);
                        }
                      }}
                    >
                      <td>
                        <div
                          className={`submission-quote-cell ${
                            quote.isAdditionalOrder ? "additional" : ""
                          }`}
                        >
                          <div className="submission-quote-heading">
                            <strong>{quote.number}</strong>
                          </div>
                          {Boolean(quote.clerkCorrectionCount) && (
                            <small className="quote-version-marker">
                              (V{quote.clerkCorrectionCount})
                            </small>
                          )}
                          {quote.isAdditionalOrder && (
                            <small>
                              {parentSummaryOf(quote)?.number ?? "原單未能讀取"}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {(quote.submission?.createdAt ?? quote.updatedAt).slice(
                          0,
                          10,
                        )}
                      </td>
                      <td>
                        <strong>{version.customer.name}</strong>
                        <small>{version.customer.district || "地址待補"}</small>
                      </td>
                      <td>
                        <strong>{sales?.name || "未知Sales"}</strong>
                        <small>Team {quote.team}</small>
                      </td>
                      <td className="numeric money">
                        {money(engine.pricing(actor, quote.id).total)}
                      </td>
                      <td>
                        {quote.orderCategories?.length ||
                        quote.officeCategory ? (
                          <CategoryChips
                            categories={
                              quote.orderCategories?.length
                                ? quote.orderCategories
                                : [quote.officeCategory!]
                            }
                          />
                        ) : (
                          <span className="pending-value">待Sales分類</span>
                        )}
                      </td>
                      <td>
                        {pending.length > 0 ? (
                          <Button
                            variant="primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActivePayment(pending[0]);
                            }}
                          >
                            核對收款
                          </Button>
                        ) : eligibility.canIssue ? (
                          <Button
                            variant="primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvoice();
                            }}
                          >
                            已核對並開單 <ArrowRight size={18} />
                          </Button>
                        ) : (
                          <Button variant="secondary" disabled>
                            {quote.orderCategories?.length ||
                            eligibility.officeCategory
                              ? "待收款"
                              : "待Sales分類"}
                          </Button>
                        )}
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
      {activePayment && (
        <PaymentReviewDialog
          payment={activePayment}
          onClose={() => setActivePayment(null)}
        />
      )}
    </>
  );
}

export function Invoices() {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState<"all" | "A" | "B">("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [sortKey, setSortKey] = useState<
    "none" | "invoice" | "sales" | "status"
  >("none");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const actors = engine.listActors();
  const salesActors = actors.filter((candidate) =>
    ["sales", "supervisor", "head"].includes(candidate.role),
  );
  let orders = [] as WorkOrder[];
  try {
    orders = engine.listOrders(actor);
  } catch {}
  const orderByInvoice = new Map(
    orders.map((order) => [order.invoiceId, order]),
  );
  const salesName = (invoice: (typeof invoices)[number]) => {
    const quote = engine.getQuote(actor, invoice.quoteId);
    return actors.find((candidate) => candidate.id === quote.ownerId)?.name || "";
  };
  const engineeringLabel = (invoice: (typeof invoices)[number]) => {
    if (invoice.voided) return "已退訂";
    const order = orderByInvoice.get(invoice.id);
    if (order?.status === "completed") return "已完成工程";
    if (order?.csReleasedAt) return "已發工程部";
    return "待收足訂金";
  };
  const statusRank = (label: string) =>
    label === "已退訂"
      ? 4
      : label === "已完成工程"
        ? 3
        : label === "已發工程部"
          ? 2
          : 1;
  const quoteOf = (invoice: Invoice) =>
    engine.getQuote(actor, invoice.quoteId);
  const parentOf = (invoice: Invoice) => {
    const quote = quoteOf(invoice);
    return quote.parentQuoteId
      ? engine.quoteParentSummary(actor, quote.id)
      : undefined;
  };
  const statusKeyOf = (invoice: Invoice) => {
    const label = engineeringLabel(invoice);
    return label === "已退訂"
      ? "voided"
      : label === "已完成工程"
        ? "completed"
        : label === "已發工程部"
          ? "released"
          : "pending";
  };
  const invoices: Invoice[] = [...engine.listInvoices(actor)]
    .filter((invoice) => {
      const quote = quoteOf(invoice);
      const parent = parentOf(invoice);
      return (
        (statusFilter === "all" ||
          statusKeyOf(invoice) === statusFilter) &&
        (teamFilter === "all" || quote.team === teamFilter) &&
        (salesFilter === "all" || quote.ownerId === salesFilter) &&
        `${invoice.number} ${invoice.customer.name} ${invoice.customer.address} ${parent?.number ?? ""}`.includes(
          search,
        )
      );
    })
    .sort((a, b) => {
      if (sortKey === "invoice")
        return sortDir === "asc"
          ? a.number.localeCompare(b.number)
          : b.number.localeCompare(a.number);
      if (sortKey === "sales")
        return sortDir === "asc"
          ? salesName(a).localeCompare(salesName(b), "zh-Hant")
          : salesName(b).localeCompare(salesName(a), "zh-Hant");
      if (sortKey === "status")
        return sortDir === "asc"
          ? statusRank(engineeringLabel(a)) - statusRank(engineeringLabel(b))
          : statusRank(engineeringLabel(b)) - statusRank(engineeringLabel(a));
      return b.createdAt.localeCompare(a.createdAt);
    });
  const pager = usePagination(
    invoices,
    `${search}|${statusFilter}|${teamFilter}|${salesFilter}|${sortKey}|${sortDir}`,
  );
  const sortButton = (
    key: "invoice" | "sales" | "status",
    label: string,
  ) => (
    <button
      type="button"
      className={`sortable-th ${sortKey === key ? "active" : ""}`}
      onClick={() => {
        if (sortKey === key) {
          setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
          setSortKey(key);
          setSortDir("asc");
        }
      }}
    >
      {label}
      {sortKey === key ? (
        sortDir === "asc" ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )
      ) : (
        <ArrowUpDown size={13} />
      )}
    </button>
  );
  return (
    <>
      <PageHead title="單據管理" />
      <div className="list-panel">
        <div className="submission-toolbar invoice-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程名稱或代號"
          />
          <div className="submission-filters">
            <select
              aria-label="Invoice狀態"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">全部狀態</option>
              <option value="pending">待收足訂金</option>
              <option value="released">已發工程部</option>
              <option value="completed">已完成工程</option>
              <option value="voided">已退訂</option>
            </select>
            <select
              aria-label="Invoice Team"
              value={teamFilter}
              onChange={(event) =>
                setTeamFilter(event.target.value as "all" | "A" | "B")
              }
            >
              <option value="all">全部 Team</option>
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
            <select
              aria-label="Invoice Sales"
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
          </div>
        </div>
        <div className="submission-legend invoice-legend">
          <span className="normal-dot">正單</span>
          <span className="additional-dot">加單</span>
        </div>
        {invoices.length === 0 ? (
          <Empty
            title="還未開立Invoice"
            description="請先到「提交報價」完成核款及分類。"
          />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>{sortButton("invoice", "Invoice單")}</th>
                  <th>客戶／地區</th>
                  <th>{sortButton("sales", "Sales")}</th>
                  <th>收款進度</th>
                  <th>分類</th>
                  <th>{sortButton("status", "狀態")}</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((invoice) => {
                  const status = engine.invoicePaymentStatus(actor, invoice.id);
                  const quote = engine.getQuote(actor, invoice.quoteId);
                  const sales = actors.find(
                    (candidate) => candidate.id === quote.ownerId,
                  );
                  const order = orderByInvoice.get(invoice.id);
                  const engineering = engineeringLabel(invoice);
                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.createdAt.slice(0, 10)}</td>
                      <td>
                        <div
                          className={`invoice-number-cell ${
                            quote.isAdditionalOrder ? "additional" : ""
                          }`}
                        >
                          <strong>{invoice.number}</strong>
                          {quote.isAdditionalOrder && (
                            <small>
                              {engine.quoteParentSummary(actor, quote.id)
                                ?.number ?? "原單未能讀取"}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{invoice.customer.name}</strong>
                        <small>
                          {invoice.customer.district ||
                            invoice.customer.address}
                        </small>
                      </td>
                      <td>{sales?.name || "—"}</td>
                      <td>
                        <div className="payment-progress">
                          <div className="payment-progress-label">
                            <span>已核 {money(status.validPaid)}</span>
                            <strong>{status.percentPaid}%</strong>
                          </div>
                          <div
                            className="payment-progress-track"
                            role="progressbar"
                            aria-valuenow={status.percentPaid}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span
                              style={{
                                width: `${Math.min(100, status.percentPaid)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <CategoryChips
                          categories={
                            invoice.category ? [invoice.category] : []
                          }
                        />
                      </td>
                      <td>
                        <Button
                          variant={
                            engineering === "已退訂"
                              ? "danger"
                              : engineering === "已完成工程"
                                ? "primary"
                                : "secondary"
                          }
                          onClick={() => nav("/invoices/" + invoice.id)}
                        >
                          {engineering}
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
    </>
  );
}

export function InvoiceDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [paymentStage, setPaymentStage] = useState<number | null>(null);
  const [proof, setProof] = useState<Payment["proof"]>();
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<Payment["method"]>("fps");
  const [date, setDate] = useState(DEMO_TODAY);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  let invoice;
  try {
    invoice = engine.getInvoice(actor, id);
  } catch {
    return (
      <Empty
        title="沒有這張Invoice的查看權限"
        action={<Button onClick={() => nav("/invoices")}>返回單據管理</Button>}
      />
    );
  }
  const status = engine.invoicePaymentStatus(actor, invoice.id);
  const payments = engine
    .listPayments(actor)
    .filter((payment) => payment.invoiceId === invoice!.id)
    .sort(
      (a, b) =>
        a.installment! - b.installment! ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const receipts = engine
    .listReceipts(actor)
    .filter((receipt) => receipt.invoiceId === invoice!.id);
  const order = engine
    .listOrders(actor)
    .find((item) => item.invoiceId === invoice!.id);
  let cancellationCase;
  try {
    cancellationCase = engine
      .listCancellationCases(actor)
      .find((item) => item.invoiceId === invoice!.id);
  } catch {}
  const canCreateCancellation =
    actor.role === "clerk" &&
    !invoice.voided &&
    status.validPaid < invoice.netTotal * 0.5 &&
    !cancellationCase;
  const openPayment = (stage: (typeof status.installments)[number]) => {
    setPaymentStage(stage.installment);
    setAmount(Math.max(0, stage.amount - stage.received - stage.pending));
    setProof(undefined);
    setMethod("fps");
    setDate(DEMO_TODAY);
    setReference("");
    setNotes("");
  };
  const stageLabel = (stage: (typeof status.installments)[number]) =>
    `第${stage.installment}期 · ${stage.label}`;
  return (
    <>
      <PageHead
        eyebrow={`${invoice.number} · ${invoice.category ? INVOICE_CATEGORY_NAMES[invoice.category] : "歷史單據"}`}
        title={`${invoice.customer.name}的單據`}
        actions={
          <>
            <Button onClick={() => nav("/invoices")}>返回單據管理</Button>
            <Button onClick={() => nav("/documents/invoice/" + invoice.id)}>
              <Printer size={20} /> 預覽Invoice
            </Button>
            {cancellationCase && (
              <Button
                onClick={() =>
                  nav("/cancellation-cases/" + cancellationCase!.id)
                }
              >
                查看退款個案
              </Button>
            )}
            {canCreateCancellation && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                建立退款個案
              </Button>
            )}
          </>
        }
      />
      <div className="invoice-summary-grid">
        <div>
          <span>成交總額</span>
          <strong>{money(invoice.netTotal)}</strong>
        </div>
        <div>
          <span>已核有效收款</span>
          <strong>
            {money(status.validPaid)} · {status.percentPaid}%
          </strong>
        </div>
        <div>
          <span>工程部</span>
          <strong>
            {status.releasedToCS
              ? `已發工程單 ${order?.number ?? ""}`
              : `累計達 ${money(status.csReleaseDue)} 後發工程部`}
          </strong>
        </div>
      </div>
      {!status.releasedToCS && (
        <p className="release-gate-note">
          尚未發CS：累計有效收款需達 {money(status.csReleaseDue)}（成交額50%）。
          核對付款後會自動建立工程單及通知CS，毋須另按。
        </p>
      )}
      <Section
        title="收款狀況及收據"
        action={
          <Badge strong={status.completed}>
            {status.completed ? "已收清" : "收款進行中"}
          </Badge>
        }
      >
        <p className="muted">
          每筆付款先核對為有效款，之後可獨立發出收據；付款證明只在開單／會計工作區可見。
        </p>
        <div className="installment-list">
          {status.installments.map((stage) => {
            const stagePayments = payments.filter(
              (payment) => payment.installment === stage.installment,
            );
            const canAdd =
              actor.role !== "finance" &&
              stage.status !== "locked" &&
              stage.received + stage.pending < stage.amount;
            return (
              <article className="installment-card" key={stage.installment}>
                <header>
                  <div>
                    <span>
                      第{stage.installment}期 · {stage.percentage}%
                    </span>
                    <h3>{stage.label}</h3>
                  </div>
                  <Badge
                    strong={
                      stage.status === "receipted" ||
                      stage.status === "ready_receipt"
                    }
                  >
                    {stage.status === "locked"
                      ? "待前一期收足"
                      : stage.status === "under_review"
                        ? "待核對"
                        : stage.status === "ready_receipt"
                          ? "可發收據"
                          : stage.status === "receipted"
                            ? "已收妥"
                            : "待收款"}
                  </Badge>
                </header>
                <div className="installment-amounts">
                  <div>
                    <span>本期應收</span>
                    <strong>{money(stage.amount)}</strong>
                  </div>
                  <div>
                    <span>已核</span>
                    <strong>{money(stage.received)}</strong>
                  </div>
                  <div>
                    <span>累計至本期</span>
                    <strong>{money(stage.cumulativeAmount)}</strong>
                  </div>
                </div>
                {stagePayments.length ? (
                  <div className="payment-ledger">
                    {stagePayments.map((payment) => {
                      const receipt = receipts.find(
                        (item) =>
                          item.paymentId === payment.id ||
                          item.paymentIds.includes(payment.id),
                      );
                      return (
                        <div className="payment-row" key={payment.id}>
                          <div>
                            <strong>{money(payment.amount)}</strong>
                            <small>
                              {payment.date} · {METHOD_NAMES[payment.method]} ·{" "}
                              {payment.reference || "未填參考"}
                            </small>
                          </div>
                          <div className="table-actions">
                            {payment.proof && (
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  showAttachment(payment.proof!).catch(
                                    (error) =>
                                      run(() => {
                                        throw error;
                                      }),
                                  )
                                }
                              >
                                <FileText size={19} />
                                {stage.installment === 1
                                  ? "首訂證明"
                                  : "付款證明"}
                              </Button>
                            )}
                            {payment.status === "pending" ? (
                              <Button onClick={() => setActivePayment(payment)}>
                                核對收款
                              </Button>
                            ) : payment.status === "valid" ? (
                              receipt ? (
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    nav("/documents/receipt/" + receipt.id)
                                  }
                                >
                                  查看收據
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    const issued = run(
                                      () =>
                                        engine.issueReceipt(actor, payment.id),
                                      "收據已發出。",
                                    );
                                    if (issued)
                                      nav("/documents/receipt/" + issued.id);
                                  }}
                                >
                                  開收據
                                </Button>
                              )
                            ) : (
                              <Badge>已退回</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">尚未登記此期款。</p>
                )}
                {canAdd && (
                  <Button
                    className="installment-add"
                    variant="primary"
                    onClick={() => openPayment(stage)}
                  >
                    <Plus size={20} />
                    登記{stageLabel(stage)}
                  </Button>
                )}
              </article>
            );
          })}
        </div>
      </Section>
      {paymentStage && (
        <Dialog
          title={`登記第${paymentStage}期款`}
          onClose={() => setPaymentStage(null)}
        >
          <p className="muted">
            上載付款證明後先保存為待核對款項；核實銀行入帳或支票兌現後，才算有效收款。
          </p>
          <div className="form-grid two">
            <Field label="本次收款金額" required>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
            <Field label="收款日期" required>
              <input
                type="date"
                max={DEMO_TODAY}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="付款方式" required>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Payment["method"])}
              >
                {Object.entries(METHOD_NAMES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="交易參考">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="銀行／FPS／支票參考"
              />
            </Field>
          </div>
          <Field
            label="付款證明圖片（選填）"
            hint="可上載JPG、PNG或其他相片；影片不在原型範圍。"
          >
            <UploadField
              label="上載付款證明"
              attachment={proof}
              onSave={setProof}
              onClear={() => setProof(undefined)}
            />
          </Field>
          <Field label="備註">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例如付款人、銀行備註"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setPaymentStage(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const payment = run(
                  () =>
                    engine.recordInstallmentPayment(
                      actor,
                      invoice!.id,
                      paymentStage,
                      {
                        amount,
                        method,
                        date,
                        custody: "company",
                        reference,
                        notes,
                        proof,
                        cleared: method === "cash",
                      },
                    ),
                  "期款已登記，請核對為有效收款。",
                );
                if (payment) setPaymentStage(null);
              }}
            >
              儲存待核對期款
            </Button>
          </div>
        </Dialog>
      )}
      {cancelOpen && (
        <Dialog
          title="建立退款個案"
          onClose={() => {
            setCancelOpen(false);
            setCancelReason("");
          }}
        >
          <p className="dialog-intro">
            此操作只適用於付款未達50%及未開始工程的Invoice。會計將處理退款及Credit Note。
          </p>
          <Field label="退款原因" required>
            <textarea
              aria-label="退款原因"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="客人退款原因、合約條款或相關備註"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setCancelOpen(false)}>取消</Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim()}
              onClick={() => {
                const created = run(
                  () =>
                    engine.createCancellationCase(
                      actor,
                      invoice!.id,
                      cancelReason,
                    ),
                  "退款個案已建立。",
                );
                if (created) {
                  setCancelOpen(false);
                  nav("/cancellation-cases/" + created.id);
                }
              }}
            >
              建立個案
            </Button>
          </div>
        </Dialog>
      )}
      {activePayment && (
        <PaymentReviewDialog
          payment={activePayment}
          onClose={() => setActivePayment(null)}
        />
      )}
    </>
  );
}

export function Handoff() {
  const { actor, engine, run } = useApp();
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [csFilter, setCsFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [assigning, setAssigning] = useState<HandoffRow | null>(null);
  const [selectedCs, setSelectedCs] = useState("");
  const rows = engine.listHandoffs(actor);
  const salesActors = engine
    .listActors()
    .filter((candidate) =>
      ["sales", "supervisor", "head"].includes(candidate.role),
    );
  const months = [...new Set(rows.map((row) => row.releasedAt.slice(0, 7)))]
    .sort()
    .reverse();
  let csTeam = [] as ReturnType<typeof engine.listCsTeam>;
  try {
    csTeam = engine.listCsTeam(actor);
  } catch {}
  const canAssign =
    actor.role === "cs_supervisor" ||
    ["admin", "admin_staff"].includes(actor.role);
  const shown = [...rows]
    .sort((a, b) =>
      sortOrder === "newest"
        ? b.releasedAt.localeCompare(a.releasedAt)
        : a.releasedAt.localeCompare(b.releasedAt),
    )
    .filter((row) => {
      if (monthFilter !== "all" && !row.releasedAt.startsWith(monthFilter))
        return false;
      if (salesFilter !== "all" && row.salesId !== salesFilter) return false;
      if (
        csFilter !== "all" &&
        (row.csOwnerId ?? "unassigned") !== csFilter
      )
        return false;
      return `${row.workOrderNumber} ${row.quoteNumber} ${row.invoiceNumber} INV ${row.invoiceNumber} INV-${row.invoiceNumber} ${row.customerName} ${row.phone} ${row.salesName} ${row.csOwnerName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  const pager = usePagination(
    shown,
    `${search}|${monthFilter}|${salesFilter}|${csFilter}|${sortOrder}`,
  );
  return (
    <>
      <PageHead eyebrow="CS工程部" title="工程單" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程單、客戶、電話、Sales或Invoice"
          />
          <div className="submission-filters">
            <select
              aria-label="工程月份"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="all">全部月份</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
            <select
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
            <select
              aria-label="排序"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as "newest" | "oldest")
              }
            >
              <option value="newest">最新至最舊</option>
              <option value="oldest">最舊至最新</option>
            </select>
            <select
              aria-label="跟進同事"
              value={csFilter}
              onChange={(event) => setCsFilter(event.target.value)}
            >
              <option value="all">全部跟進同事</option>
              <option value="unassigned">未安排</option>
              {csTeam.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {shown.length === 0 ? (
          <Empty
            title="暫無接單資料"
            description="開單後累計有效收款達成交額50%，工程單才會自動發到這裏。"
          />
        ) : (
          <div className="table-scroll">
            <table className="handoff-table">
              <thead>
                <tr>
                  <th scope="col">工程單</th>
                  <th scope="col">客戶</th>
                  <th scope="col">聯絡電話</th>
                  <th scope="col">Sales</th>
                  <th scope="col">類別</th>
                  <th scope="col">跟進同事</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((row) => (
                  <tr key={row.quoteId}>
                    <td>
                      <strong className="source-link">
                        {row.workOrderNumber}
                      </strong>
                      <small>INV {row.invoiceNumber}</small>
                    </td>
                    <td>
                      <strong>{row.customerName}</strong>
                      <small>{row.district}</small>
                    </td>
                    <td>{row.phone}</td>
                    <td>{row.salesName}</td>
                    <td>
                      <CategoryChips categories={row.categories} />
                    </td>
                    <td>{row.csOwnerName || "未安排"}</td>
                    <td>
                      {canAssign && row.workOrderId ? (
                        <Button
                          variant={row.csOwnerName ? "secondary" : "primary"}
                          onClick={() => {
                            setSelectedCs(row.csOwnerId ?? "");
                            setAssigning(row);
                          }}
                        >
                          {row.csOwnerName ? "更改安排" : "安排工程"}{" "}
                          <ArrowRight size={18} />
                        </Button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
      {assigning && (
        <Dialog title="安排CS跟進" onClose={() => setAssigning(null)}>
          <p className="dialog-intro">
            選擇負責跟進這張工程單的CS同事。這個安排只影響跟進同事，不會改動判頭或師傅安排。
          </p>
          <Field label="跟進同事" required>
            <select
              value={selectedCs}
              onChange={(event) => setSelectedCs(event.target.value)}
            >
              <option value="">請選擇CS同事</option>
              {csTeam.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}（{ROLE_NAMES[member.role]}）
                </option>
              ))}
            </select>
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setAssigning(null)}>取消</Button>
            <Button
              variant="primary"
              disabled={!selectedCs || !assigning.workOrderId}
              onClick={() => {
                if (!assigning.workOrderId || !selectedCs) return;
                const updated = run(
                  () =>
                    engine.assignCsOwner(
                      actor,
                      assigning.workOrderId!,
                      selectedCs,
                    ),
                  "跟進同事已安排。",
                );
                if (updated) setAssigning(null);
              }}
            >
              儲存安排
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
function formatMonthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}年${Number(value)}月`;
}

type OrderFilters = {
  month: string;
  ownerId: string;
  category: string;
};

function EngineeringFilters({
  filters,
  onChange,
}: {
  filters: OrderFilters;
  onChange: (next: OrderFilters) => void;
}) {
  const { actor, engine } = useApp();
  const manager =
    actor.role === "cs_supervisor" ||
    ["admin", "admin_staff"].includes(actor.role);
  let team = [] as ReturnType<typeof engine.listCsTeam>;
  try {
    if (manager) team = engine.listCsTeam(actor);
  } catch {}
  let orders = [] as ReturnType<typeof engine.listOrders>;
  try {
    orders = engine.listOrders(actor);
  } catch {}
  const months = Array.from(
    new Set(
      orders.map((order) =>
        (order.csReleasedAt ?? order.createdAt).slice(0, 7),
      ),
    ),
  )
    .sort()
    .reverse();
  if (filters.month && !months.includes(filters.month))
    months.unshift(filters.month);
  return (
    <div className="orders-filter-bar">
      <h2>工程單</h2>
      <div className="orders-filter-controls">
        {manager && (
          <label className="orders-filter-select">
            <select
              aria-label="跟進同事"
              value={filters.ownerId}
              onChange={(event) =>
                onChange({ ...filters, ownerId: event.target.value })
              }
            >
              <option value="all">全部同事</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
        )}
        <label className="orders-filter-select">
          <select
            aria-label="工程單月份"
            value={filters.month}
            onChange={(event) =>
              onChange({ ...filters, month: event.target.value })
            }
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
          <ChevronDown size={18} />
        </label>
        <label className="orders-filter-select">
          <select
            aria-label="工程類別"
            value={filters.category}
            onChange={(event) =>
              onChange({ ...filters, category: event.target.value })
            }
          >
            <option value="all">全部類別</option>
            <option value="self-pay">自費</option>
            <option value="group-buy">團購</option>
            <option value="grant-80k">8萬資助</option>
          </select>
          <ChevronDown size={18} />
        </label>
      </div>
    </div>
  );
}

function WorkOrderRail({
  selectedId,
  filters,
}: {
  selectedId?: string;
  filters: OrderFilters;
}) {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const manager =
    actor.role === "cs_supervisor" ||
    ["admin", "admin_staff"].includes(actor.role);
  let team = [] as ReturnType<typeof engine.listCsTeam>;
  try {
    if (manager) team = engine.listCsTeam(actor);
  } catch {}
  const orders = engine
    .listOrders(actor)
    .filter((order) => {
      const arrived = order.csReleasedAt ?? order.createdAt;
      if (filters.month && !arrived.startsWith(filters.month)) return false;
      if (
        manager &&
        filters.ownerId !== "all" &&
        order.csOwnerId !== filters.ownerId
      )
        return false;
      if (filters.category !== "all") {
        let invoiceCategory: InvoiceCategory | undefined;
        try {
          invoiceCategory = engine.getInvoice(actor, order.invoiceId).category;
        } catch {}
        if (invoiceCategory !== filters.category) return false;
      }
      return true;
    })
    .sort((a, b) =>
      (b.csReleasedAt ?? b.createdAt).localeCompare(
        a.csReleasedAt ?? a.createdAt,
      ),
    );
  const pager = usePagination(
    orders,
    `${filters.month}|${filters.ownerId}|${filters.category}`,
  );
  const openOrder = (orderId: string) => {
    const query = new URLSearchParams({
      month: filters.month,
      ownerId: filters.ownerId,
      category: filters.category,
    });
    nav(`/orders/${orderId}?${query.toString()}`);
  };
  return (
    <aside className="order-rail">
      <div className="order-rail-head">
        <h2>工程單</h2>
      </div>
      <div className="order-rail-list">
        {orders.length === 0 ? (
          <p className="section-empty">此月份沒有工程單。</p>
        ) : (
          pager.items.map((order) => {
            let invoiceNumber = "";
            let categories: InvoiceCategory[] = [];
            try {
              const invoice = engine.getInvoice(actor, order.invoiceId);
              invoiceNumber = invoice.number;
              categories = invoice.category ? [invoice.category] : [];
              const quote = engine.getQuote(actor, order.quoteId);
              if (quote.orderCategories?.length)
                categories = quote.orderCategories;
            } catch {}
            return (
              <div
                key={order.id}
                role="link"
                tabIndex={0}
                className={`order-rail-row ${selectedId === order.id ? "selected" : ""}`}
                onClick={() => openOrder(order.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    openOrder(order.id);
                }}
              >
                <span className="order-rail-row-top">
                  <strong>{order.number}</strong>
                  <span className="order-rail-dots">
                    {categories.map((category) => (
                      <i
                        key={category}
                        className={`order-rail-dot ${category}`}
                        title={
                          category === "grant-80k"
                            ? "8萬"
                            : category === "group-buy"
                              ? "團購"
                              : "自費"
                        }
                      />
                    ))}
                  </span>
                </span>
                <small>INV-{invoiceNumber || "—"}</small>
              </div>
            );
          })
        )}
      </div>
      {pager.total > 12 && (
        <Pagination
          page={pager.page}
          pages={pager.pages}
          total={pager.total}
          onChange={pager.setPage}
        />
      )}
    </aside>
  );
}

function dateRange(startDate: string, endDate: string): string[] {
  if (!startDate) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate || startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return [startDate];
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 370) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const CALENDAR_EVENT_COLORS = [
  { bg: "#88BAFF", text: "#0D1B40" }, // Primary Blue 3
  { bg: "#FFD29A", text: "#5A2800" }, // Primary Orange 3
  { bg: "#C9B8FF", text: "#2F1B5E" }, // purple
  { bg: "#A8E6C3", text: "#12452C" }, // green
  { bg: "#FFC4D6", text: "#5C1F36" }, // pink
  { bg: "#FFE59A", text: "#4D3A00" }, // yellow
];
function calendarEventColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1)
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return CALENDAR_EVENT_COLORS[hash % CALENDAR_EVENT_COLORS.length];
}

function WorkOrderCalendar({
  order,
  assignments,
  extraWorks,
  resources,
}: {
  order: WorkOrder;
  assignments: Assignment[];
  extraWorks: ExtraWork[];
  resources: Resource[];
}) {
  const [month, setMonth] = useState(order.startDate.slice(0, 7));
  useEffect(() => {
    setMonth(order.startDate.slice(0, 7));
  }, [order.id, order.startDate]);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(days).padStart(2, "0")}`;
  const events: Array<{ id: string; start: string; end: string; label: string }> =
    [];
  assignments.forEach((assignment) => {
    const line = order.lines.find((item) =>
      assignment.lineIds.includes(item.id),
    );
    const resource = resources.find(
      (item) => item.id === assignment.resourceId,
    );
    events.push({
      id: assignment.id,
      start: assignment.date,
      end: assignment.endDate ?? assignment.date,
      label: `${line?.itemSnapshot.name ?? "施工"} · ${resource?.name ?? "未分派師傅"} · ${assignment.time}`,
    });
  });
  extraWorks.forEach((extra) => {
    const resource = resources.find(
      (item) => item.id === extra.resourceId,
    );
    events.push({
      id: extra.id,
      start: extra.startDate,
      end: extra.endDate,
      label:
        extra.kind === "fabrication"
          ? `造貨 · ${resource?.name ?? "未分派師傅"}`
          : `${EXTRA_WORK_LABELS[extra.kind]} · ${resource?.name ?? "未分派師傅"} · ${extra.time}`,
    });
  });
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: days },
      (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  const calendarStart = new Date(Date.UTC(year, monthIndex, 1 - offset));
  const dateKey = (date: Date) => date.toISOString().slice(0, 10);
  const addDays = (date: Date, amount: number) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + amount);
    return next;
  };
  const diffDays = (start: string, end: string) =>
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86400000,
    );
  const weekBars = weeks.map((_, weekIndex) => {
    const weekStart = dateKey(addDays(calendarStart, weekIndex * 7));
    const weekEnd = dateKey(addDays(calendarStart, weekIndex * 7 + 6));
    const bars = events
      .map((event) => {
        const start = [event.start, weekStart, monthStart].sort().at(-1)!;
        const end = [event.end, weekEnd, monthEnd].sort()[0]!;
        if (start > end) return null;
        const startCol = diffDays(weekStart, start);
        const endCol = diffDays(weekStart, end);
        if (startCol < 0 || endCol > 6) return null;
        return { event, startCol, endCol };
      })
      .filter(
        (
          bar,
        ): bar is { event: (typeof events)[number]; startCol: number; endCol: number } =>
          Boolean(bar),
      )
      .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);
    const laneEnds: number[] = [];
    return bars.map((bar) => {
      let lane = laneEnds.findIndex((lastCol) => lastCol < bar.startCol);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = bar.endCol;
      return { ...bar, lane };
    });
  });
  const moveMonth = (delta: number) => {
    const next = new Date(year, monthIndex + delta, 1);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  return (
    <section className="calendar-card" aria-label="工程日曆">
      <header className="calendar-head">
        <div>
          <strong>{formatMonthLabel(month)}</strong>
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="上一個月">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="下一個月">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>
      <div className="calendar-weekdays">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {weeks.map((week, weekIndex) => (
          <div
            className="calendar-week"
            key={`week-${weekIndex}`}
            style={{
              minHeight: `${Math.max(
                64,
                30 + weekBars[weekIndex].length * 22 + 8,
              )}px`,
            }}
          >
            <div className="calendar-week-days">
              {week.map((date, index) => {
                if (!date)
                  return (
                    <div
                      className="calendar-empty"
                      key={`empty-${weekIndex}-${index}`}
                    />
                  );
                const day = Number(date.slice(-2));
                const inPeriod = date >= order.startDate && date <= order.endDate;
                return (
                  <div
                    className={`calendar-cell ${inPeriod ? "in-period" : ""} ${date === DEMO_TODAY ? "today" : ""}`}
                    key={date}
                  >
                    <span>{day}</span>
                  </div>
                );
              })}
            </div>
            {weekBars[weekIndex].length > 0 && (
              <div className="calendar-week-events">
                {weekBars[weekIndex].map((bar) => {
                  const tone = calendarEventColor(bar.event.id);
                  return (
                    <div
                      className="calendar-event-bar"
                      key={`${bar.event.id}-${weekIndex}`}
                      style={{
                        gridColumn: `${bar.startCol + 1} / span ${bar.endCol - bar.startCol + 1}`,
                        gridRow: bar.lane + 1,
                        background: tone.bg,
                        color: tone.text,
                      }}
                      title={bar.event.label}
                    >
                      {bar.event.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PhotoImage({
  attachment,
  className = "",
}: {
  attachment: Attachment;
  className?: string;
}) {
  const [url, setUrl] = useState<string>();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setUrl(undefined);
    setMissing(false);
    getAttachmentBlob(attachment)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);
  if (missing)
    return (
      <span className={`photo-missing ${className}`}>
        <FileText size={24} />
        未附原件
      </span>
    );
  if (!url) return <span className={`photo-loading ${className}`} />;
  return <img className={className} src={url} alt={attachment.name} />;
}

function SitePhotos({
  order,
  canEdit,
}: {
  order: WorkOrder;
  canEdit: boolean;
}) {
  const { actor, engine, run } = useApp();
  const photos = order.sitePhotos ?? [];
  const [selectedId, setSelectedId] = useState(photos[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const selected = photos.find((photo) => photo.id === selectedId) ?? photos[0];
  useEffect(() => {
    if (!photos.some((photo) => photo.id === selectedId))
      setSelectedId(photos[0]?.id ?? "");
  }, [photos, selectedId]);
  async function upload(files: File[]) {
    setBusy(true);
    try {
      const attachments = await Promise.all(
        files.map((file) => saveAttachment(file)),
      );
      run(
        () => engine.addSitePhotos(actor, order.id, attachments),
        "現場環境圖片已上載。",
      );
    } catch (error) {
      run(() => {
        throw error;
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="現場環境">
      {canEdit && (
        <label className="site-photo-upload">
          <Plus size={20} />
          {busy ? "上載中…" : "上載現場圖片"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length) void upload(files);
            }}
          />
        </label>
      )}
      {photos.length === 0 ? (
        <p className="section-empty">尚未上載現場環境圖片。</p>
      ) : (
        <>
          <button
            type="button"
            className="site-photo-large"
            onClick={() =>
              showAttachment(selected).catch((error) =>
                run(() => {
                  throw error;
                }),
              )
            }
            aria-label={`開啟 ${selected.name}`}
          >
            <PhotoImage attachment={selected} className="site-photo-image" />
          </button>
          <div className="site-photo-grid">
            {photos.map((photo) => (
              <button
                type="button"
                key={photo.id}
                className={`site-photo-thumb ${photo.id === selected.id ? "selected" : ""}`}
                onClick={() => setSelectedId(photo.id)}
                aria-label={`預覽 ${photo.name}`}
              >
                <PhotoImage attachment={photo} />
              </button>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function OrderPanel({ order }: { order: WorkOrder }) {
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [selectedLineId, setSelectedLineId] = useState("");
  const [openNoteId, setOpenNoteId] = useState("");
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [resourceId, setResource] = useState("");
  const [date, setDate] = useState(order.startDate);
  const [endDate, setEndDate] = useState(order.startDate);
  const [time, setTime] = useState("未定");
  const [notes, setNotes] = useState("");
  const [extraKind, setExtraKind] = useState<ExtraWorkKind | null>(null);
  const [extraResourceId, setExtraResource] = useState("");
  const [extraStart, setExtraStart] = useState(order.startDate);
  const [extraEnd, setExtraEnd] = useState(order.startDate);
  const [extraTime, setExtraTime] = useState("未定");
  const [extraNotes, setExtraNotes] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [extraFree, setExtraFree] = useState(false);
  const [extraSupplierId, setExtraSupplierId] = useState("");
  const [extraCategory, setExtraCategory] = useState("");
  const [dates, setDates] = useState(false);
  const [extraMenu, setExtraMenu] = useState(false);
  const [start, setStart] = useState(order.startDate);
  const [end, setEnd] = useState(order.endDate);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setSelectedLineId("");
    setOpenNoteId("");
    setEditingAssignmentId("");
    setResource("");
    setNotes("");
  }, [order.id]);
  const invoice = engine.getInvoice(actor, order.invoiceId);
  let quoteLineAmounts: Record<string, number> = {};
  try {
    quoteLineAmounts = engine.orderLineAmounts(actor, order.id);
  } catch {}
  let lineAmounts = new Map<string, number>();
  let lineAmountsByIndex: number[] = [];
  try {
    const pricing = engine.invoicePricing(actor, invoice.id);
    lineAmounts = new Map(
      pricing.lineAmounts.map((amount) => [amount.id, amount.amount]),
    );
    lineAmountsByIndex = pricing.lineAmounts.map((amount) => amount.amount);
  } catch {}
  const assignments = engine.listAssignments(actor, order.id);
  const extraWorks = engine.listExtraWorks(actor, order.id);
  let resources = [] as ReturnType<typeof engine.listResources>;
  try {
    resources = engine.listResources(actor);
  } catch {}
  let suppliers = [] as ReturnType<typeof engine.listSuppliers>;
  try {
    suppliers = engine.listSuppliers(actor);
  } catch {}
  const canEdit = ["cs", "cs_supervisor", "admin"].includes(actor.role);
  const selectedLine = order.lines.find((line) => line.id === selectedLineId);
  const assigned = new Map(
    assignments.flatMap((assignment) =>
      assignment.lineIds.map((lineId) => [lineId, assignment] as const),
    ),
  );
  const compatible = resources.filter((resource) => {
    if (!selectedLine) return false;
    // All entered 師傅／判頭 are selectable on every order; service-only
    // resources stay out of the 執行師傅 list.
    return resource.active && resource.type !== "service";
  });
  const lineAmountFor = (lineId: string, lineIndex: number) =>
    quoteLineAmounts[lineId] ??
    ((lineAmounts.get(lineId) ?? 0) > 0
      ? lineAmounts.get(lineId)
      : lineAmountsByIndex[lineIndex]);
  const assignmentDays = (assignment: Assignment) =>
    Math.max(
      1,
      dateRange(
        assignment.date,
        assignment.endDate ?? assignment.date,
      ).length,
    );
  const lineCostFor = (line: WorkOrder["lines"][number], lineIndex: number) => {
    const assignment = assigned.get(line.id);
    if (!assignment) return 0;
    const resource = resources.find(
      (item) => item.id === assignment.resourceId,
    );
    if (!resource?.feeMode) return 0;
    if (resource.feeMode === "daily")
      return (resource.feeAmount ?? 0) * assignmentDays(assignment);
    if (resource.feeMode === "fixed") return resource.feeAmount ?? 0;
    return (lineAmountFor(line.id, lineIndex) ?? 0) * 0.6;
  };
  const quoteTotal = invoice.netTotal;
  const unassignedCount = order.lines.filter(
    (line) => !assigned.has(line.id),
  ).length;
  const extraCost = extraWorks.reduce(
    (total, extra) => total + (extra.price ?? 0),
    0,
  );
  const costTotal =
    order.lines.reduce(
      (total, line, lineIndex) => total + lineCostFor(line, lineIndex),
      0,
    ) + extraCost;
  const costPercent =
    quoteTotal > 0 ? ((costTotal / quoteTotal) * 100).toFixed(1) : "0.0";
  const openAssignment = (lineId: string, assignmentId?: string) => {
    const assignment = assignments.find((item) => item.id === assignmentId);
    setSelectedLineId(lineId);
    setEditingAssignmentId(assignment?.id ?? "");
    setResource(assignment?.resourceId ?? "");
    setDate(assignment?.date ?? order.startDate);
    setEndDate(
      assignment?.endDate ??
        assignment?.date ??
        order.startDate,
    );
    setTime(assignment?.time ?? "未定");
    setNotes(assignment?.notes ?? "");
  };
  const closeAssignment = () => {
    setSelectedLineId("");
    setEditingAssignmentId("");
    setResource("");
    setNotes("");
  };
  const openExtra = (kind: ExtraWorkKind) => {
    const existing = extraWorks.find((extra) => extra.kind === kind);
    setExtraKind(kind);
    setExtraResource(existing?.resourceId ?? "");
    setExtraStart(existing?.startDate ?? order.startDate);
    setExtraEnd(existing?.endDate ?? order.startDate);
    setExtraTime(existing?.time ?? "未定");
    setExtraNotes(existing?.notes ?? "");
    setExtraPrice(existing?.price ? String(existing.price) : "");
    setExtraFree(existing ? (existing.price ?? 0) === 0 : false);
    setExtraSupplierId(existing?.supplierId ?? "");
    setExtraCategory(existing?.category ?? "");
  };
  const closeExtra = () => setExtraKind(null);
  let categories: InvoiceCategory[] = [];
  try {
    const quote = engine.getQuote(actor, order.quoteId);
    categories = quote.orderCategories?.length
      ? quote.orderCategories
      : invoice.category
        ? [invoice.category]
        : [];
  } catch {
    categories = invoice.category ? [invoice.category] : [];
  }
  let grantApproval:
    | {
        applicationNumber?: string;
        approvedAmount?: number;
        approvedAt?: string;
      }
    | undefined;
  try {
    grantApproval = engine.orderGrantApproval(actor, order.id);
  } catch {}
  return (
    <>
      <div className="wo-detail-head">
        <div className="wo-title">
          <div className="wo-number-line">
            <h1>{order.number}</h1>
            <CategoryChips categories={categories} />
            {order.status === "completed" && <Badge strong>工程完成</Badge>}
          </div>
          <button
            type="button"
            className="wo-invoice-print"
            aria-label={`列印 ${invoice.number} Invoice`}
            onClick={() => nav("/documents/invoice/" + invoice.id)}
          >
            <span>INV-{invoice.number}</span>
            <Printer size={18} />
          </button>
        </div>
        <div className="wo-date-summary">
          <span>工程時間</span>
          <strong>
            由 {order.startDate} 至 {order.endDate}
          </strong>
          {canEdit && (
            <button
              type="button"
              className="wo-edit-date"
              aria-label="修改工程日期"
              onClick={() => {
                setStart(order.startDate);
                setEnd(order.endDate);
                setDates(true);
              }}
            >
              <PenLine size={20} />
            </button>
          )}
        </div>
      </div>
      {grantApproval && (
        <div className="wo-grant-card">
          <div className="wo-grant-badge">8萬</div>
          <div className="wo-grant-info">
            <span>8萬資助批核</span>
            <strong>
              {grantApproval.applicationNumber
                ? `申請編號：${grantApproval.applicationNumber}`
                : "待政府批核"}
            </strong>
          </div>
          <div className="wo-grant-amount">
            <span>政府批核金額</span>
            <strong>
              {grantApproval.approvedAmount
                ? money(grantApproval.approvedAmount)
                : "—"}
            </strong>
          </div>
          {grantApproval.approvedAt && (
            <div className="wo-grant-date">
              <span>批核日期</span>
              <strong>{grantApproval.approvedAt.slice(0, 10)}</strong>
            </div>
          )}
        </div>
      )}
      <div className="wo-customer-row">
        <div>
          <span>聯絡人</span>
          <strong>{order.customer.name}</strong>
        </div>
        <div>
          <span>聯絡電話</span>
          <strong>{order.customer.phone || "—"}</strong>
        </div>
        <div className="wo-customer-address">
          <span>工程地址</span>
          <strong>{order.customer.address}</strong>
        </div>
      </div>
      <WorkOrderCalendar
        order={order}
        assignments={assignments}
        extraWorks={extraWorks}
        resources={resources}
      />
      <Section
        title="工程內容"
        className="engineering-content-card"
        action={
          <Button
            variant="primary"
            className="extra-add-button"
            onClick={() => setExtraMenu(true)}
          >
            <Plus size={19} /> 額外工程
          </Button>
        }
      >
        <div className="engineering-table-wrap">
          <table className="engineering-table">
            <thead>
              <tr>
                <th scope="col">工程項目</th>
                <th scope="col">規格</th>
                <th scope="col">執行師傅</th>
                <th scope="col">師傅收費</th>
                <th scope="col">工程時間</th>
                <th scope="col">完工時間</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, lineIndex) => {
                const assignment = assigned.get(line.id);
                const lineAmount = lineAmountFor(line.id, lineIndex);
                const lineCost = lineCostFor(line, lineIndex);
                const resource = resources.find(
                  (item) => item.id === assignment?.resourceId,
                );
                return (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.itemSnapshot.name}</strong>
                      <small>
                        {line.position}
                        {line.style ? ` · ${line.style}` : ""}
                      </small>
                      {line.notes.trim() && (
                        <>
                          <button
                            type="button"
                            className="workorder-note-toggle"
                            aria-expanded={openNoteId === line.id}
                            onClick={() =>
                              setOpenNoteId((current) =>
                                current === line.id ? "" : line.id,
                              )
                            }
                          >
                            備註 <ChevronDown size={14} />
                          </button>
                          {openNoteId === line.id && (
                            <p className="workorder-note-text">{line.notes}</p>
                          )}
                        </>
                      )}
                      {line.productStyle && (
                        <div className="order-product-style">
                          <OrderStyleThumb
                            attachment={line.productStyle.attachment}
                          />
                          <small>
                            {line.productStyle.factoryName} ·{" "}
                            {line.productStyle.seriesName} ·{" "}
                            {line.productStyle.productCode}
                          </small>
                        </div>
                      )}
                    </td>
                    <td className="engineering-spec">
                      {line.itemSnapshot.measure === "area"
                        ? `${line.length} × ${line.width} ${line.dimensionUnit}`
                        : line.itemSnapshot.measure === "length"
                          ? `${line.length} ${line.dimensionUnit}`
                          : line.itemSnapshot.measure === "fixed"
                            ? "一式"
                            : `${line.quantity} ${line.itemSnapshot.unit}`}
                    </td>
                    <td>{resource?.name ?? "—"}</td>
                    <td>
                      {resource ? (
                        <>
                          <strong className="resource-fee-mode">
                            {resource.feeMode
                              ? RESOURCE_FEE_LABELS[resource.feeMode]
                              : "—"}
                          </strong>
                          {lineCost !== undefined && (
                            <small>{money(lineCost)}</small>
                          )}
                          {resource.feeMode === "daily" && assignment && (
                            <small className="fee-breakdown">
                              {money(resource.feeAmount ?? 0)} ×{" "}
                              {assignmentDays(assignment)}日
                            </small>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{assignment?.date ?? "—"}</td>
                    <td>{assignment?.endDate ?? assignment?.date ?? "—"}</td>
                    <td>
                      <div className="engineering-row-actions">
                        {canEdit && (
                          <Button
                            variant={assignment ? "secondary" : "primary"}
                            onClick={() =>
                              openAssignment(line.id, assignment?.id)
                            }
                          >
                            {assignment ? "更改" : "安排"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {extraWorks.map((extra) => {
                const resource = resources.find(
                  (item) => item.id === extra.resourceId,
                );
                return (
                  <tr key={extra.id} className="extra-work-row">
                    <td>
                      <strong>{EXTRA_WORK_LABELS[extra.kind]}</strong>
                      <small>額外工程</small>
                    </td>
                    <td>—</td>
                    <td>
                      {extra.kind === "fabrication"
                        ? suppliers.find((supplier) => supplier.id === extra.supplierId)?.name ?? "—"
                        : resource?.name ?? "—"}
                      {extra.kind === "fabrication" && extra.category && (
                        <small>{extra.category}</small>
                      )}
                    </td>
                    <td>
                      <strong className="resource-fee-mode">
                        {extra.price ? money(extra.price) : "免費"}
                      </strong>
                      <small>自訂收費</small>
                    </td>
                    <td>{extra.startDate}</td>
                    <td>{extra.endDate}</td>
                    <td>
                      <div className="engineering-row-actions">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            onClick={() => openExtra(extra.kind)}
                          >
                            更改
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <section className="cost-summary" aria-label="成本總和">
        <div className="cost-summary-head">
          <div>
            <h2>成本總和</h2>
            <p>只計已安排工程及額外工程；未安排工程未計入成本。</p>
          </div>
          <span>未安排 {unassignedCount} 項</span>
        </div>
        <div className="cost-summary-grid">
          <div>
            <span>報價單總額</span>
            <strong>{money(quoteTotal)}</strong>
          </div>
          <div>
            <span>成本支出總和</span>
            <strong>{money(costTotal)}</strong>
          </div>
          <div>
            <span>成本比率</span>
            <strong>{costPercent}%</strong>
          </div>
          <div>
            <span>淨賺</span>
            <strong className={quoteTotal - costTotal < 0 ? "negative" : ""}>
              {money(quoteTotal - costTotal)}
            </strong>
          </div>
        </div>
      </section>
      <SitePhotos order={order} canEdit={canEdit} />
      <Button
        className="full-width completion-button"
        variant="primary"
        disabled={!canEdit || order.status === "completed"}
        onClick={() =>
          run(
            () => engine.completeWorkOrder(actor, order!.id),
            "工程已標記為完成。",
          )
        }
      >
        {order.status === "completed" ? "工程已完成" : "工程完成"}
      </Button>
      {selectedLine && (
        <Dialog
          title={editingAssignmentId ? "更改安排" : "安排施工"}
          onClose={closeAssignment}
        >
          <p className="dialog-intro">
            正在安排：{selectedLine.itemSnapshot.name} · {selectedLine.position}
          </p>
          <div className="form-grid two">
            <Field label="執行師傅" required>
              <select
                value={resourceId}
                onChange={(event) => setResource(event.target.value)}
              >
                <option value="">選擇判頭或公司師傅</option>
                {compatible.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resourceOptionLabel(resource)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="開工日期" required>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  if (event.target.value > endDate)
                    setEndDate(event.target.value);
                }}
              />
            </Field>
          </div>
          <div className="form-grid two">
            <Field label="完工日期" required>
              <input
                type="date"
                min={date}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
            <Field label="時段">
              <select
                value={time}
                onChange={(event) => setTime(event.target.value)}
              >
                {["未定", "上午", "下午", "全天"].map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="安排備註">
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="檔期或現場注意事項"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={closeAssignment}>取消</Button>
            <Button
              variant="primary"
              disabled={!resourceId || !date || !endDate || endDate < date}
              onClick={() => {
                const result = run(
                  () =>
                    editingAssignmentId
                      ? engine.updateAssignment(actor, editingAssignmentId, {
                          resourceId,
                          date,
                          endDate,
                          time,
                          notes,
                        })
                      : engine.assign(actor, order.id, {
                          resourceId,
                          lineIds: [selectedLine.id],
                          date,
                          endDate,
                          time,
                          notes,
                        }),
                  editingAssignmentId
                    ? "施工安排已更新；日曆已更新。"
                    : "施工安排已保存；日曆已更新。",
                );
                if (result) closeAssignment();
              }}
            >
              儲存安排
            </Button>
          </div>
        </Dialog>
      )}
      {extraKind && (
        <Dialog
          title={`${extraWorks.some((extra) => extra.kind === extraKind) ? "更改" : "安排"}${EXTRA_WORK_LABELS[extraKind]}`}
          onClose={closeExtra}
        >
          <p className="dialog-intro">
            額外工程不屬於報價單，只用作CS施工安排。
          </p>
          {extraKind === "fabrication" ? (
            <>
              <div className="form-grid two">
                <Field label="供應商" required>
                  <select
                    value={extraSupplierId}
                    onChange={(event) => {
                      setExtraSupplierId(event.target.value);
                      setExtraCategory("");
                    }}
                  >
                    <option value="">選擇供應商</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="造貨項目" required>
                  <select
                    value={extraCategory}
                    onChange={(event) => setExtraCategory(event.target.value)}
                    disabled={!extraSupplierId}
                  >
                    <option value="">選擇造貨項目</option>
                    {(
                      suppliers.find((supplier) => supplier.id === extraSupplierId)
                        ?.categories ?? []
                    ).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="form-grid two">
                <Field label="造貨日期" required>
                  <input
                    type="date"
                    value={extraStart}
                    onChange={(event) => {
                      setExtraStart(event.target.value);
                      if (event.target.value > extraEnd)
                        setExtraEnd(event.target.value);
                    }}
                  />
                </Field>
                <Field label="起貨日期" required>
                  <input
                    type="date"
                    min={extraStart}
                    value={extraEnd}
                    onChange={(event) => setExtraEnd(event.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="form-grid two">
                <Field label="執行師傅" required>
                  <select
                    value={extraResourceId}
                    onChange={(event) => setExtraResource(event.target.value)}
                  >
                    <option value="">選擇判頭或公司師傅</option>
                    {resources
                      .filter((resource) => resource.active)
                      .map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resourceOptionLabel(resource)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="開工日期" required>
                  <input
                    type="date"
                    value={extraStart}
                    onChange={(event) => {
                      setExtraStart(event.target.value);
                      if (event.target.value > extraEnd)
                        setExtraEnd(event.target.value);
                    }}
                  />
                </Field>
              </div>
              <div className="form-grid two">
                <Field label="完工日期" required>
                  <input
                    type="date"
                    min={extraStart}
                    value={extraEnd}
                    onChange={(event) => setExtraEnd(event.target.value)}
                  />
                </Field>
                <Field label="時段">
                  <select
                    value={extraTime}
                    onChange={(event) => setExtraTime(event.target.value)}
                  >
                    {["未定", "上午", "下午", "全天"].map((slot) => (
                      <option key={slot}>{slot}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}
          <Field label="額外收費">
            <div className="extra-price-row">
              <input
                type="number"
                min="0"
                disabled={extraFree}
                value={extraFree ? "0" : extraPrice}
                onChange={(event) => setExtraPrice(event.target.value)}
                placeholder="0 代表不收費"
              />
              <label className="extra-free">
                <input
                  type="checkbox"
                  checked={extraFree}
                  onChange={(event) => {
                    setExtraFree(event.target.checked);
                    if (event.target.checked) setExtraPrice("0");
                  }}
                />
                不收費
              </label>
            </div>
          </Field>
          <Field label="安排備註">
            <input
              value={extraNotes}
              onChange={(event) => setExtraNotes(event.target.value)}
              placeholder="例如：客人屋企有10隻貓"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={closeExtra}>取消</Button>
            <Button
              variant="primary"
              disabled={
                (extraKind === "fabrication"
                  ? !extraSupplierId || !extraCategory
                  : !extraResourceId) ||
                !extraStart ||
                !extraEnd ||
                extraEnd < extraStart
              }
              onClick={() => {
                const result = run(
                  () =>
                    engine.scheduleExtraWork(actor, order.id, {
                      kind: extraKind,
                      resourceId:
                        extraKind === "fabrication" ? "" : extraResourceId,
                      supplierId:
                        extraKind === "fabrication"
                          ? extraSupplierId
                          : undefined,
                      category:
                        extraKind === "fabrication"
                          ? extraCategory
                          : undefined,
                      startDate: extraStart,
                      endDate: extraEnd,
                      time:
                        extraKind === "fabrication" ? "未定" : extraTime,
                      notes: extraNotes,
                      price: extraFree ? 0 : Number(extraPrice || 0),
                    }),
                  "額外工程安排已保存；日曆已更新。",
                );
                if (result) closeExtra();
              }}
            >
              儲存安排
            </Button>
          </div>
        </Dialog>
      )}
      {extraMenu && (
        <Dialog title="額外工程" onClose={() => setExtraMenu(false)}>
          <p className="dialog-intro">
            選擇要安排的額外工程；已安排的項目可再更改。
          </p>
          <div className="extra-menu-list">
            {(
              [
                "measure",
                "delivery",
                "transport",
                "fabrication",
              ] as ExtraWorkKind[]
            ).map((kind) => {
              const existing = extraWorks.find(
                (extra) => extra.kind === kind,
              );
              return (
                <button
                  type="button"
                  key={kind}
                  className="extra-menu-item"
                  onClick={() => {
                    setExtraMenu(false);
                    openExtra(kind);
                  }}
                >
                  <span>{EXTRA_WORK_LABELS[kind]}</span>
                  <strong>{existing ? "更改" : "安排"}</strong>
                </button>
              );
            })}
          </div>
        </Dialog>
      )}
      {dates && (
        <Dialog title="修改預計工程日期" onClose={() => setDates(false)}>
          <div className="form-grid two">
            <Field label="預計開工" required>
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="預計完工" required>
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <Field label="修改原因" required>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setDates(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const result = run(() => {
                  engine.updateDates(actor, order.id, { start, end, reason });
                  return true;
                }, "日期已更新，原值及原因已留記錄。");
                if (result) setDates(false);
              }}
            >
              儲存日期
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function Orders() {
  const [filters, setFilters] = useState<OrderFilters>({
    month: DEMO_TODAY.slice(0, 7),
    ownerId: "all",
    category: "all",
  });
  return (
    <>
      <PageHead title="工程管理" />
      <EngineeringFilters filters={filters} onChange={setFilters} />
      <div className="orders-workspace">
        <WorkOrderRail filters={filters} />
        <div className="workorder-main">
          <div className="list-panel">
            <Empty
              title="請選擇工程單"
              description="從左邊列表選擇工程。"
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState<OrderFilters>({
    month: params.get("month") || DEMO_TODAY.slice(0, 7),
    ownerId: params.get("ownerId") || "all",
    category: params.get("category") || "all",
  });
  let order: WorkOrder | undefined;
  try {
    order = engine.getOrder(actor, id);
  } catch {}
  if (!order)
    return (
      <>
        <PageHead title="工程管理" />
        <EngineeringFilters filters={filters} onChange={setFilters} />
        <div className="orders-workspace">
          <WorkOrderRail selectedId={id} filters={filters} />
          <div className="workorder-main">
            <div className="list-panel">
              <Empty
                title="沒有這個工程的查看權限"
                action={<Button onClick={() => nav("/orders")}>返回工程</Button>}
              />
            </div>
          </div>
        </div>
      </>
    );
  return (
    <>
      <PageHead title="工程管理" />
      <EngineeringFilters filters={filters} onChange={setFilters} />
      <div className="orders-workspace">
        <WorkOrderRail selectedId={id} filters={filters} />
        <div className="workorder-main">
          <OrderPanel order={order} />
        </div>
      </div>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Hammer,
  Printer,
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
  Dialog,
  Empty,
  Field,
  PageHead,
  Search,
  Section,
  UploadField,
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
  InvoiceCategory,
  INVOICE_CATEGORY_NAMES,
  ROLE_NAMES,
  Assignment,
  EXTRA_WORK_LABELS,
  ExtraWorkKind,
  ExtraWork,
} from "../domain/types";

type ProofPreview =
  | { kind: "loading" }
  | { kind: "image"; url: string }
  | { kind: "file" }
  | { kind: "missing" };

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
  const shown = payments
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
                {shown.map((pay) => {
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
      {payment.proof && (
        <Button
          onClick={() =>
            showAttachment(payment.proof!).catch((error) =>
              run(() => {
                throw error;
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
  const [teamFilter, setTeamFilter] = useState<"all" | "A" | "B">("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const sources = engine
    .listQuotes(actor)
    .filter((quote) => quote.submission && !quote.invoiceId && !quote.archived)
    .filter(
      (quote) =>
        (teamFilter === "all" || quote.team === teamFilter) &&
        (salesFilter === "all" || quote.ownerId === salesFilter) &&
        `${quote.number} ${currentVersion(quote).customer.name} ${currentVersion(quote).customer.address}`.includes(
          search,
        ),
    );
  const payments = engine.listPayments(actor);
  const salesActors = engine
    .listActors()
    .filter((candidate) =>
      ["sales", "supervisor", "head"].includes(candidate.role),
    );
  return (
    <>
      <PageHead
        eyebrow="開單工作區"
        title="提交報價"
        description="先核對付款及選擇分類；有已核有效付款後可開Invoice。"
      />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋Q號、客戶、地址或Sales"
          />
          <div className="submission-filters">
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
                  <th scope="col">客戶／地區</th>
                  <th scope="col">Sales</th>
                  <th scope="col" className="numeric">成交額</th>
                  <th scope="col" className="numeric">首訂金額</th>
                  <th scope="col">證明文件</th>
                  <th scope="col">付款核對</th>
                  <th scope="col">分類</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((quote) => {
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
                  const proofs = sourcePayments.flatMap((payment) =>
                    payment.proof ? [payment.proof] : [],
                  );
                  const openInvoice = () => {
                    const invoice = run(
                      () => engine.issueInvoice(actor, quote.id),
                      "Invoice已開立，已轉入單據管理。",
                    );
                    if (invoice) nav("/invoices/" + invoice.id);
                  };
                  return (
                    <tr key={quote.id}>
                      <td>
                        <strong>{quote.number}</strong>
                        <small>
                          已簽版本 {version.index} · Team {quote.team}
                        </small>
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
                      <td className="numeric money">
                        {eligibility.officeCategory ? (
                          money(eligibility.firstDue)
                        ) : (
                          <span className="pending-value">待分類</span>
                        )}
                      </td>
                      <td>
                        {proofs.length ? (
                          <div className="proof-thumbs">
                            {proofs.map((proof, index) => (
                              <ProofThumb
                                key={`${proof.id}-${index}`}
                                attachment={proof}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="proof-empty">未上載</span>
                        )}
                      </td>
                      <td>
                        <Badge
                          strong={
                            pending.length === 0 && eligibility.validPaid > 0
                          }
                        >
                          {pending.length
                            ? `待核對 ${pending.length} 筆`
                            : `已核 ${money(eligibility.validPaid)}`}
                        </Badge>
                        <small>
                          {eligibility.officeCategory
                            ? `第一期門檻 ${money(eligibility.firstDue)}${eligibility.balance > 0 ? ` · 尚欠 ${money(eligibility.balance)}` : ""}`
                            : "請先選擇分類"}
                        </small>
                        {sourcePayments.map((payment) => (
                          <div className="inline-actions" key={payment.id}>
                            {payment.status === "pending" && (
                              <button
                                className="text-button"
                                onClick={() => setActivePayment(payment)}
                              >
                                核對收款
                              </button>
                            )}
                          </div>
                        ))}
                      </td>
                      <td>
                        <select
                          aria-label={`${quote.number} 分類`}
                          value={quote.officeCategory ?? ""}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            run(
                              () =>
                                engine.setOfficeCategory(
                                  actor,
                                  quote.id,
                                  e.target.value as InvoiceCategory,
                                ),
                              "分類已保存。",
                            );
                          }}
                        >
                          <option value="">未分類</option>
                          {Object.entries(INVOICE_CATEGORY_NAMES).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td>
                        <Button
                          variant={
                            eligibility.canIssue ? "primary" : "secondary"
                          }
                          disabled={!eligibility.canIssue}
                          title={
                            eligibility.canIssue ? "" : eligibility.nextAction
                          }
                          onClick={openInvoice}
                        >
                          已核對並開單 <ArrowRight size={18} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
  const invoices = engine
    .listInvoices(actor)
    .filter((invoice) =>
      `${invoice.number} ${invoice.customer.name} ${invoice.customer.address}`.includes(
        search,
      ),
    );
  const actors = engine.listActors();
  return (
    <>
      <PageHead
        eyebrow="開單工作區"
        title="單據管理"
        description="已開Invoice、收款進度及收據均在同一來源管理。"
      />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋Invoice、客戶或地址"
          />
        </div>
        {invoices.length === 0 ? (
          <Empty
            title="還未開立Invoice"
            description="請先到「提交報價」完成核款及分類。"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice單</th>
                  <th>客戶／地區</th>
                  <th>Sales</th>
                  <th className="numeric">成交額</th>
                  <th>歸類／收款進度</th>
                  <th>工程狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const status = engine.invoicePaymentStatus(actor, invoice.id);
                  const quote = engine.getQuote(actor, invoice.quoteId);
                  const sales = actors.find(
                    (candidate) => candidate.id === quote.ownerId,
                  );
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.number}</strong>
                        <small>{invoice.createdAt.slice(0, 10)}</small>
                      </td>
                      <td>
                        <strong>{invoice.customer.name}</strong>
                        <small>
                          {invoice.customer.district ||
                            invoice.customer.address}
                        </small>
                      </td>
                      <td>{sales?.name || "—"}</td>
                      <td className="numeric money">
                        {money(invoice.netTotal)}
                      </td>
                      <td>
                        <strong>
                          {invoice.category
                            ? INVOICE_CATEGORY_NAMES[invoice.category]
                            : "歷史未分類"}
                        </strong>
                        <small>
                          已核 {money(status.validPaid)}／{money(status.total)}{" "}
                          · {status.percentPaid}%
                        </small>
                      </td>
                      <td>
                        <Badge strong={status.releasedToCS}>
                          {status.releasedToCS ? "已發工程部" : "待收足50%"}
                        </Badge>
                      </td>
                      <td>
                        <Button onClick={() => nav("/invoices/" + invoice.id)}>
                          詳情 <ArrowRight size={18} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              sample
              attachment={proof}
              onSave={setProof}
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
  const [assigning, setAssigning] = useState<HandoffRow | null>(null);
  const [selectedCs, setSelectedCs] = useState("");
  const rows = engine.listHandoffs(actor);
  let csTeam = [] as ReturnType<typeof engine.listCsTeam>;
  try {
    csTeam = engine.listCsTeam(actor);
  } catch {}
  const canAssign =
    actor.role === "cs_supervisor" || actor.role === "admin";
  const shown = rows.filter((row) =>
    `${row.workOrderNumber} ${row.quoteNumber} ${row.invoiceNumber} ${row.customerName} ${row.phone} ${row.salesName} ${row.csOwnerName ?? ""}`.includes(
      search,
    ),
  );
  return (
    <>
      <PageHead eyebrow="CS工程部" title="工程單" />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程單、客戶、電話或Sales"
          />
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
                {shown.map((row) => (
                  <tr key={row.quoteId}>
                    <td>
                      <strong className="source-link">
                        {row.workOrderNumber}
                      </strong>
                      <small>
                        Invoice {row.invoiceNumber} · Q {row.quoteNumber}
                      </small>
                    </td>
                    <td>
                      <strong>{row.customerName}</strong>
                      <small>{row.district}</small>
                    </td>
                    <td>{row.phone}</td>
                    <td>{row.salesName}</td>
                    <td>
                      {row.category
                        ? INVOICE_CATEGORY_NAMES[row.category]
                        : "—"}
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

function WorkOrderRail({ selectedId }: { selectedId?: string }) {
  const { actor, engine } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [csFilter, setCsFilter] = useState("all");
  const manager =
    actor.role === "cs_supervisor" || actor.role === "admin";
  let team = [] as ReturnType<typeof engine.listCsTeam>;
  try {
    if (manager) team = engine.listCsTeam(actor);
  } catch {}
  const orders = engine.listOrders(actor).filter((order) => {
    const arrived = order.csReleasedAt ?? order.createdAt;
    if (month && !arrived.startsWith(month)) return false;
    if (manager && csFilter !== "all" && order.csOwnerId !== csFilter)
      return false;
    return true;
  });
  return (
    <aside className="order-rail">
      <div className="order-rail-head">
        <h2>工程單</h2>
        <label className="month-picker">
          <span>{formatMonthLabel(month)}</span>
          <CalendarDays size={18} />
          <input
            type="month"
            aria-label="工程單月份"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </div>
      {manager && (
        <div className="order-rail-manager">
          <select
            aria-label="跟進同事"
            value={csFilter}
            onChange={(event) => setCsFilter(event.target.value)}
          >
            <option value="all">全部同事</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="order-rail-list">
        {orders.length === 0 ? (
          <p className="section-empty">此月份沒有工程單。</p>
        ) : (
          orders.map((order) => {
            let invoiceNumber = "";
            try {
              invoiceNumber = engine.getInvoice(actor, order.invoiceId).number;
            } catch {}
            return (
              <Link
                key={order.id}
                to={"/orders/" + order.id}
                className={`order-rail-row ${selectedId === order.id ? "selected" : ""}`}
              >
                <strong>{order.number}</strong>
                <small>INV:{invoiceNumber || "—"}</small>
              </Link>
            );
          })
        )}
      </div>
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

function WorkOrderCalendar({
  order,
  assignments,
  extraWorks,
}: {
  order: WorkOrder;
  assignments: Assignment[];
  extraWorks: ExtraWork[];
}) {
  const [month, setMonth] = useState(order.startDate.slice(0, 7));
  useEffect(() => {
    setMonth(order.startDate.slice(0, 7));
  }, [order.id, order.startDate]);
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const events = new Map<string, string[]>();
  const addEvent = (startDate: string, endDate: string, label: string) => {
    dateRange(startDate, endDate).forEach((date) => {
      const list = events.get(date) ?? [];
      list.push(label);
      events.set(date, list);
    });
  };
  assignments.forEach((assignment) => {
    const line = order.lines.find((item) =>
      assignment.lineIds.includes(item.id),
    );
    addEvent(
      assignment.date,
      assignment.endDate ?? assignment.date,
      `${line?.itemSnapshot.name ?? "施工"} · ${assignment.time}`,
    );
  });
  extraWorks.forEach((extra) => {
    addEvent(
      extra.startDate,
      extra.endDate,
      `${EXTRA_WORK_LABELS[extra.kind]} · ${extra.time}`,
    );
  });
  const cells: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: days },
      (_, index) =>
        `${month}-${String(index + 1).padStart(2, "0")}`,
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
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
        {cells.map((date, index) => {
          if (!date) return <div className="calendar-empty" key={`empty-${index}`} />;
          const day = Number(date.slice(-2));
          const inPeriod = date >= order.startDate && date <= order.endDate;
          const dayEvents = events.get(date) ?? [];
          return (
            <div
              className={`calendar-cell ${inPeriod ? "in-period" : ""} ${date === DEMO_TODAY ? "today" : ""} ${dayEvents.length ? "has-events" : ""}`}
              key={date}
            >
              <span>{day}</span>
              {dayEvents.slice(0, 2).map((label, eventIndex) => (
                <small key={`${date}-${eventIndex}`}>{label}</small>
              ))}
              {dayEvents.length > 2 && <small>+{dayEvents.length - 2}</small>}
            </div>
          );
        })}
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
  const [dates, setDates] = useState(false);
  const [start, setStart] = useState(order.startDate);
  const [end, setEnd] = useState(order.endDate);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setSelectedLineId("");
    setEditingAssignmentId("");
    setResource("");
    setNotes("");
  }, [order.id]);
  const invoice = engine.getInvoice(actor, order.invoiceId);
  const assignments = engine.listAssignments(actor, order.id);
  const extraWorks = engine.listExtraWorks(actor, order.id);
  let resources = [] as ReturnType<typeof engine.listResources>;
  try {
    resources = engine.listResources(actor);
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
    const execution = selectedLine.itemSnapshot.execution;
    return resource.type === "contractor"
      ? execution === "contractor"
      : resource.type === "staff"
        ? execution === "self"
        : execution === "self" || execution === "service";
  });
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
  };
  const closeExtra = () => setExtraKind(null);
  return (
    <>
      <div className="workorder-head">
        <h1>{order.number}</h1>
        <Button onClick={() => nav("/documents/invoice/" + invoice.id)}>
          <Printer size={20} />
          Invoice
        </Button>
      </div>
      <div className="order-banner order-banner-with-dates">
        <div>
          <span>工程地址</span>
          <strong>{order.customer.address}</strong>
        </div>
        <div className="order-period">
          <div>
            <span>預計開工</span>
            <strong>{order.startDate}</strong>
          </div>
          <div>
            <span>預計完工</span>
            <strong>{order.endDate}</strong>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => {
                setStart(order.startDate);
                setEnd(order.endDate);
                setDates(true);
              }}
            >
              修改日期
            </Button>
          )}
        </div>
      </div>
      <WorkOrderCalendar
        order={order}
        assignments={assignments}
        extraWorks={extraWorks}
      />
      <Section title="工程內容" className="engineering-content-card">
        <div className="extra-works">
          <strong>額外工程</strong>
          <div className="extra-work-actions">
            {(["measure", "delivery", "transport"] as ExtraWorkKind[]).map(
              (kind) => {
                const existing = extraWorks.find(
                  (extra) => extra.kind === kind,
                );
                return (
                  <button
                    type="button"
                    key={kind}
                    className={`extra-work-button ${existing ? "scheduled" : ""}`}
                    onClick={() => openExtra(kind)}
                  >
                    {existing ? "更改" : "安排"}
                    {EXTRA_WORK_LABELS[kind]}
                  </button>
                );
              },
            )}
          </div>
        </div>
        <div className="engineering-table-wrap">
          <table className="engineering-table">
            <thead>
              <tr>
                <th scope="col">工程項目</th>
                <th scope="col">執行師傅</th>
                <th scope="col">開工時間</th>
                <th scope="col">完工時間</th>
                <th scope="col">備註</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const assignment = assigned.get(line.id);
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
                      <small>
                        {line.itemSnapshot.measure === "area"
                          ? `${line.length} × ${line.width} ${line.dimensionUnit}`
                          : line.itemSnapshot.measure === "length"
                            ? `${line.length} ${line.dimensionUnit}`
                            : line.itemSnapshot.measure === "fixed"
                              ? "一式"
                              : `${line.quantity} ${line.itemSnapshot.unit}`}
                      </small>
                    </td>
                    <td>{resource?.name ?? "—"}</td>
                    <td>{assignment?.date ?? "—"}</td>
                    <td>{assignment?.endDate ?? assignment?.date ?? "—"}</td>
                    <td>{assignment?.notes || "—"}</td>
                    <td>
                      <div className="engineering-row-actions">
                        {assignment && <Badge strong>已安排</Badge>}
                        {canEdit && (
                          <Button
                            variant={assignment ? "ghost" : "secondary"}
                            onClick={() =>
                              openAssignment(line.id, assignment?.id)
                            }
                          >
                            {assignment ? "更改安排" : "安排"}
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
                    <td>{resource?.name ?? "—"}</td>
                    <td>{extra.startDate}</td>
                    <td>{extra.endDate}</td>
                    <td>{extra.notes || "—"}</td>
                    <td>
                      <div className="engineering-row-actions">
                        <Badge strong>已安排</Badge>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            onClick={() => openExtra(extra.kind)}
                          >
                            更改安排
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
      <SitePhotos order={order} canEdit={canEdit} />
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
                    {resource.name}
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
                      {resource.name}
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
                !extraResourceId ||
                !extraStart ||
                !extraEnd ||
                extraEnd < extraStart
              }
              onClick={() => {
                const result = run(
                  () =>
                    engine.scheduleExtraWork(actor, order.id, {
                      kind: extraKind,
                      resourceId: extraResourceId,
                      startDate: extraStart,
                      endDate: extraEnd,
                      time: extraTime,
                      notes: extraNotes,
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
  return (
    <>
      <PageHead title="工程管理" />
      <div className="orders-workspace">
        <WorkOrderRail />
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
  const { actor, engine } = useApp();
  const nav = useNavigate();
  let order: WorkOrder | undefined;
  try {
    order = engine.getOrder(actor, id);
  } catch {}
  if (!order)
    return (
      <>
        <PageHead title="工程管理" />
        <div className="orders-workspace">
          <WorkOrderRail selectedId={id} />
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
      <div className="orders-workspace">
        <WorkOrderRail selectedId={id} />
        <div className="workorder-main">
          <OrderPanel order={order} />
        </div>
      </div>
    </>
  );
}

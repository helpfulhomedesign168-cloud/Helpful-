import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  FileText,
  Plus,
  Hammer,
  Printer,
} from "lucide-react";
import { useApp, showAttachment } from "../context";
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
} from "../domain/types";
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
        description="先核對已收款及分類；分類及有效首期未齊，不可開Invoice。"
      />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋Q號、客戶、地址或Sales"
          />
        </div>
        <div className="office-filter-row">
          <Field label="來源Team">
            <select
              value={teamFilter}
              onChange={(e) =>
                setTeamFilter(e.target.value as "all" | "A" | "B")
              }
            >
              <option value="all">全部Team</option>
              <option value="A">Team A</option>
              <option value="B">Team B</option>
            </select>
          </Field>
          <Field label="Sales">
            <select
              value={salesFilter}
              onChange={(e) => setSalesFilter(e.target.value)}
            >
              <option value="all">全部Sales</option>
              {salesActors.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}（Team {candidate.team ?? "—"}）
                </option>
              ))}
            </select>
          </Field>
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
                  <th>報價單</th>
                  <th>客戶／地區</th>
                  <th>Sales</th>
                  <th className="numeric">成交額</th>
                  <th>付款核對／證明</th>
                  <th>分類</th>
                  <th>操作</th>
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
                            {payment.proof && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  showAttachment(payment.proof!).catch(
                                    (error) =>
                                      run(() => {
                                        throw error;
                                      }),
                                  )
                                }
                              >
                                <FileText size={16} /> 證明
                              </button>
                            )}
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
                        {!eligibility.canIssue && (
                          <small>{eligibility.nextAction}</small>
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
  const { actor, engine } = useApp();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [active, setActive] = useState<HandoffRow | null>(null);
  const rows = engine.listHandoffs(actor);
  const nav = useNavigate();
  const shown = rows
    .filter((r) => tab === "all" || r.stage === tab)
    .filter((r) =>
      `${r.number} ${r.customerName} ${r.district} ${r.salesName}`.includes(
        search,
      ),
    );
  return (
    <>
      <PageHead eyebrow="CS接力入口" title="接單跟進" />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋Q號、客戶、地區或Sales"
          />
        </div>
        <div className="tabs">
          {[
            ["all", "可安排工程"],
            ["issued", "已發工程部"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => setTab(key)}
            >
              {label}
              <span>
                {rows.filter((r) => key === "all" || r.stage === key).length}
              </span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <Empty
            title="暫無接單資料"
            description="開單後累計有效收款達成交額50%，工程單才會自動發到這裏。"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>交接來源</th>
                  <th>客戶／地區</th>
                  <th>Sales</th>
                  <th>目前進度</th>
                  <th>下一步</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.quoteId}>
                    <td>
                      <strong className="source-link">{r.number}</strong>
                    </td>
                    <td>
                      <strong>{r.customerName}</strong>
                      <small>{r.district}</small>
                    </td>
                    <td>{r.salesName}</td>
                    <td>
                      <Badge strong={r.stage === "issued"}>{r.label}</Badge>
                    </td>
                    <td className="next-step">{r.nextAction}</td>
                    <td>
                      <Button
                        onClick={() =>
                          r.workOrderId
                            ? nav("/orders/" + r.workOrderId)
                            : setActive(r)
                        }
                      >
                        {r.workOrderId ? "安排工程" : "查看交接"}{" "}
                        <ArrowRight size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {active && (
        <Dialog title="接單摘要" onClose={() => setActive(null)}>
          <Badge>{active.label}</Badge>
          <h3 className="handoff-title">
            {active.number} · {active.customerName}
          </h3>
          <p>{active.address}</p>
          <div className="review-details">
            <div>
              <span>Sales</span>
              <strong>{active.salesName}</strong>
            </div>
            <div>
              <span>首期應收</span>
              <strong>{money(active.firstDue)}</strong>
            </div>
            <div>
              <span>會計已核</span>
              <strong>{money(active.validPaid)}</strong>
            </div>
            <div>
              <span>待核款</span>
              <strong>{money(active.pendingPaid)}</strong>
            </div>
          </div>
          <h3>工程範圍</h3>
          {active.items.map((i, n) => (
            <div className="handoff-item" key={n}>
              <strong>{i.name}</strong>
              <span>
                {i.position} · {i.style || "無款式選擇"}
              </span>
            </div>
          ))}
          <div className="tools-note">
            <strong>下一步</strong>
            <p>{active.nextAction}</p>
          </div>
          <Button className="full-width" onClick={() => setActive(null)}>
            返回接單清單
          </Button>
        </Dialog>
      )}
    </>
  );
}
export function Orders() {
  const { actor, engine } = useApp();
  const [search, setSearch] = useState("");
  const nav = useNavigate();
  const orders = engine
    .listOrders(actor)
    .filter((o) =>
      `${o.number}${o.customer.name}${o.customer.address}`.includes(search),
    );
  return (
    <>
      <PageHead eyebrow="施工接力" title="工程管理" />
      <div className="list-panel">
        <div className="list-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋工程編號、客戶或地址"
          />
        </div>
        {orders.length === 0 ? (
          <Empty
            title="暫無正式工程"
            description="開單後累計有效收款達成交額50%，工程單才會自動出現在這裏。"
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>工程／Invoice</th>
                  <th>客戶／地址</th>
                  <th>預計開工</th>
                  <th>預計完工</th>
                  <th>安排狀態</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link className="source-link" to={"/orders/" + o.id}>
                        {o.number}
                      </Link>
                      <small>
                        {engine.getInvoice(actor, o.invoiceId).number}
                      </small>
                    </td>
                    <td>
                      <strong>{o.customer.name}</strong>
                      <small>
                        {o.customer.district} · {o.customer.estate}
                      </small>
                    </td>
                    <td>{o.startDate}</td>
                    <td>{o.endDate}</td>
                    <td>
                      <Badge strong={o.status === "arranged"}>
                        {o.status === "arranged" ? "已安排" : "待安排"}
                      </Badge>
                    </td>
                    <td>
                      <Button onClick={() => nav("/orders/" + o.id)}>
                        查看工程 <ArrowRight size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
export function OrderDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("arrange");
  const [resourceId, setResource] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("未定");
  const [notes, setNotes] = useState("");
  const [dates, setDates] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  let order: WorkOrder | undefined;
  try {
    order = engine.getOrder(actor, id);
  } catch {}
  if (!order)
    return (
      <Empty
        title="沒有這個工程的查看權限"
        action={<Button onClick={() => nav("/orders")}>返回</Button>}
      />
    );
  const invoice = engine.getInvoice(actor, order.invoiceId),
    assignments = engine.listAssignments(actor, id);
  let resources = [] as ReturnType<typeof engine.listResources>;
  try {
    resources = engine.listResources(actor);
  } catch {}
  const resource = resources.find((r) => r.id === resourceId);
  const canEdit = actor.role === "cs" || actor.role === "admin";
  const assigned = new Set(assignments.flatMap((a) => a.lineIds));
  function compatible(execution: string) {
    return resource?.type === "contractor"
      ? execution === "contractor"
      : resource?.type === "staff"
        ? execution === "self"
        : resource?.type === "service"
          ? execution !== "contractor"
          : true;
  }
  return (
    <>
      <PageHead
        eyebrow={order.number}
        title={`${order.customer.name}的工程`}
        actions={
          <>
            <Button onClick={() => nav("/orders")}>返回工程</Button>
            <Button onClick={() => nav("/documents/invoice/" + invoice.id)}>
              <Printer size={20} />
              Invoice
            </Button>
          </>
        }
      />
      <div className="order-banner">
        <div>
          <span>工程地址</span>
          <strong>{order.customer.address}</strong>
        </div>
        <Badge strong={order.status === "arranged"}>
          {order.status === "arranged" ? "已安排" : "待安排"}
        </Badge>
      </div>
      <div className="order-meta">
        <span>
          <CalendarDays size={20} />
          預計開工 {order.startDate}
        </span>
        <span>預計完工 {order.endDate}</span>
        {canEdit && (
          <Button
            variant="ghost"
            onClick={() => {
              setStart(order!.startDate);
              setEnd(order!.endDate);
              setDates(true);
            }}
          >
            修改日期
          </Button>
        )}
      </div>
      <div className="tabs page-tabs">
        <button
          className={tab === "arrange" ? "selected" : ""}
          onClick={() => setTab("arrange")}
        >
          工程安排
        </button>
        <button
          className={tab === "overview" ? "selected" : ""}
          onClick={() => setTab("overview")}
        >
          工程內容
        </button>
        <button
          className={tab === "documents" ? "selected" : ""}
          onClick={() => setTab("documents")}
        >
          來源單據
        </button>
      </div>
      {tab === "arrange" ? (
        <div className="detail-layout">
          <div>
            <Section title="已安排項目">
              {assignments.length === 0 ? (
                <p className="section-empty">未安排判頭或公司師傅。</p>
              ) : (
                assignments.map((a) => (
                  <article className="assignment-card" key={a.id}>
                    <div>
                      <span className="assignment-icon">
                        <Hammer size={24} />
                      </span>
                      <h3>
                        {resources.find((r) => r.id === a.resourceId)?.name ||
                          "已分派執行對象"}
                      </h3>
                      <Badge>已安排</Badge>
                    </div>
                    <p>
                      {a.lineIds
                        .map(
                          (l) =>
                            order!.lines.find((x) => x.id === l)?.itemSnapshot
                              .name,
                        )
                        .join("、")}
                    </p>
                    <span>
                      {a.date} · {a.time}
                    </span>
                    {a.notes && <p>{a.notes}</p>}
                  </article>
                ))
              )}
            </Section>
            {canEdit && (
              <Section title="安排判頭／公司師傅">
                <div className="form-grid two">
                  <Field label="執行對象" required>
                    <select
                      value={resourceId}
                      onChange={(e) => {
                        setResource(e.target.value);
                        setSelected([]);
                      }}
                    >
                      <option value="">選擇判頭或公司師傅</option>
                      {resources
                        .filter((r) => r.active)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ·{" "}
                            {r.type === "contractor"
                              ? "判頭"
                              : r.type === "staff"
                                ? "公司師傅"
                                : "服務供應商"}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="預計施工日期" required>
                    <input
                      type="date"
                      value={date || order.startDate}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label="時段">
                    <select
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    >
                      {["未定", "上午", "下午", "全天"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <h3 className="small-heading">選擇承接的工程明細</h3>
                <div className="assignment-lines">
                  {order.lines.map((l) => (
                    <label
                      key={l.id}
                      className={`assignment-line ${assigned.has(l.id) || !compatible(l.itemSnapshot.execution) ? "unavailable" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        disabled={
                          assigned.has(l.id) ||
                          !resourceId ||
                          !compatible(l.itemSnapshot.execution)
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, l.id]
                              : selected.filter((x) => x !== l.id),
                          )
                        }
                      />
                      <span>
                        <strong>{l.itemSnapshot.name}</strong>
                        <small>
                          {l.position} ·{" "}
                          {l.itemSnapshot.execution === "contractor"
                            ? "外判"
                            : l.itemSnapshot.execution === "self"
                              ? "公司自營"
                              : "服務供應商"}
                        </small>
                      </span>
                      {assigned.has(l.id) && <Badge>已安排</Badge>}
                    </label>
                  ))}
                </div>
                <Field label="安排備註">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="與判頭確認的檔期或要留意的事項"
                  />
                </Field>
                <Button
                  variant="primary"
                  onClick={() => {
                    const a = run(
                      () =>
                        engine.assign(actor, id, {
                          resourceId,
                          lineIds: selected,
                          date: date || order!.startDate,
                          time,
                          notes,
                        }),
                      "安排已保存。",
                    );
                    if (a) {
                      setSelected([]);
                      setResource("");
                      setNotes("");
                    }
                  }}
                >
                  <Check size={20} />
                  儲存安排
                </Button>
              </Section>
            )}
          </div>
          <aside className="quote-summary">
            <span className="eyebrow">來源關聯</span>
            <h2>工程摘要</h2>
            <div className="summary-row">
              <span>工程明細</span>
              <strong>{order.lines.length} 項</strong>
            </div>
            <div className="summary-row">
              <span>已安排</span>
              <strong>{assigned.size} 項</strong>
            </div>
            <div className="summary-row">
              <span>待安排</span>
              <strong>{order.lines.length - assigned.size} 項</strong>
            </div>
            <div className="summary-total">
              <span>Invoice成交額</span>
              <strong>{money(invoice.netTotal)}</strong>
            </div>
            <p className="summary-note">安排紀錄不代表已進場施工。</p>
          </aside>
        </div>
      ) : tab === "overview" ? (
        <Section title="有效工程內容">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>工程項目</th>
                  <th>位置／款式</th>
                  <th>範圍</th>
                  <th>執行方式</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.itemSnapshot.name}</strong>
                      {l.notes && <small>{l.notes}</small>}
                    </td>
                    <td>
                      {l.position}
                      <small>{l.style}</small>
                    </td>
                    <td>
                      {l.itemSnapshot.measure === "area"
                        ? `${l.length}×${l.width}${l.dimensionUnit}`
                        : l.itemSnapshot.measure === "length"
                          ? `${l.length}${l.dimensionUnit}`
                          : l.itemSnapshot.measure === "fixed"
                            ? "一式"
                            : `${l.quantity}${l.itemSnapshot.unit}`}
                    </td>
                    <td>
                      <Badge>
                        {l.itemSnapshot.execution === "contractor"
                          ? "外判"
                          : "公司／服務自營"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section title="來源單據">
          <div className="document-row">
            <FileText size={28} />
            <div>
              <strong>{invoice.number}</strong>
              <small>主Invoice · 已鎖定成交內容</small>
            </div>
            <Button onClick={() => nav("/documents/invoice/" + invoice.id)}>
              預覽Invoice <ArrowRight size={20} />
            </Button>
          </div>
          <p className="muted">
            工程連接有效Invoice及原簽版本；CS不開原報價或簽署報價PDF。
          </p>
        </Section>
      )}
      {dates && (
        <Dialog title="修改預計工程日期" onClose={() => setDates(false)}>
          <div className="form-grid two">
            <Field label="預計開工" required>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="預計完工" required>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="修改原因" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setDates(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = run(() => {
                  engine.updateDates(actor, id, { start, end, reason });
                  return true;
                }, "日期已更新，原值及原因已留記錄。");
                if (r) setDates(false);
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

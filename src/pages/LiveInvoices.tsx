import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, PenLine, Plus } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError, type ApiPayment, type InvoiceDetailData, type InvoiceSummary } from "../api/client";
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
} from "../components/ui";
import { METHOD_NAMES, money } from "../domain/types";
import { exportLiveInvoiceExcel } from "../exportLiveInvoiceExcel";

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const STATUS_LABELS: Record<string, string> = {
  issued: "待收足訂金",
  partially_paid: "收款中",
  paid: "已收足",
  released: "已發工程部",
  completed: "已完成工程",
  voided: "已退訂",
  refunded: "已退款",
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function LiveInvoices() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "100" });
    if (search.trim()) params.set("q", search.trim());
    if (status !== "all") params.set("status", status);
    apiRequest<InvoiceSummary[]>(`/invoices?${params}`, accessToken)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "無法讀取發票。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, search, status]);

  return (
    <>
      <PageHead title="單據管理" />
      <div className="list-panel">
        <div className="submission-toolbar invoice-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋 Invoice／客戶／電話" />
          <div className="submission-filters">
            <select aria-label="Invoice狀態" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">全部狀態</option>
              <option value="issued">待收足訂金</option>
              <option value="partially_paid">收款中</option>
              <option value="paid">已收足</option>
              <option value="released">已發工程部</option>
              <option value="completed">已完成工程</option>
            </select>
            <Badge>Live API</Badge>
          </div>
        </div>
        {loading ? (
          <p className="muted">正在讀取 Supabase 發票…</p>
        ) : error ? (
          <Empty title="未能讀取發票" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無 Invoice" description="API 已接通；建立發票功能會在下一步接入。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Invoice單</th>
                  <th>日期</th>
                  <th>客戶</th>
                  <th>Sales</th>
                  <th>收款進度</th>
                  <th>分類</th>
                  <th>狀態</th>
                  <th className="numeric">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => {
                  const percent = invoice.totalCents
                    ? Math.round((invoice.validPaidCents / invoice.totalCents) * 100)
                    : 0;
                  return (
                    <tr
                      key={invoice.id}
                      className="invoice-clickable-row"
                      tabIndex={0}
                      onMouseEnter={() =>
                        void apiRequest(`/invoices/${invoice.id}`, accessToken).catch(() => {})
                      }
                      onFocus={() =>
                        void apiRequest(`/invoices/${invoice.id}`, accessToken).catch(() => {})
                      }
                      onClick={() => nav(`/invoices/${invoice.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          nav(`/invoices/${invoice.id}`);
                        }
                      }}
                    >
                      <td><strong>{invoice.number}</strong></td>
                      <td>{invoice.createdAt.slice(0, 10)}</td>
                      <td><strong>{invoice.customerName}</strong><small>{invoice.customerPhone}</small></td>
                      <td>{invoice.salesName || "—"}</td>
                      <td>
                        <div className="payment-progress">
                          <div className="payment-progress-label">
                            <span>已核 {money(invoice.validPaidCents / 100)}</span>
                            <strong>{percent}%</strong>
                          </div>
                          <div className="payment-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                            <span style={{ width: `${Math.min(100, percent)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><CategoryChips categories={invoice.categories as never} /></td>
                      <td><Badge strong={invoice.status === "completed"}>{statusLabel(invoice.status)}</Badge></td>
                      <td className="numeric">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`修改${invoice.number}`}
                          title="修改單"
                          onClick={(event) => {
                            event.stopPropagation();
                            nav(`/invoices/${invoice.id}/edit`);
                          }}
                        >
                          <PenLine size={19} />
                        </button>
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

export function LiveInvoiceDetail() {
  const { id = "" } = useParams();
  const { accessToken, user } = useAuth();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetailData | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStage, setPaymentStage] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("fps");
  const [paymentCustody, setPaymentCustody] = useState<"company" | "sales">("company");
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [proofFileId, setProofFileId] = useState("");
  const [proofName, setProofName] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [receipts, setReceipts] = useState<Record<string, { id: string; number: string }>>({});
  const [exporting, setExporting] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<InvoiceDetailData>(`/invoices/${id}`, accessToken),
      apiRequest<ApiPayment[]>(`/invoices/${id}/payments`, accessToken),
    ])
      .then(([detail, paymentRows]) => {
        if (cancelled) return;
        setInvoice(detail);
        setPayments(paymentRows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "無法讀取發票。");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  async function reload() {
    const [detail, paymentRows] = await Promise.all([
      apiRequest<InvoiceDetailData>(`/invoices/${id}`, accessToken),
      apiRequest<ApiPayment[]>(`/invoices/${id}/payments`, accessToken),
    ]);
    setInvoice(detail);
    setPayments(paymentRows);
  }

  async function registerPayment(
    event: React.FormEvent | null,
    confirm = true,
  ) {
    event?.preventDefault();
    if (!accessToken) return;
    setPaymentSaving(true);
    setPaymentNotice("");
    try {
      await apiRequest(`/invoices/${id}/payments`, accessToken, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          installment: paymentStage,
          amountCents: Math.round(Number(paymentAmount) * 100),
          method: paymentMethod,
          custody: paymentCustody,
          paidAt: paymentDate,
          confirm,
          proofFileId: proofFileId || undefined,
        }),
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentCustody("company");
      setProofFileId("");
      setProofName("");
      await reload();
      setPaymentNotice(
        confirm
          ? "付款已確認，Invoice 已更新。"
          : "已儲存待核對，會計核對後才計入有效收款。",
      );
    } catch (e) {
      setPaymentNotice(e instanceof ApiError ? e.message : "付款登記失敗。");
    } finally {
      setPaymentSaving(false);
    }
  }

  async function issueReceipt(paymentId: string) {
    if (!accessToken) return;
    try {
      const receipt = await apiRequest<{ id: string; number: string }>(
        `/invoices/${id}/payments/${paymentId}/receipt`,
        accessToken,
        { method: "POST" },
      );
      setReceipts((current) => ({
        ...current,
        [paymentId]: { id: receipt.id, number: receipt.number },
      }));
    } catch (e) {
      setPaymentNotice(e instanceof ApiError ? e.message : "未能出收據。");
    }
  }

  if (error) return <Empty title="未能讀取發票" description={error} action={<button className="btn" onClick={() => nav("/invoices")}>返回</button>} />;
  if (!invoice) return <p className="muted">正在讀取發票…</p>;

  const percent = invoice.totalCents ? Math.round((invoice.validPaidCents / invoice.totalCents) * 100) : 0;
  return (
    <>
      <div className="page-head">
        <div>
          <button className="icon-button" onClick={() => nav("/invoices")} aria-label="返回單據管理"><ArrowLeft size={20} /></button>
          <p className="eyebrow">Invoice · Live API</p>
          <h1>{invoice.number}</h1>
        </div>
        <div className="page-actions">
          <Button onClick={() => nav(`/documents/invoice/${id}`)}>列印 Invoice</Button>
          <Button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportLiveInvoiceExcel(invoice);
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "匯出中…" : "匯出 Excel"}
          </Button>
          {["finance", "finance_supervisor", "admin"].includes(user?.role ?? "") && (
            <Button variant="secondary" onClick={() => setRefundOpen(true)}>
              退款
            </Button>
          )}
          <Badge strong={invoice.status === "completed"}>{statusLabel(invoice.status)}</Badge>
        </div>
      </div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>成交總額</span><strong>{money(invoice.totalCents / 100)}</strong></div>
          <div><span>已核有效收款</span><strong>{money(invoice.validPaidCents / 100)} · {percent}%</strong></div>
          <div><span>客戶</span><strong>{invoice.customer.name}</strong><small>{invoice.customer.phone}</small></div>
        </div>
        {invoice.paymentStatus && !invoice.paymentStatus.completed && <p className="release-gate-note">尚未收足：累計有效收款需達 {money(invoice.paymentStatus.csReleaseDueCents / 100)}（成交額50%）。核對付款後會自動建立工程單及通知CS。</p>}
        <div className="form-grid two">
          <div><span className="muted">發票日期</span><p>{invoice.createdAt.slice(0, 10)}</p></div>
          <div><span className="muted">Sales</span><p>{invoice.salesName || "—"}</p></div>
        </div>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table live-work-table">
            <thead><tr><th>項目</th><th>位置</th><th>數量</th><th>單價</th><th className="numeric">金額</th></tr></thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td><strong>{line.name}</strong></td>
                  <td>{line.position || "—"}</td>
                  <td>{line.quantity} {line.unit}</td>
                  <td>{money(line.unitPriceCents / 100)}</td>
                  <td className="numeric">{money(line.amountCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Section title="收款狀況及收據" action={<Badge strong={invoice.paymentStatus?.completed}>{invoice.paymentStatus?.completed ? "已收清" : "收款進行中"}</Badge>}>
          <p className="muted">每筆付款先核對為有效款，之後可獨立發出收據；付款證明只在開單／會計工作區可見。</p>
          {paymentNotice && <p className="muted">{paymentNotice}</p>}
          <div className="installment-list">
            {(invoice.paymentStatus?.installments ?? []).map((stage) => {
              const stagePayments = payments.filter((payment) => payment.installment === stage.installment);
              const remaining = Math.max(0, stage.amountCents - stage.receivedCents - stage.pendingCents);
              const canAdd = ["invoice_clerk", "admin"].includes(user?.role ?? "") && stage.status !== "locked" && remaining > 0;
              const statusLabel = stage.status === "locked" ? "待前一期收足" : stage.status === "under_review" ? "待核對" : stage.status === "ready_receipt" ? "可發收據" : stage.status === "receipted" ? "已收妥" : "待收款";
              return (
                <article className="installment-card" key={stage.installment}>
                  <header><div><span>第{stage.installment}期 · {stage.percentage}%</span><h3>{stage.label}</h3></div><Badge strong={stage.status === "receipted" || stage.status === "ready_receipt"}>{statusLabel}</Badge></header>
                  <div className="installment-amounts"><div><span>本期應收</span><strong>{money(stage.amountCents / 100)}</strong></div><div><span>已核</span><strong>{money(stage.receivedCents / 100)}</strong></div><div><span>累計至本期</span><strong>{money(stage.cumulativeCents / 100)}</strong></div></div>
                  {stagePayments.length ? <div className="payment-ledger">{stagePayments.map((payment) => <div className="payment-row" key={payment.id}><div><strong>{money(payment.amountCents / 100)}</strong><small>{payment.paidAt} · {METHOD_NAMES[payment.method as keyof typeof METHOD_NAMES] || payment.method} · {payment.reference || "未填參考"}</small></div><div className="table-actions"><Badge strong={payment.status === "valid"}>{payment.status === "valid" ? "已核" : payment.status === "pending" ? "待核對" : "已退回"}</Badge>{payment.proofUrl && <a className="text-button" href={payment.proofUrl} target="_blank" rel="noreferrer">付款證明</a>}{payment.status === "valid" && !receipts[payment.id] && <Button variant="ghost" onClick={() => issueReceipt(payment.id)}>出收據</Button>}{receipts[payment.id] && <Button variant="ghost" onClick={() => nav(`/documents/receipt/${receipts[payment.id].id}`)}>{receipts[payment.id].number} · 查看收據</Button>}</div></div>)}</div> : <p className="muted">尚未登記此期款。</p>}
                  {canAdd && <Button className="installment-add" variant="primary" onClick={() => { setPaymentStage(stage.installment); setPaymentAmount(String(remaining / 100)); setPaymentDate(todayLocal()); setProofFileId(""); setProofName(""); setPaymentNotice(""); setPaymentOpen(true); }}><Plus size={20} /> 登記第{stage.installment}期款</Button>}
                </article>
              );
            })}
          </div>
        </Section>
        {refundOpen && (
        <Dialog title="建立退款個案" onClose={() => setRefundOpen(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!accessToken) return;
              setRefundSaving(true);
              setRefundError("");
              try {
                const created = await apiRequest<{ id: string; invoiceId: string; status: string }>(
                  "/cancellation-cases",
                  accessToken,
                  {
                    method: "POST",
                    body: JSON.stringify({ invoiceId: invoice.id, reason: refundReason }),
                  },
                );
                setRefundOpen(false);
                nav(`/cancellation-cases/${created.id}`);
              } catch (e) {
                setRefundError(e instanceof ApiError ? e.message : "未能建立退款個案。");
              } finally {
                setRefundSaving(false);
              }
            }}
          >
            <p className="muted">此個案會交會計處理；Invoice 及收款紀錄不會即時改動。</p>
            <Field label="退款原因" required>
              <textarea
                rows={3}
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                required
              />
            </Field>
            {refundError && <p className="auth-error">{refundError}</p>}
            <div className="dialog-actions">
              <Button type="button" onClick={() => setRefundOpen(false)}>取消</Button>
              <Button type="submit" variant="danger" disabled={refundSaving}>
                {refundSaving ? "建立中…" : "建立退款個案"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {paymentOpen && (
          <Dialog title={`登記第${paymentStage}期款`} onClose={() => setPaymentOpen(false)}>
            <form onSubmit={(event) => registerPayment(event, true)}>
              <div className="form-grid two">
                <Field label="付款金額" required>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </Field>
                <Field label="付款日期" required>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </Field>
                <Field label="付款方式" required>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="fps">FPS</option>
                    <option value="transfer">銀行轉賬</option>
                    <option value="cash">現金</option>
                    <option value="cheque">支票</option>
                  </select>
                </Field>
              </div>
              <Field label="收款位置">
                <select value={paymentCustody} onChange={(event) => setPaymentCustody(event.target.value as "company" | "sales")}>
                  <option value="company">公司戶口／公司</option>
                  <option value="sales">Sales 保管</option>
                </select>
              </Field>
              <Field label="付款證明">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={proofUploading}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file || !accessToken) return;
                    setProofUploading(true);
                    try {
                      const data = new FormData();
                      data.append("file", file);
                      const uploaded = await apiUpload<{ id: string; filename: string }>(
                        `/invoices/${id}/proofs`,
                        accessToken,
                        data,
                      );
                      setProofFileId(uploaded.id);
                      setProofName(uploaded.filename);
                    } catch (e) {
                      setPaymentNotice(e instanceof ApiError ? e.message : "付款證明上載失敗。");
                    } finally {
                      setProofUploading(false);
                      event.target.value = "";
                    }
                  }}
                />
                {proofUploading ? <small>上載中…</small> : proofName ? <small>已上載：{proofName}</small> : null}
              </Field>
              <div className="dialog-actions">
                <Button type="button" onClick={() => setPaymentOpen(false)}>取消</Button>
                <Button
                  type="button"
                  onClick={() => registerPayment(null, false)}
                  disabled={paymentSaving}
                >
                  儲存待核對
                </Button>
                <Button type="submit" variant="primary" disabled={paymentSaving}>
                  {paymentSaving ? "儲存中…" : "確認收款"}
                </Button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError, type ApiPayment, type InvoiceDetailData, type InvoiceSummary } from "../api/client";
import { Badge, CategoryChips, Empty, PageHead, Search } from "../components/ui";
import { METHOD_NAMES, money } from "../domain/types";

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
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetailData | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [error, setError] = useState("");

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
        <Badge strong={invoice.status === "completed"}>{statusLabel(invoice.status)}</Badge>
      </div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>成交總額</span><strong>{money(invoice.totalCents / 100)}</strong></div>
          <div><span>已核有效收款</span><strong>{money(invoice.validPaidCents / 100)} · {percent}%</strong></div>
          <div><span>客戶</span><strong>{invoice.customer.name}</strong><small>{invoice.customer.phone}</small></div>
        </div>
        <div className="form-grid two">
          <div><span className="muted">發票日期</span><p>{invoice.createdAt.slice(0, 10)}</p></div>
          <div><span className="muted">Sales</span><p>{invoice.salesName || "—"}</p></div>
        </div>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table">
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
        <h2 className="section-title">付款記錄</h2>
        {payments.length === 0 ? <p className="muted">尚未登記付款。</p> : (
          <div className="payment-ledger">
            {payments.map((payment) => (
              <div className="payment-row" key={payment.id}>
                <div>
                  <strong>{money(payment.amountCents / 100)}</strong>
                  <small>第{payment.installment}期 · {payment.paidAt} · {METHOD_NAMES[payment.method as keyof typeof METHOD_NAMES] || payment.method} · {payment.reference || "未填參考"}</small>
                </div>
                <Badge strong={payment.status === "valid"}>{payment.status === "valid" ? "已核" : payment.status === "pending" ? "待核對" : "已退回"}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

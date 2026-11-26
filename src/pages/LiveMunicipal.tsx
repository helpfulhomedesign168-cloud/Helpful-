import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, PageHead } from "../components/ui";
import { money } from "../domain/types";

type MunicipalRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  invoiceId: string;
  invoiceNumber: string;
  grantApplicationNumber: string | null;
  grantApprovedAmountCents: number | null;
  totalCents: number;
  validPaidCents: number;
  principalOrderId: string;
  principalOrderNumber: string;
  customerName: string;
  customerPhone: string;
};

type MunicipalDetail = Omit<MunicipalRow, "invoiceId" | "invoiceNumber" | "principalOrderId" | "principalOrderNumber" | "customerName" | "customerPhone"> & {
  invoice: {
    id: string;
    number: string;
    categories: string[];
    totalCents: number;
    validPaidCents: number;
    grantApplicationNumber: string | null;
    grantApprovedAmountCents: number | null;
  };
  principal: { id: string; number: string; status: string };
  customer: { name: string; phone: string; address: string | null; district: string | null };
  lines: { id: string; name: string; position: string | null; quantity: string; unit: string; unitPriceCents: number; amountCents: number }[];
};

export function LiveMunicipalOrders() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<MunicipalRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest<MunicipalRow[]>("/municipal-orders", accessToken)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "未能讀取市政單。"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accessToken]);

  return (
    <>
      <PageHead title="市政單" />
      <div className="list-panel">
        {loading ? <p className="muted">正在讀取市政單…</p> : error ? (
          <Empty title="未能讀取市政單" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無市政單" description="8萬資助 Invoice 收足 50% 後會自動建立市政單。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>市政單</th><th>正單</th><th>Invoice</th><th>客戶</th><th>申請編號</th><th>批核金額</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="invoice-clickable-row" onClick={() => nav(`/municipal-orders/${row.id}`)}>
                    <td><strong>{row.number}</strong></td>
                    <td>{row.principalOrderNumber}</td>
                    <td>{row.invoiceNumber}</td>
                    <td><strong>{row.customerName}</strong><small>{row.customerPhone}</small></td>
                    <td>{row.grantApplicationNumber || "待批核"}</td>
                    <td>{row.grantApprovedAmountCents ? money(row.grantApprovedAmountCents / 100) : "—"}</td>
                    <td><Button variant="ghost" onClick={(event) => { event.stopPropagation(); nav(`/municipal-orders/${row.id}`); }}>查看</Button></td>
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

export function LiveMunicipalOrderDetail() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState<MunicipalDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<MunicipalDetail>(`/municipal-orders/${id}`, accessToken)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取市政單。"));
  }, [accessToken, id]);

  if (error) return <Empty title="未能讀取市政單" description={error} />;
  if (!order) return <p className="muted">正在讀取市政單…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="icon-button" onClick={() => nav("/municipal-orders")} aria-label="返回市政單"><ArrowLeft size={20} /></button>
          <p className="eyebrow">市政單 · Live API</p>
          <h1>{order.number}</h1>
        </div>
        <Badge strong>{order.status}</Badge>
      </div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>正單工程單</span><strong>{order.principal.number}</strong><small>{order.principal.status}</small></div>
          <div><span>Invoice</span><strong>{order.invoice.number}</strong><small>{money(order.invoice.totalCents / 100)}</small></div>
          <div><span>8萬批核</span><strong>{order.invoice.grantApplicationNumber || "待批核"}</strong><small>{order.invoice.grantApprovedAmountCents ? money(order.invoice.grantApprovedAmountCents / 100) : "—"}</small></div>
        </div>
        <div className="form-grid two">
          <div><span className="muted">客戶</span><p>{order.customer.name} · {order.customer.phone}</p></div>
          <div><span className="muted">地址</span><p>{order.customer.address || order.customer.district || "—"}</p></div>
        </div>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table live-work-table">
            <thead><tr><th>項目</th><th>位置</th><th>數量</th><th>單價</th><th>金額</th></tr></thead>
            <tbody>{order.lines.map((line) => <tr key={line.id}><td>{line.name}</td><td>{line.position || "—"}</td><td>{line.quantity} {line.unit}</td><td>{money(line.unitPriceCents / 100)}</td><td>{money(line.amountCents / 100)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="muted">市政單只作 8萬資助申請用途，不影響 Invoice、會計及正單。</p>
      </div>
    </>
  );
}

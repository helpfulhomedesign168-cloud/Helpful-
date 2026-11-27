import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty } from "../components/ui";
import { money } from "../domain/types";

type Customer = { id: string; name: string; phone: string; whatsapp: string | null; address: string | null; district: string | null; createdAt: string };
type InvoiceRow = { id: string; number: string; status: string; categories: string[]; totalCents: number; validPaidCents: number; createdAt: string };

const STATUS_LABELS: Record<string, string> = {
  issued: "待收訂金", partially_paid: "收款中", paid: "已收足", released: "已發工程",
  completed: "已完成工程", voided: "已退訂", refunded: "已退款",
};

export function LiveCustomerDetail() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      apiRequest<Customer>(`/customers/${id}`, accessToken),
      apiRequest<InvoiceRow[]>(`/customers/${id}/invoices`, accessToken),
    ]).then(([c, rows]) => { setCustomer(c); setInvoices(rows); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取客戶。"));
  }, [accessToken, id]);
  if (error) return <Empty title="未能讀取客戶" description={error} />;
  if (!customer) return <p className="muted">正在讀取客戶…</p>;
  return (
    <>
      <div className="page-head"><div><button className="icon-button" onClick={() => nav("/customers")} aria-label="返回客戶"><ArrowLeft size={20} /></button><p className="eyebrow">客戶 · Live API</p><h1>{customer.name}</h1></div></div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>電話</span><strong>{customer.phone}</strong></div>
          <div><span>WhatsApp</span><strong>{customer.whatsapp || "—"}</strong></div>
          <div><span>地區／地址</span><strong>{customer.district || customer.address || "—"}</strong></div>
        </div>
        <h2 className="section-title">Invoice 紀錄</h2>
        {invoices.length === 0 ? <p className="muted">暫無 Invoice。</p> : (
          <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>Invoice</th><th>日期</th><th>總額</th><th>已收</th><th>狀態</th><th /></tr></thead><tbody>{invoices.map((row) => <tr key={row.id}><td><strong>{row.number}</strong></td><td>{row.createdAt.slice(0, 10)}</td><td>{money(row.totalCents / 100)}</td><td>{money(row.validPaidCents / 100)}</td><td><Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge></td><td><Button variant="ghost" onClick={() => nav(`/invoices/${row.id}`)}>查看</Button></td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Empty, PageHead } from "../components/ui";
import { money } from "../domain/types";

type Summary = {
  totals: { invoiceCount: number; billedCents: number; collectedCents: number; outstandingCents: number };
  statuses: { status: string; count: number; totalCents: number }[];
  recent: { id: string; number: string; status: string; totalCents: number; validPaidCents: number; createdAt: string; customerName: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  issued: "待收訂金",
  partially_paid: "收款中",
  paid: "已收足",
  released: "已發工程",
  completed: "已完成工程",
  voided: "已退訂",
  refunded: "已退款",
};

export function LiveAccountingDashboard() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<Summary>("/reports/summary", accessToken)
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取會計數據。"));
  }, [accessToken]);

  if (error) return <Empty title="未能讀取會計數據" description={error} />;
  if (!summary) return <p className="muted">正在讀取會計數據…</p>;

  return (
    <>
      <PageHead title="儀表板" />
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>發票數量</span><strong>{summary.totals.invoiceCount}</strong></div>
          <div><span>營業總額</span><strong>{money(summary.totals.billedCents / 100)}</strong></div>
          <div><span>已收有效</span><strong>{money(summary.totals.collectedCents / 100)}</strong></div>
          <div><span>未收餘額</span><strong>{money(summary.totals.outstandingCents / 100)}</strong></div>
        </div>
        <h2 className="section-title">狀態分佈</h2>
        <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>狀態</th><th>數量</th><th>總額</th></tr></thead><tbody>{summary.statuses.map((row) => <tr key={row.status}><td><Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge></td><td>{row.count}</td><td>{money(row.totalCents / 100)}</td></tr>)}</tbody></table></div>
        <h2 className="section-title">最近 Invoice</h2>
        {summary.recent.length === 0 ? <p className="muted">暫無發票。</p> : (
          <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>Invoice</th><th>客戶</th><th>總額</th><th>已收</th><th>狀態</th></tr></thead><tbody>{summary.recent.map((row) => <tr key={row.id} className="invoice-clickable-row" onClick={() => nav(`/invoices/${row.id}`)}><td><strong>{row.number}</strong></td><td>{row.customerName}</td><td>{money(row.totalCents / 100)}</td><td>{money(row.validPaidCents / 100)}</td><td><Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge></td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}

type BusinessRow = { id: string; number: string; status: string; categories: string[]; totalCents: number; validPaidCents: number; salesName: string | null; createdAt: string; customerName: string; customerPhone: string };

export function LiveBusinessOrders() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<BusinessRow[]>("/reports/business-orders", accessToken)
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取營業單。"));
  }, [accessToken]);
  if (error) return <Empty title="未能讀取營業單" description={error} />;
  return (
    <>
      <PageHead title="營業單" />
      <div className="list-panel">
        <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>Invoice</th><th>日期</th><th>客戶</th><th>Sales</th><th>總額</th><th>已收</th><th>狀態</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="invoice-clickable-row" onClick={() => nav(`/invoices/${row.id}`)}><td><strong>{row.number}</strong></td><td>{row.createdAt.slice(0, 10)}</td><td>{row.customerName}<small>{row.customerPhone}</small></td><td>{row.salesName || "—"}</td><td>{money(row.totalCents / 100)}</td><td>{money(row.validPaidCents / 100)}</td><td><Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge></td></tr>)}</tbody></table></div>
        {rows.length === 0 && <p className="muted">暫無營業單。</p>}
      </div>
    </>
  );
}

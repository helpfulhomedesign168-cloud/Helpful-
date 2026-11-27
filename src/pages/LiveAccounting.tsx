import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, PageHead } from "../components/ui";
import { money } from "../domain/types";

type AccountingData = {
  month: string;
  turnoverCents: number; collectedCents: number; outstandingCents: number;
  expensesCents: number; grossProfitCents: number; commissionsCents: number; netProfitCents: number;
  jobCount: number; completedJobs: number;
  jobs: Array<{ invoiceId: string; invoiceNumber: string; orderNumber: string | null; customerName: string; salesName: string; category: string; revenueCents: number; collectedCents: number; expensesCents: number; grossProfitCents: number; margin: number; completed: boolean }>;
  months: Array<{ month: string; turnoverCents: number; expensesCents: number; grossProfitCents: number }>;
};

export function LiveAccountingDashboard() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<AccountingData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<AccountingData>(`/reports/accounting?month=${month}`, accessToken)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取會計數據。"));
  }, [accessToken, month]);

  if (error) return <Empty title="未能讀取會計數據" description={error} />;
  if (!data) return <p className="muted">正在讀取會計數據…</p>;
  const kpis = [
    ["本月營業額", data.turnoverCents, `${data.jobCount} 張 Invoice`, "primary"],
    ["已收款", data.collectedCents, "有效付款", ""],
    ["應收未收", data.outstandingCents, "待收餘額", ""],
    ["工程支出", data.expensesCents, "師傅及額外工程", ""],
    ["毛利", data.grossProfitCents, "營業額 − 工程支出", ""],
    ["應計 Sales 佣金", data.commissionsCents, "按已開單營業額計算", ""],
    ["扣除佣金後淨利", data.netProfitCents, `${data.completedJobs} 張工程已完成`, "net"],
  ] as const;
  const maxMonth = Math.max(1, ...data.months.map((row) => row.turnoverCents));
  return (
    <>
      <PageHead eyebrow="會計主管 · 公司營運" title="儀表板" actions={<label className="month-picker"><span>統計月份</span><input type="month" aria-label="統計月份" value={month} onChange={(event) => setMonth(event.target.value)} /></label>} />
      <div className="accounting-kpis">{kpis.map(([label, cents, note, tone]) => <div className={`accounting-kpi ${tone}`} key={label}><span>{label}</span><strong>{money(cents / 100)}</strong><small>{note}</small></div>)}</div>
      <div className="accounting-overview-grid">
        <section className="list-panel accounting-trend"><div className="accounting-section-head"><div><h2>營運趨勢</h2><p>最近 6 個月營業額、支出及毛利</p></div></div>
          <div className="table-scroll"><table className="accounting-job-table"><thead><tr><th>月份</th><th className="numeric">營業額</th><th className="numeric">支出</th><th className="numeric">毛利</th><th>圖示</th></tr></thead><tbody>{data.months.map((row) => <tr key={row.month}><td>{row.month}</td><td className="numeric">{money(row.turnoverCents / 100)}</td><td className="numeric">{money(row.expensesCents / 100)}</td><td className="numeric">{money(row.grossProfitCents / 100)}</td><td><div className="payment-progress-track"><span style={{ width: `${Math.min(100, (row.turnoverCents / maxMonth) * 100)}%` }} /></div></td></tr>)}</tbody></table></div>
          <div className="accounting-trend-total">毛利率：<strong>{data.turnoverCents > 0 ? (((data.turnoverCents - data.expensesCents) / data.turnoverCents) * 100).toFixed(1) : "0.0"}%</strong></div>
        </section>
        <section className="list-panel accounting-myob"><div className="accounting-section-head"><div><h2>MYOB 對接</h2><p>會計系統整合狀態</p></div><Badge>未連接</Badge></div><p>MYOB／ABSS 尚未連接。收入、支出、佣金及月份欄位已預留作日後 MYOB 對接。</p><div className="myob-mapping"><span>已預留欄位</span><ul><li>Invoice 收入</li><li>工程支出</li><li>Sales 佣金</li><li>每月 Turnover</li></ul></div><Button className="full-width" disabled>連接 MYOB（下一步）</Button></section>
      </div>
      <section className="list-panel accounting-jobs"><div className="accounting-section-head"><div><h2>營業單</h2><p>只計已安排師傅及額外工程的實際支出；未安排工程支出暫為 HK$0。</p></div></div>
        {data.jobs.length === 0 ? <Empty title="本月未有 Invoice" /> : <div className="table-scroll"><table className="accounting-job-table"><thead><tr><th>Invoice／工程單</th><th>客戶</th><th>Sales</th><th>分類</th><th className="numeric">收入</th><th className="numeric">支出</th><th className="numeric">毛利</th><th className="numeric">已收款</th><th>狀態</th></tr></thead><tbody>{data.jobs.map((job) => <tr key={job.invoiceId}><td><button type="button" className="text-button" onClick={() => navigate(`/invoices/${job.invoiceId}`)}><strong>{job.invoiceNumber}</strong><small>{job.orderNumber || "未出工程單"}</small></button></td><td>{job.customerName}</td><td>{job.salesName}</td><td>{job.category}</td><td className="numeric">{money(job.revenueCents / 100)}</td><td className="numeric">{money(job.expensesCents / 100)}</td><td className="numeric">{money(job.grossProfitCents / 100)}</td><td className="numeric">{money(job.collectedCents / 100)}</td><td><Badge strong={job.completed}>{job.completed ? "已完成工程" : "進行中"}</Badge></td></tr>)}</tbody></table></div>}
      </section>
    </>
  );
}

const STATUS_LABELS: Record<string, string> = {
  issued: "待收訂金", partially_paid: "收款中", paid: "已收足", released: "已發工程",
  completed: "已完成工程", voided: "已退訂", refunded: "已退款",
};

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

import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, PageHead, Search } from "../components/ui";
import { money } from "../domain/types";

type PaymentRow = {
  id: string; invoiceId: string; invoiceNumber: string; invoiceTotalCents: number; validPaidCents: number;
  installment: number; amountCents: number; method: string; custody: "company" | "sales"; cleared: boolean; status: "pending" | "valid" | "rejected";
  paidAt: string; reference: string | null; notes: string | null; createdAt: string;
  customerName: string; customerPhone: string; proofFilename: string | null; proofUrl: string | null;
};
const METHOD_LABELS: Record<string, string> = { cash: "現金", fps: "FPS", bank_transfer: "銀行轉賬", cheque: "支票", transfer: "轉賬" };
const STATUS: Record<string, string> = { pending: "待核對", valid: "已核對", rejected: "退回補資料" };

export function LiveFinance() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PaymentRow | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [rejectNotice, setRejectNotice] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await apiRequest<PaymentRow[]>("/payments/all", accessToken)); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取收款。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function validate() {
    if (!active) return;
    setBusy(active.id);
    try {
      await apiRequest(`/invoices/${active.invoiceId}/payments/${active.id}/validate`, accessToken, { method: "POST", body: JSON.stringify({ cleared }) });
      setActive(null); setNotes(""); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能核對收款。"); }
    finally { setBusy(""); }
  }
  async function reject() {
    if (!active) return;
    if (!notes.trim()) { setRejectNotice(true); return; }
    setBusy(active.id);
    try {
      await apiRequest(`/invoices/${active.invoiceId}/payments/${active.id}/reject`, accessToken, { method: "POST", body: JSON.stringify({ notes }) });
      setActive(null); setNotes(""); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能退回付款。"); }
    finally { setBusy(""); }
  }

  const shown = rows.filter((row) => tab === "all" || row.status === "pending").filter((row) => `${row.invoiceNumber} ${row.customerName} ${row.reference ?? ""} ${row.customerPhone}`.toLowerCase().includes(search.toLowerCase()));
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  return (
    <>
      <PageHead eyebrow="會計工作區" title="收款核對" />
      <div className="list-panel">
        <div className="list-toolbar"><Search value={search} onChange={setSearch} placeholder="搜尋 Invoice、客戶或交易參考" /></div>
        <div className="tabs">
          <button className={tab === "pending" ? "selected" : ""} onClick={() => setTab("pending")}>待核對 <span>{pendingCount}</span></button>
          <button className={tab === "all" ? "selected" : ""} onClick={() => setTab("all")}>全部收款 <span>{rows.length}</span></button>
        </div>
        {loading ? <p className="muted">正在讀取收款…</p> : error ? <Empty title="未能讀取收款" description={error} /> : shown.length === 0 ? <Empty title={tab === "pending" ? "暫無待核對的收款" : "暫無收款"} /> : (
          <div className="table-scroll"><table><thead><tr><th>來源／客戶</th><th>方式／收款位置</th><th className="numeric">本筆金額</th><th>首期進度</th><th>狀態</th><th /></tr></thead><tbody>{shown.map((row) => <tr key={row.id}><td><strong>{row.invoiceNumber}</strong><small>{row.customerName} · {row.paidAt}</small></td><td>{METHOD_LABELS[row.method] ?? row.method.toUpperCase()}<small>{row.custody === "sales" ? "Sales保管" : "公司戶口／公司"}</small></td><td className="numeric money">{money(row.amountCents / 100)}</td><td><strong>已核 {money(row.validPaidCents / 100)}</strong><small>Invoice 總額 {money(row.invoiceTotalCents / 100)}</small></td><td><Badge strong={row.status === "valid"}>{STATUS[row.status] ?? row.status}</Badge></td><td>{row.status === "pending" ? <Button onClick={() => { setActive(row); setNotes(""); setCleared(row.cleared); }}>核對收款</Button> : <Button variant="ghost" onClick={() => setActive(row)}>查看</Button>}</td></tr>)}</tbody></table></div>
        )}
      </div>
      {active && <Dialog wide title="核對收款" onClose={() => setActive(null)}>
        <div className="payment-review-layout">
          <div className="payment-review-info">
            <div className="payment-review-field"><span>Invoice</span><strong>{active.invoiceNumber}</strong></div>
            <div className="payment-review-field"><span>來訂金額</span><strong>{money(active.amountCents / 100)}</strong></div>
            <div className="payment-review-field"><span>繳交日期</span><strong>{active.paidAt.replaceAll("-", "/")}</strong></div>
            <div className="payment-review-field"><span>入帳戶口</span><strong>{active.custody === "sales" ? "Sales 保管" : "公司戶口／公司"}</strong></div>
            <div className="payment-review-notes"><span>備註</span><textarea aria-label="備註" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="按銀行紀錄或合法現金來源核對" disabled={active.status !== "pending"} /></div>
          </div>
          <div className="payment-review-proof"><strong>付款證明</strong>{active.proofUrl ? (active.proofFilename?.toLowerCase().endsWith(".pdf") ? <a href={active.proofUrl} target="_blank" rel="noreferrer">開啟付款證明 PDF</a> : <a href={active.proofUrl} target="_blank" rel="noreferrer"><img src={active.proofUrl} alt="付款證明" /></a>) : <div className="payment-review-proof-empty">未上載付款證明</div>}</div>
        </div>
        {active.status === "pending" && <div className="dialog-actions payment-review-actions"><Button onClick={() => void reject()} disabled={busy === active.id}>未能核對</Button><Button variant="primary" onClick={() => void validate()} disabled={busy === active.id || (active.method !== "cash" && !cleared)}>{busy === active.id ? "處理中…" : "收款有效"}</Button></div>}
      </Dialog>}
      {rejectNotice && <Dialog title="未能核對" onClose={() => setRejectNotice(false)}><p className="dialog-intro">請先填寫備註／退回原因，才可以將這筆收款標記為未能核對。</p><div className="dialog-actions"><Button variant="primary" onClick={() => setRejectNotice(false)}>知道</Button></div></Dialog>}
    </>
  );
}

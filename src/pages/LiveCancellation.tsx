import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Badge, Button, Empty, Field, PageHead } from "../components/ui";
import { money } from "../domain/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "待處理",
  awaiting_credit_note: "待 Credit Note",
  awaiting_transfer: "待退款",
  completed: "已完成",
};

type CancellationRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  status: string;
  refundAmountCents: number;
  deductionsCents: number;
  createdAt: string;
  updatedAt: string;
};

type CancellationDetail = {
  case: {
    id: string;
    invoiceId: string;
    reason: string;
    status: string;
    refundAmountCents: number;
    deductionsCents: number;
    refundReason: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNumber: string | null;
    transferReference: string | null;
    creditNoteFileId: string | null;
    signedCreditNoteFileId: string | null;
    transferProofFileId: string | null;
    commissionReversals: Array<{ actorName?: string; amount?: number }>;
    createdAt: string;
    updatedAt: string;
  };
  invoice: { id: string; number: string; totalCents: number; validPaidCents: number; status: string };
  customer: { name: string; phone: string; address: string | null; district: string | null };
  creditNote: { id: string; filename: string; url: string | null } | null;
  signedCreditNote: { id: string; filename: string; url: string | null } | null;
  transferProof: { id: string; filename: string; url: string | null } | null;
};

export function LiveCancellationCases() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<CancellationRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiRequest<CancellationRow[]>("/cancellation-cases", accessToken)
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取退款個案。"))
      .finally(() => setLoading(false));
  }, [accessToken]);
  return (
    <>
      <PageHead title="退款" />
      <div className="list-panel">
        {loading ? <p className="muted">正在讀取退款個案…</p> : error ? <Empty title="未能讀取退款個案" description={error} /> : rows.length === 0 ? <Empty title="暫無退款個案" description="在 live Invoice detail 按「退款」建立個案。" /> : (
          <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>個案</th><th>Invoice</th><th>客戶</th><th>原因</th><th>退款</th><th>狀態</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="invoice-clickable-row" onClick={() => nav(`/cancellation-cases/${row.id}`)}><td><strong>{row.id.slice(0, 8)}</strong><small>{row.createdAt.slice(0, 10)}</small></td><td>{row.invoiceNumber}</td><td>{row.customerName}<small>{row.customerPhone}</small></td><td>{row.reason}</td><td>{money(row.refundAmountCents / 100)}</td><td><Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge></td></tr>)}</tbody></table></div>
        )}
      </div>
    </>
  );
}

export function LiveCancellationDetail() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState<CancellationDetail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ status: "pending", refundAmount: "", deductions: "", refundReason: "", bankName: "", bankAccountName: "", bankAccountNumber: "", transferReference: "" });
  const [uploading, setUploading] = useState("");
  const [completing, setCompleting] = useState(false);

  async function load() {
    try {
      const detail = await apiRequest<CancellationDetail>(`/cancellation-cases/${id}`, accessToken);
      setData(detail);
      setForm({
        status: detail.case.status,
        refundAmount: String(detail.case.refundAmountCents / 100),
        deductions: String(detail.case.deductionsCents / 100),
        refundReason: detail.case.refundReason ?? "",
        bankName: detail.case.bankName ?? "",
        bankAccountName: detail.case.bankAccountName ?? "",
        bankAccountNumber: detail.case.bankAccountNumber ?? "",
        transferReference: detail.case.transferReference ?? "",
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取退款個案。");
    }
  }
  useEffect(() => { void load(); }, [accessToken, id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/cancellation-cases/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          status: form.status,
          refundAmountCents: Math.round((Number(form.refundAmount) || 0) * 100),
          deductionsCents: Math.round((Number(form.deductions) || 0) * 100),
          refundReason: form.refundReason || null,
          bankName: form.bankName || null,
          bankAccountName: form.bankAccountName || null,
          bankAccountNumber: form.bankAccountNumber || null,
          transferReference: form.transferReference || null,
        }),
      });
      await load();
      setNotice("退款個案已更新。");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能更新退款個案。");
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "credit_note" | "signed_credit_note" | "transfer_proof", file: File) {
    setUploading(kind);
    setError("");
    try {
      const body = new FormData();
      body.append("kind", kind);
      body.append("file", file);
      await apiUpload(`/cancellation-cases/${id}/proofs`, accessToken, body);
      await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "文件上載失敗。"); }
    finally { setUploading(""); }
  }
  async function completeRefund() {
    setCompleting(true); setError("");
    try {
      await apiRequest(`/cancellation-cases/${id}/complete`, accessToken, { method: "POST" });
      await load(); setNotice("退款已完成。");
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能完成退款。"); }
    finally { setCompleting(false); }
  }
  const readyToTransfer = data && data.case.refundAmountCents > 0 && data.case.bankName && data.case.bankAccountName && data.case.bankAccountNumber && data.case.creditNoteFileId && data.case.signedCreditNoteFileId && data.case.transferProofFileId;

  if (error && !data) return <Empty title="未能讀取退款個案" description={error} />;
  if (!data) return <p className="muted">正在讀取退款個案…</p>;

  return (
    <>
      <div className="page-head"><div><button className="icon-button" onClick={() => nav("/cancellation-cases")} aria-label="返回退款"><ArrowLeft size={20} /></button><p className="eyebrow">退款 · Live API</p><h1>{data.invoice.number}</h1></div><Badge>{STATUS_LABELS[data.case.status] ?? data.case.status}</Badge></div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>客戶</span><strong>{data.customer.name}</strong><small>{data.customer.phone}</small></div>
          <div><span>Invoice 總額</span><strong>{money(data.invoice.totalCents / 100)}</strong></div>
          <div><span>已收金額</span><strong>{money(data.invoice.validPaidCents / 100)}</strong></div>
        </div>
        <p className="muted">退款原因：{data.case.reason}</p>
        <form onSubmit={save}>
          <div className="form-grid two">
            <Field label="狀態"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="退款金額"><input type="number" min="0" step="0.01" value={form.refundAmount} onChange={(e) => setForm({ ...form, refundAmount: e.target.value })} /></Field>
            <Field label="扣減金額"><input type="number" min="0" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></Field>
            <Field label="退款原因"><input value={form.refundReason} onChange={(e) => setForm({ ...form, refundReason: e.target.value })} /></Field>
            <Field label="銀行"><input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
            <Field label="戶口名稱"><input value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} /></Field>
            <Field label="戶口號碼"><input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></Field>
            <Field label="轉帳參考"><input value={form.transferReference} onChange={(e) => setForm({ ...form, transferReference: e.target.value })} /></Field>
          </div>
          <h2 className="section-title">文件</h2>
          <div className="form-grid three">
            {([["credit_note", "Credit Note", data.creditNote], ["signed_credit_note", "已簽 Credit Note", data.signedCreditNote], ["transfer_proof", "轉帳證明", data.transferProof]] as const).map(([kind, label, file]) => <Field key={kind} label={label}>{file?.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.filename}</a> : <span className="muted">未上載</span>}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={Boolean(uploading) || data.case.status === "completed"} onChange={(e) => { const selected = e.target.files?.[0]; if (selected) void upload(kind, selected); e.target.value = ""; }} /></Field>)}
          </div>
          {(data.case.commissionReversals ?? []).length > 0 && <><h2 className="section-title">佣金扣回</h2><div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>同事</th><th>金額</th></tr></thead><tbody>{data.case.commissionReversals.map((item, index) => <tr key={index}><td>{item.actorName || "—"}</td><td>{money(Number(item.amount) || 0)}</td></tr>)}</tbody></table></div></>}
          {notice && <p className="muted">{notice}</p>}
          <div className="dialog-actions live-form-actions"><Button type="submit" variant="primary" disabled={saving || data.case.status === "completed"}>{saving ? "儲存中…" : "儲存退款個案"}</Button>{data.case.status !== "completed" && <Button type="button" variant="danger" disabled={!readyToTransfer || completing} onClick={() => void completeRefund()}>{completing ? "處理中…" : "完成退款"}</Button>}</div>
        </form>
      </div>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, Field, PageHead } from "../components/ui";
import { money } from "../domain/types";

type WorkOrderRow = { id: string; number: string; customerName?: string; customer?: { name: string } };
type Row = { id: string; workOrderId: string; orderNumber: string; invoiceNumber: string; customerName: string; description: string; quantity: string; unit: string; status: string; priceCents: number | null; notes: string | null; requestedAt: string; respondedAt: string | null };
const LABELS: Record<string, string> = { pending: "待審批", approved: "已批", rejected: "已拒絕" };

export function LiveCustomWork() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({ workOrderId: "", description: "", quantity: "1", unit: "項" });
  const [responses, setResponses] = useState<Record<string, { price: string; notes: string }>>({});
  const canRespond = ["cs_supervisor", "admin"].includes(user?.role ?? "");

  async function load() {
    setLoading(true);
    try {
      const [requests, workOrders] = await Promise.all([
        apiRequest<Row[]>("/custom-work-requests", accessToken),
        apiRequest<WorkOrderRow[]>("/work-orders", accessToken),
      ]);
      setRows(requests);
      setOrders(workOrders);
      setForm((current) => ({ ...current, workOrderId: current.workOrderId || workOrders[0]?.id || "" }));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取自訂工程。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    try {
      await apiRequest("/custom-work-requests", accessToken, {
        method: "POST",
        body: JSON.stringify({
          workOrderId: form.workOrderId,
          description: form.description,
          quantity: Number(form.quantity) || 1,
          unit: form.unit,
        }),
      });
      setForm({ ...form, description: "", quantity: "1" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增自訂工程。");
    } finally {
      setBusy("");
    }
  }

  async function respond(row: Row, status: "approved" | "rejected") {
    setBusy(row.id);
    setError("");
    try {
      const response = responses[row.id] ?? { price: "", notes: "" };
      await apiRequest(`/custom-work-requests/${row.id}/respond`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          priceCents: status === "approved" ? Math.round((Number(response.price) || 0) * 100) : undefined,
          notes: response.notes || null,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能處理自訂工程。");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="自訂工程請示" />
      <div className="list-panel">
        {loading ? <p className="muted">正在讀取自訂工程…</p> : error ? <Empty title="未能讀取自訂工程" description={error} /> : (
          <>
            <form onSubmit={create}>
              <div className="form-grid two">
                <Field label="工程單" required><select value={form.workOrderId} onChange={(e) => setForm({ ...form, workOrderId: e.target.value })} required>{orders.map((order) => <option key={order.id} value={order.id}>{order.number}{order.customerName || order.customer?.name ? ` · ${order.customerName ?? order.customer?.name}` : ""}</option>)}</select></Field>
                <Field label="工程描述" required><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></Field>
                <Field label="數量" required><input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></Field>
                <Field label="單位" required><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></Field>
              </div>
              <div className="dialog-actions live-form-actions"><Button type="submit" variant="primary" disabled={busy === "create" || !orders.length}>{busy === "create" ? "提交中…" : "提交自訂工程"}</Button></div>
            </form>
            <h2 className="section-title">申請紀錄</h2>
            {rows.length === 0 ? <p className="muted">暫無自訂工程申請。</p> : (
              <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>工程單</th><th>客戶</th><th>描述</th><th>數量</th><th>狀態</th><th>價格</th>{canRespond && <th />}</tr></thead><tbody>{rows.map((row) => { const response = responses[row.id] ?? { price: "", notes: "" }; return <tr key={row.id}><td><strong>{row.orderNumber}</strong><small>{row.invoiceNumber}</small></td><td>{row.customerName}</td><td>{row.description}</td><td>{row.quantity} {row.unit}</td><td><Badge strong={row.status === "approved"}>{LABELS[row.status] ?? row.status}</Badge>{row.notes && <small>{row.notes}</small>}</td><td>{row.priceCents !== null ? money(row.priceCents / 100) : "—"}</td>{canRespond && <td>{row.status === "pending" ? <div className="inline-form"><input aria-label="審批價格" type="number" min="0" step="0.01" placeholder="價格" value={response.price} onChange={(e) => setResponses({ ...responses, [row.id]: { ...response, price: e.target.value } })} /><input aria-label="備註" placeholder="備註" value={response.notes} onChange={(e) => setResponses({ ...responses, [row.id]: { ...response, notes: e.target.value } })} /><Button variant="primary" disabled={busy === row.id} onClick={() => void respond(row, "approved")}>批</Button><Button variant="secondary" disabled={busy === row.id} onClick={() => void respond(row, "rejected")}>拒</Button></div> : "—"}</td>}</tr>; })}</tbody></table></div>
            )}
          </>
        )}
      </div>
    </>
  );
}

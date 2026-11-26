import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, CategoryChips, Dialog, Empty, Field, PageHead } from "../components/ui";
import { money } from "../domain/types";

type WorkOrderRow = {
  id: string;
  number: string;
  status: string;
  csOwnerId: string | null;
  csOwnerName: string | null;
  startDate: string | null;
  endDate: string | null;
  releasedAt: string | null;
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  validPaidCents: number;
  categories: string[];
  customerName: string;
  phone: string;
  district: string | null;
};

type Staff = { id: string; name: string; role: string };

type WorkOrderDetailData = WorkOrderRow & {
  notes: string | null;
  completedAt: string | null;
  invoice: {
    id: string;
    number: string;
    status: string;
    totalCents: number;
    validPaidCents: number;
    categories: string[];
    grantApplicationNumber: string | null;
    grantApprovedAmountCents: number | null;
  };
  customer: {
    name: string;
    phone: string;
    whatsapp: string | null;
    address: string | null;
    district: string | null;
  };
  lines: {
    id: string;
    name: string;
    position: string | null;
    quantity: string;
    unit: string;
    unitPriceCents: number;
    amountCents: number;
  }[];
};

const STATUS: Record<string, string> = {
  unassigned: "未安排",
  assigned: "已安排",
  in_progress: "施工中",
  completed: "已完成",
};

export function LiveWorkOrders({ mode }: { mode: "handoff" | "orders" }) {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<WorkOrderRow | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [csOwnerId, setCsOwnerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<WorkOrderRow[]>("/work-orders?limit=100", accessToken);
      setRows(
        data.filter((row) =>
          mode === "handoff" ? row.status === "unassigned" : row.status !== "unassigned",
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "無法讀取工程單。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode]);

  async function openAssign(row: WorkOrderRow) {
    setAssigning(row);
    setCsOwnerId(row.csOwnerId ?? "");
    try {
      const data = await apiRequest<Staff[]>("/staff?roles=cs,cs_supervisor,admin", accessToken);
      setStaff(data);
      if (!row.csOwnerId && data[0]) setCsOwnerId(data[0].id);
    } catch {
      setStaff([]);
    }
  }

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!assigning || !csOwnerId) return;
    setSaving(true);
    try {
      await apiRequest(`/work-orders/${assigning.id}/assign`, accessToken, {
        method: "POST",
        body: JSON.stringify({ csOwnerId }),
      });
      setAssigning(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能安排工程。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title={mode === "handoff" ? "工程單" : "工程管理"} />
      <div className="list-panel">
        {loading ? <p className="muted">正在讀取工程單…</p> : error ? (
          <Empty title="未能讀取工程單" description={error} />
        ) : rows.length === 0 ? (
          <Empty title={mode === "handoff" ? "暫無待分配工程" : "暫無工程"} description="已收足 50% 的 Invoice 會先出現在工程單。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table">
              <thead>
                <tr><th>工程單號</th><th>Invoice</th><th>客戶</th><th>電話</th><th>類別</th><th>跟進同事</th><th>狀態</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="invoice-clickable-row"
                    tabIndex={0}
                    onClick={() => mode === "orders" && nav(`/orders/${row.id}`)}
                    onKeyDown={(event) => {
                      if (mode === "orders" && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        nav(`/orders/${row.id}`);
                      }
                    }}
                  >
                    <td><strong>{row.number}</strong><small>{row.releasedAt?.slice(0, 10)}</small></td>
                    <td>{row.invoiceNumber}</td>
                    <td><strong>{row.customerName}</strong><small>{row.district}</small></td>
                    <td>{row.phone}</td>
                    <td><CategoryChips categories={row.categories as never} /></td>
                    <td>{row.csOwnerName || "未安排"}</td>
                    <td><Badge strong={row.status === "completed"}>{STATUS[row.status] ?? row.status}</Badge></td>
                    <td>
                      <div className="table-actions">
                        <Button variant="ghost" onClick={(event) => { event.stopPropagation(); nav(`/invoices/${row.invoiceId}`); }}>
                          預覽 Invoice
                        </Button>
                        {mode === "handoff" && (
                          <Button variant="primary" onClick={(event) => { event.stopPropagation(); void openAssign(row); }}>
                            {row.csOwnerName ? "更改安排" : "安排工程"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {assigning && (
        <Dialog title="安排CS跟進" onClose={() => setAssigning(null)}>
          <form onSubmit={assign}>
            <p className="dialog-intro">選擇負責跟進 {assigning.number} 的 CS 同事。</p>
            <Field label="跟進同事" required>
              <select value={csOwnerId} onChange={(event) => setCsOwnerId(event.target.value)} required>
                <option value="">請選擇 CS 同事</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </Field>
            <div className="dialog-actions">
              <Button type="button" onClick={() => setAssigning(null)}>取消</Button>
              <Button type="submit" variant="primary" disabled={saving || !csOwnerId}>{saving ? "儲存中…" : "確認安排"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

export function LiveWorkOrderDetail() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState<WorkOrderDetailData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    try {
      const data = await apiRequest<WorkOrderDetailData>(`/work-orders/${id}`, accessToken);
      setOrder(data);
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      setNotes(data.notes ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取工程單。");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await apiRequest<WorkOrderDetailData>(`/work-orders/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
          notes: notes || null,
          status: order?.status === "assigned" ? "in_progress" : undefined,
        }),
      });
      setOrder(updated);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能儲存工程。");
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    if (!confirm("確認標記此工程為完成？")) return;
    setSaving(true);
    try {
      await apiRequest(`/work-orders/${id}/complete`, accessToken, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能完成工程。");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Empty title="未能讀取工程單" description={error} />;
  if (!order) return <p className="muted">正在讀取工程單…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="icon-button" onClick={() => nav("/orders")} aria-label="返回工程管理"><ArrowLeft size={20} /></button>
          <p className="eyebrow">工程管理 · Live API</p>
          <h1>{order.number}</h1>
        </div>
        <Badge strong={order.status === "completed"}>{STATUS[order.status] ?? order.status}</Badge>
      </div>
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>Invoice</span><strong>{order.invoice.number}</strong></div>
          <div><span>客戶</span><strong>{order.customer.name}</strong><small>{order.customer.phone}</small></div>
          <div><span>跟進同事</span><strong>{order.csOwnerName || "未安排"}</strong></div>
        </div>
        {order.invoice.categories.includes("grant-80k") && (
          <div className="grant-card">
            <strong>8萬資助批核</strong>
            <p>申請編號：{order.invoice.grantApplicationNumber || "待政府批核"}</p>
            <p>批核金額：{order.invoice.grantApprovedAmountCents ? money(order.invoice.grantApprovedAmountCents / 100) : "—"}</p>
          </div>
        )}
        <form className="form-grid two" onSubmit={save}>
          <Field label="施工開始日"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="施工完成日"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <Field label="工程備註"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} /></Field>
          <div className="dialog-actions">
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "儲存工程資料"}</Button>
          </div>
        </form>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table">
            <thead><tr><th>項目</th><th>位置</th><th>數量</th><th>金額</th></tr></thead>
            <tbody>{order.lines.map((line) => <tr key={line.id}><td>{line.name}</td><td>{line.position || "—"}</td><td>{line.quantity} {line.unit}</td><td className="numeric">{money(line.amountCents / 100)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="dialog-actions">
          <Button variant="primary" onClick={complete} disabled={saving || order.status === "completed"}><Check size={18} /> {order.status === "completed" ? "工程已完成" : "標記工程完成"}</Button>
        </div>
      </div>
    </>
  );
}

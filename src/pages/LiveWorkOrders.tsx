import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Badge, Button, CategoryChips, Dialog, Empty, Field, PageHead } from "../components/ui";
import { EXTRA_WORK_LABELS, money } from "../domain/types";

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

type Assignment = {
  id: string;
  workerName: string;
  trade: string | null;
  lineIds: string[];
  startDate: string | null;
  endDate: string | null;
  time: string | null;
  feeCents: number;
  materialDeductionItem: string | null;
  materialDeductionAmountCents: number;
  notes: string | null;
};

type Photo = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

type ExtraWork = {
  id: string;
  kind: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  time: string | null;
  notes: string | null;
  priceCents: number;
};

type Deduction = {
  id: string;
  name: string;
  amountCents: number;
  notes: string | null;
};

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
            <table className="invoice-list-table live-work-table">
              <thead>
                <tr><th>工程單號</th><th>Invoice</th><th>客戶</th><th>電話</th><th>類別</th><th>跟進同事</th><th>狀態</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="invoice-clickable-row"
                    tabIndex={0}
                    onMouseEnter={() => {
                      if (mode === "orders") {
                        void apiRequest(`/work-orders/${row.id}`, accessToken).catch(() => {});
                      }
                    }}
                    onFocus={() => {
                      if (mode === "orders") {
                        void apiRequest(`/work-orders/${row.id}`, accessToken).catch(() => {});
                      }
                    }}
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [workerName, setWorkerName] = useState("");
  const [trade, setTrade] = useState("");
  const [assignmentStart, setAssignmentStart] = useState("");
  const [assignmentEnd, setAssignmentEnd] = useState("");
  const [assignmentTime, setAssignmentTime] = useState("");
  const [assignmentLineIds, setAssignmentLineIds] = useState<string[]>([]);
  const [materialItem, setMaterialItem] = useState("");
  const [materialAmount, setMaterialAmount] = useState("");
  const [fee, setFee] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [deductionName, setDeductionName] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionNotes, setDeductionNotes] = useState("");
  const [deductionSaving, setDeductionSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [extraWorks, setExtraWorks] = useState<ExtraWork[]>([]);
  const [extraKind, setExtraKind] = useState("measure");
  const [extraName, setExtraName] = useState("");
  const [extraStart, setExtraStart] = useState("");
  const [extraEnd, setExtraEnd] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [extraSaving, setExtraSaving] = useState(false);

  async function loadExtraWorks() {
    if (!accessToken) return;
    try {
      setExtraWorks(
        await apiRequest<ExtraWork[]>(`/work-orders/${id}/extra-works`, accessToken),
      );
    } catch {
      setExtraWorks([]);
    }
  }

  async function loadPhotos() {
    if (!accessToken) return;
    try {
      setPhotos(await apiRequest<Photo[]>(`/work-orders/${id}/photos`, accessToken));
    } catch {
      setPhotos([]);
    }
  }

  async function loadDeductions() {
    if (!accessToken) return;
    try {
      setDeductions(
        await apiRequest<Deduction[]>(`/work-orders/${id}/deductions`, accessToken),
      );
    } catch {
      setDeductions([]);
    }
  }

  async function loadAssignments() {
    if (!accessToken) return;
    try {
      setAssignments(
        await apiRequest<Assignment[]>(`/work-orders/${id}/assignments`, accessToken),
      );
    } catch {
      setAssignments([]);
    }
  }

  async function load() {
    try {
      const data = await apiRequest<WorkOrderDetailData>(`/work-orders/${id}`, accessToken);
      setOrder(data);
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      setNotes(data.notes ?? "");
      await loadAssignments();
      await loadDeductions();
      await loadPhotos();
      await loadExtraWorks();
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

  async function addAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!workerName.trim()) return;
    setAssignmentSaving(true);
    try {
      await apiRequest(`/work-orders/${id}/assignments`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          workerName: workerName.trim(),
          trade: trade.trim() || undefined,
          startDate: assignmentStart || undefined,
          endDate: assignmentEnd || undefined,
          time: assignmentTime || undefined,
          lineIds: assignmentLineIds,
          feeCents: Math.round((Number(fee) || 0) * 100),
          materialDeductionItem: materialItem || undefined,
          materialDeductionAmountCents: Math.round((Number(materialAmount) || 0) * 100),
        }),
      });
      setWorkerName("");
      setTrade("");
      setAssignmentStart("");
      setAssignmentEnd("");
      setFee("");
      await loadAssignments();
      await loadDeductions();
      await loadPhotos();
      await loadExtraWorks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增施工安排。");
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    try {
      await apiRequest(`/work-orders/${id}/assignments/${assignmentId}`, accessToken, {
        method: "DELETE",
      });
      await loadAssignments();
      await loadDeductions();
      await loadPhotos();
      await loadExtraWorks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能移除施工安排。");
    }
  }

  async function addDeduction(event: React.FormEvent) {
    event.preventDefault();
    if (!deductionName.trim()) return;
    setDeductionSaving(true);
    try {
      await apiRequest(`/work-orders/${id}/deductions`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: deductionName.trim(),
          amountCents: Math.round((Number(deductionAmount) || 0) * 100),
          notes: deductionNotes.trim() || undefined,
        }),
      });
      setDeductionName("");
      setDeductionAmount("");
      setDeductionNotes("");
      await loadDeductions();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增材料扣減。");
    } finally {
      setDeductionSaving(false);
    }
  }

  async function removeDeduction(deductionId: string) {
    try {
      await apiRequest(`/work-orders/${id}/deductions/${deductionId}`, accessToken, {
        method: "DELETE",
      });
      await loadDeductions();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能移除材料扣減。");
    }
  }

  async function uploadPhoto(file: File) {
    if (!accessToken) return;
    setPhotoSaving(true);
    try {
      const data = new FormData();
      data.append("photo", file);
      await apiUpload(`/work-orders/${id}/photos`, accessToken, data);
      await loadPhotos();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "相片上載失敗。");
    } finally {
      setPhotoSaving(false);
    }
  }

  async function removePhoto(photoId: string) {
    try {
      await apiRequest(`/work-orders/${id}/photos/${photoId}`, accessToken, {
        method: "DELETE",
      });
      await loadPhotos();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能移除相片。");
    }
  }

  async function addExtraWork(event: React.FormEvent) {
    event.preventDefault();
    if (!extraName.trim()) return;
    setExtraSaving(true);
    try {
      await apiRequest(`/work-orders/${id}/extra-works`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          kind: extraKind,
          name: extraName.trim(),
          startDate: extraStart || undefined,
          endDate: extraEnd || undefined,
          priceCents: Math.round((Number(extraPrice) || 0) * 100),
          notes: extraNotes.trim() || undefined,
        }),
      });
      setExtraName("");
      setExtraStart("");
      setExtraEnd("");
      setExtraPrice("");
      setExtraNotes("");
      await loadExtraWorks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增額外工程。");
    } finally {
      setExtraSaving(false);
    }
  }

  async function removeExtraWork(extraWorkId: string) {
    try {
      await apiRequest(`/work-orders/${id}/extra-works/${extraWorkId}`, accessToken, {
        method: "DELETE",
      });
      await loadExtraWorks();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能移除額外工程。");
    }
  }

  async function complete() {
    if (!confirm("確認標記此工程為完成？")) return;
    setSaving(true);
    try {
      const completed = await apiRequest<WorkOrderDetailData>(
        `/work-orders/${id}/complete`,
        accessToken,
        { method: "POST" },
      );
      setOrder(completed);
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
        <form className="live-engineering-form" onSubmit={save}>
          <div className="form-grid two">
            <Field label="施工開始日"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="施工完成日"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
          <Field label="工程備註"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} /></Field>
          <div className="dialog-actions live-form-actions">
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "儲存工程資料"}</Button>
          </div>
        </form>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table live-work-table">
            <thead><tr><th>項目</th><th>位置</th><th>數量</th><th>金額</th></tr></thead>
            <tbody>{order.lines.map((line) => <tr key={line.id}><td>{line.name}</td><td>{line.position || "—"}</td><td>{line.quantity} {line.unit}</td><td className="numeric">{money(line.amountCents / 100)}</td></tr>)}</tbody>
          </table>
        </div>
        <h2 className="section-title">工程相片</h2>
        {photos.length === 0 ? <p className="muted">尚未上載工程相片。</p> : (
          <div className="work-photo-grid">
            {photos.map((photo) => (
              <figure key={photo.id}>
                {photo.url ? <img src={photo.url} alt={photo.filename} /> : <div className="muted">未能載入</div>}
                <figcaption>{photo.filename}</figcaption>
                {order.status !== "completed" && (
                  <button type="button" className="text-button" onClick={() => void removePhoto(photo.id)}>移除</button>
                )}
              </figure>
            ))}
          </div>
        )}
        {order.status !== "completed" && (
          <label className="photo-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoSaving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPhoto(file);
                event.target.value = "";
              }}
            />
            {photoSaving ? "上載中…" : "上載工程相片（JPG／PNG／WebP，最多 4MB）"}
          </label>
        )}
        <h2 className="section-title">施工人員及成本</h2>
        {assignments.length === 0 ? <p className="muted">尚未安排施工人員。</p> : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>施工人員</th><th>工種／項目</th><th>日期</th><th>成本／扣減</th><th /></tr></thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td><strong>{assignment.workerName}</strong><small>{assignment.notes}</small></td>
                    <td>{assignment.trade || "—"}{assignment.materialDeductionItem && <small>材料：{assignment.materialDeductionItem}</small>}</td>
                    <td>{assignment.startDate || "—"}{assignment.endDate ? ` → ${assignment.endDate}` : ""}{assignment.time ? ` · ${assignment.time}` : ""}{assignment.lineIds?.length ? <small>項目：{assignment.lineIds.map((lineId) => order.lines.find((line) => line.id === lineId)?.name).filter(Boolean).join("、")}</small> : null}</td>
                    <td>{money(assignment.feeCents / 100)}{assignment.materialDeductionAmountCents > 0 && <small>扣減 {money(assignment.materialDeductionAmountCents / 100)}</small>}</td>
                    <td>
                      <button type="button" className="icon-button" aria-label={`移除${assignment.workerName}`} onClick={() => void removeAssignment(assignment.id)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "completed" && (
          <form className="live-engineering-form" onSubmit={addAssignment}>
            <div className="form-grid three">
              <Field label="施工人員" required><input value={workerName} onChange={(e) => setWorkerName(e.target.value)} required /></Field>
              <Field label="工種"><input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="例如：泥水" /></Field>
              <Field label="成本"><input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
              <Field label="開始日"><input type="date" value={assignmentStart} onChange={(e) => setAssignmentStart(e.target.value)} /></Field>
              <Field label="完成日"><input type="date" value={assignmentEnd} onChange={(e) => setAssignmentEnd(e.target.value)} /></Field>
              <Field label="時間"><input value={assignmentTime} onChange={(e) => setAssignmentTime(e.target.value)} placeholder="例如：09:00" /></Field>
              <Field label="施工項目"><select multiple value={assignmentLineIds} onChange={(e) => setAssignmentLineIds(Array.from(e.target.selectedOptions).map((option) => option.value))}>{order.lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}</select></Field>
              <Field label="材料扣減項目"><input value={materialItem} onChange={(e) => setMaterialItem(e.target.value)} /></Field>
              <Field label="材料扣減金額"><input type="number" min="0" step="0.01" value={materialAmount} onChange={(e) => setMaterialAmount(e.target.value)} /></Field>
            </div>
            <div className="dialog-actions live-form-actions">
              <Button type="submit" variant="secondary" disabled={assignmentSaving}>{assignmentSaving ? "新增中…" : "新增施工安排"}</Button>
            </div>
          </form>
        )}
        <h2 className="section-title">材料扣減</h2>
        {deductions.length === 0 ? <p className="muted">尚未新增材料扣減。</p> : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>項目</th><th>備註</th><th>金額</th><th /></tr></thead>
              <tbody>
                {deductions.map((deduction) => (
                  <tr key={deduction.id}>
                    <td><strong>{deduction.name}</strong></td>
                    <td>{deduction.notes || "—"}</td>
                    <td>{money(deduction.amountCents / 100)}</td>
                    <td><button type="button" className="icon-button" aria-label={`移除${deduction.name}`} onClick={() => void removeDeduction(deduction.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "completed" && (
          <form className="live-engineering-form" onSubmit={addDeduction}>
            <div className="form-grid three">
              <Field label="材料項目" required><input value={deductionName} onChange={(e) => setDeductionName(e.target.value)} required /></Field>
              <Field label="扣減金額"><input type="number" min="0" step="0.01" value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} /></Field>
              <Field label="備註"><input value={deductionNotes} onChange={(e) => setDeductionNotes(e.target.value)} /></Field>
            </div>
            <div className="dialog-actions live-form-actions">
              <Button type="submit" variant="secondary" disabled={deductionSaving}>{deductionSaving ? "新增中…" : "新增材料扣減"}</Button>
            </div>
          </form>
        )}
        <h2 className="section-title">額外工程</h2>
        {extraWorks.length === 0 ? <p className="muted">尚未新增額外工程。</p> : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>類型</th><th>名稱</th><th>日期</th><th>金額</th><th /></tr></thead>
              <tbody>
                {extraWorks.map((work) => (
                  <tr key={work.id}>
                    <td>{EXTRA_WORK_LABELS[work.kind as keyof typeof EXTRA_WORK_LABELS] || work.kind}</td>
                    <td><strong>{work.name}</strong><small>{work.notes}</small></td>
                    <td>{work.startDate || "—"}{work.endDate ? ` → ${work.endDate}` : ""}{work.time ? ` · ${work.time}` : ""}</td>
                    <td>{money(work.priceCents / 100)}</td>
                    <td><button type="button" className="icon-button" aria-label={`移除${work.name}`} onClick={() => void removeExtraWork(work.id)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {order.status !== "completed" && (
          <form className="live-engineering-form" onSubmit={addExtraWork}>
            <div className="form-grid three">
              <Field label="類型">
                <select value={extraKind} onChange={(e) => setExtraKind(e.target.value)}>
                  {Object.entries(EXTRA_WORK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="項目名稱" required><input value={extraName} onChange={(e) => setExtraName(e.target.value)} required /></Field>
              <Field label="金額"><input type="number" min="0" step="0.01" value={extraPrice} onChange={(e) => setExtraPrice(e.target.value)} /></Field>
              <Field label="開始日"><input type="date" value={extraStart} onChange={(e) => setExtraStart(e.target.value)} /></Field>
              <Field label="完成日"><input type="date" value={extraEnd} onChange={(e) => setExtraEnd(e.target.value)} /></Field>
              <Field label="備註"><input value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} /></Field>
            </div>
            <div className="dialog-actions live-form-actions">
              <Button type="submit" variant="secondary" disabled={extraSaving}>{extraSaving ? "新增中…" : "新增額外工程"}</Button>
            </div>
          </form>
        )}
        <div className="dialog-actions">
          <Button variant="primary" onClick={complete} disabled={saving || order.status === "completed"}><Check size={18} /> {order.status === "completed" ? "工程已完成" : "標記工程完成"}</Button>
        </div>
      </div>
    </>
  );
}

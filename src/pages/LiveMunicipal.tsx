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
  principalLines: Array<{ id: string; name: string; position: string | null; quantity: string; unit: string; unitPriceCents: number; amountCents: number; productStyleText: string | null }>;
  lines: { id: string; sourceLineId: string | null; name: string; description: string | null; position: string | null; measure: string | null; length: string | null; width: string | null; dimensionUnit: string | null; quantity: string; unit: string; unitPriceCents: number; amountCents: number; productStyleText: string | null }[];
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
  const { accessToken, user } = useAuth();
  const nav = useNavigate();
  const [order, setOrder] = useState<MunicipalDetail | null>(null);
  const [lines, setLines] = useState<MunicipalDetail["lines"]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const canEdit = ["invoice_clerk", "admin", "admin_staff"].includes(user?.role ?? "");

  useEffect(() => {
    apiRequest<MunicipalDetail>(`/municipal-orders/${id}`, accessToken)
      .then((data) => {
        setOrder(data);
        setLines(data.lines);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取市政單。"));
  }, [accessToken, id]);

  function updateLine(lineId: string, patch: Partial<MunicipalDetail["lines"][number]>) {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/municipal-orders/${id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          lines: lines.map((line) => ({
            sourceLineId: line.sourceLineId || undefined,
            name: line.name,
            description: line.description || undefined,
            position: line.position || undefined,
            measure: line.measure || undefined,
            length: line.length === null || line.length === "" ? undefined : Number(line.length),
            width: line.width === null || line.width === "" ? undefined : Number(line.width),
            dimensionUnit: line.dimensionUnit || undefined,
            quantity: Number(line.quantity) || 0,
            unit: line.unit,
            unitPriceCents: Math.round((line.unitPriceCents / 100) * 100),
            amountCents: Math.round((Number(line.quantity) || 0) * line.unitPriceCents),
            productStyleText: line.productStyleText || undefined,
          })),
        }),
      });
      const refreshed = await apiRequest<MunicipalDetail>(`/municipal-orders/${id}`, accessToken);
      setOrder(refreshed);
      setLines(refreshed.lines);
      setNotice("市政單已更新。");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能更新市政單。");
    } finally {
      setSaving(false);
    }
  }

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
        <h2 className="section-title">正單 A</h2>
        <div className="invoice-summary-grid">
          <div><span>正單</span><strong>{order.principal.number}</strong><small>{order.principal.status}</small></div>
          <div><span>客戶</span><strong>{order.customer.name}</strong><small>{order.customer.phone}</small></div>
          <div><span>工程地址</span><strong>{order.customer.address || order.customer.district || "—"}</strong></div>
        </div>
        <p className="muted">市政單用途：政府8萬資助申請，不作會計。</p>
        <div className="table-scroll"><table className="municipal-principal-table"><thead><tr><th>工程項目</th><th>位置</th><th>數量</th><th>產品款式</th></tr></thead><tbody>{order.principalLines.map((line) => <tr key={line.id}><td><strong>{line.name}</strong></td><td>{line.position || "—"}</td><td>{line.quantity} {line.unit}</td><td>{line.productStyleText || "—"}</td></tr>)}</tbody></table></div>
        <h2 className="section-title">市政單項目</h2>
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
          <table className="invoice-list-table live-work-table live-line-table">
            <thead><tr><th>項目</th><th>位置</th><th>尺寸</th><th>產品款式</th><th>數量</th><th>單位</th><th>單價</th><th>金額</th>{canEdit && <th />}</tr></thead>
            <tbody>
              {lines.map((line) => {
                const amount = Math.round((Number(line.quantity) || 0) * line.unitPriceCents);
                return (
                  <tr key={line.id}>
                    <td>{canEdit ? <input value={line.name} onChange={(e) => updateLine(line.id, { name: e.target.value })} /> : line.name}</td>
                    <td>{canEdit ? <input value={line.position ?? ""} onChange={(e) => updateLine(line.id, { position: e.target.value })} /> : (line.position || "—")}</td>
                    <td>{canEdit ? <div className="inline-form"><input type="number" min="0" step="0.01" value={line.length ?? ""} onChange={(e) => updateLine(line.id, { length: e.target.value })} placeholder="長" /><input type="number" min="0" step="0.01" value={line.width ?? ""} onChange={(e) => updateLine(line.id, { width: e.target.value })} placeholder="闊" /><select value={line.dimensionUnit ?? "呎"} onChange={(e) => updateLine(line.id, { dimensionUnit: e.target.value })}><option value="呎">呎</option><option value="寸">寸</option></select></div> : (line.length ? `${line.length} × ${line.width ?? 0} ${line.dimensionUnit ?? "呎"}` : "—")}</td>
                    <td>{canEdit ? <input value={line.productStyleText ?? ""} onChange={(e) => updateLine(line.id, { productStyleText: e.target.value })} placeholder="款式" /> : (line.productStyleText || "—")}</td>
                    <td>{canEdit ? <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} /> : line.quantity}</td>
                    <td>{canEdit ? <input value={line.unit} onChange={(e) => updateLine(line.id, { unit: e.target.value })} /> : line.unit}</td>
                    <td>{canEdit ? <input type="number" min="0" step="0.01" value={line.unitPriceCents / 100} onChange={(e) => updateLine(line.id, { unitPriceCents: Math.round((Number(e.target.value) || 0) * 100) })} /> : money(line.unitPriceCents / 100)}</td>
                    <td>{money(amount / 100)}</td>
                    {canEdit && <td><button type="button" className="icon-button" aria-label="移除項目" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>×</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="dialog-actions live-form-actions">
            <Button type="button" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), sourceLineId: null, name: "", description: null, position: "", measure: null, length: null, width: null, dimensionUnit: "呎", quantity: "1", unit: "項", unitPriceCents: 0, amountCents: 0, productStyleText: null }])}>新增項目</Button>
            <Button type="button" variant="primary" disabled={saving} onClick={save}>{saving ? "儲存中…" : "儲存市政單"}</Button>
          </div>
        )}
        {notice && <p className="muted">{notice}</p>}
        <p className="muted">市政單只作 8萬資助申請用途，不影響 Invoice、會計及正單。</p>
      </div>
    </>
  );
}

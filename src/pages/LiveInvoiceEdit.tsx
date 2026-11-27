import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import {
  apiRequest,
  ApiError,
  type InvoiceDetailData,
} from "../api/client";
import { Button, Field, PageHead } from "../components/ui";
import { money } from "../domain/types";

const CATEGORY_OPTIONS = [
  ["self-pay", "自費"],
  ["grant-80k", "8萬資助"],
  ["group-buy", "團購"],
] as const;

type EditLine = {
  productStyleText?: string | null;
  key: string;
  name: string;
  position: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function LiveInvoiceEdit() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetailData | null>(null);
  const [salesName, setSalesName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [team, setTeam] = useState<"" | "A" | "B">("");
  const [isAdditional, setIsAdditional] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [grantApplicationNumber, setGrantApplicationNumber] = useState("");
  const [grantApprovedAmount, setGrantApprovedAmount] = useState("");
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    district: "",
  });
  const [lines, setLines] = useState<EditLine[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest<InvoiceDetailData>(`/invoices/${id}`, accessToken)
      .then((data) => {
        if (cancelled) return;
        setInvoice(data);
        setSalesName(data.salesName ?? "");
        setSupervisorName(data.supervisorName ?? "");
        setTeam((data.team as "" | "A" | "B") ?? "");
        setIsAdditional(Boolean(data.isAdditional));
        setCategories(data.categories);
        setGrantApplicationNumber(data.grantApplicationNumber ?? "");
        setGrantApprovedAmount(
          data.grantApprovedAmountCents
            ? String(data.grantApprovedAmountCents / 100)
            : "",
        );
        setCustomer({
          name: data.customer.name,
          phone: data.customer.phone,
          whatsapp: data.customer.whatsapp ?? "",
          address: data.customer.address ?? "",
          district: data.customer.district ?? "",
        });
        setLines(
          data.lines.map((line) => ({
            key: line.id,
            name: line.name,
            position: line.position ?? "",
            productStyleText: line.productStyleText ?? null,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: String(line.unitPriceCents / 100),
          })),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "未能讀取發票。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  const totalCents = lines.reduce(
    (sum, line) =>
      sum +
      Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100),
    0,
  );

  function toggleCategory(value: string) {
    setCategories((current) =>
      current.includes(value)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function updateLine(key: string, patch: Partial<EditLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: "",
        position: "",
        quantity: "1",
        unit: "項",
        unitPrice: "",
      },
    ]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice || !accessToken) return;
    if (!reason.trim()) {
      setError("請填寫修改原因。");
      return;
    }
    if (lines.length === 0 || lines.some((line) => !line.name.trim())) {
      setError("請填寫所有工程項目名稱。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await apiRequest<InvoiceDetailData>(
        `/invoices/${id}/amendments`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            date: invoice.createdAt.slice(0, 10) || todayLocal(),
            salesName: salesName.trim() || undefined,
            supervisorName: supervisorName.trim() || undefined,
            team: team || null,
            isAdditional,
            categories,
            grant: categories.includes("grant-80k")
              ? {
                  applicationNumber: grantApplicationNumber.trim() || undefined,
                  approvedAmountCents:
                    Number(grantApprovedAmount) > 0
                      ? Math.round(Number(grantApprovedAmount) * 100)
                      : undefined,
                }
              : undefined,
            customer: {
              name: customer.name,
              phone: customer.phone,
              whatsapp: customer.whatsapp || undefined,
              address: customer.address || undefined,
              district: customer.district || undefined,
            },
            lines: lines.map((line) => ({
              name: line.name.trim(),
              position: line.position.trim() || undefined,
              productStyleText: line.productStyleText || undefined,
              quantity: Number(line.quantity) || 0,
              unit: line.unit.trim() || "項",
              unitPriceCents: Math.round((Number(line.unitPrice) || 0) * 100),
              amountCents: Math.round(
                (Number(line.quantity) || 0) *
                  (Number(line.unitPrice) || 0) *
                  100,
              ),
            })),
            reason: reason.trim(),
          }),
        },
      );
      nav(`/invoices/${updated.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "修改失敗，請再試一次。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">正在讀取發票…</p>;
  if (!invoice) return <p className="muted">{error || "找不到發票。"}</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="icon-button" onClick={() => nav(`/invoices/${id}`)} aria-label="返回發票">
            <ArrowLeft size={20} />
          </button>
          <p className="eyebrow">修改單 · Live API</p>
          <h1>{invoice.number}</h1>
        </div>
      </div>
      <form className="list-panel live-invoice-edit" onSubmit={save}>
        <div className="form-grid three">
          <Field label="Sales">
            <input value={salesName} onChange={(e) => setSalesName(e.target.value)} />
          </Field>
          <Field label="Sales主管">
            <input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
          </Field>
          <Field label="Team"><select value={team} onChange={(e) => setTeam(e.target.value as "" | "A" | "B")}><option value="">未指定</option><option value="A">Team A</option><option value="B">Team B</option></select></Field>
          <Field label="單類"><label className="checkbox-label"><input type="checkbox" checked={isAdditional} onChange={(e) => setIsAdditional(e.target.checked)} /> 後加單</label></Field>
          <Field label="修改原因" required>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：客戶加項" />
          </Field>
        </div>
        <Field label="單種" required>
          <div className="live-category-options">
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={categories.includes(value)}
                  onChange={() => toggleCategory(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </Field>
        {categories.includes("grant-80k") && (
          <div className="form-grid two">
            <Field label="8萬申請編號">
              <input value={grantApplicationNumber} onChange={(e) => setGrantApplicationNumber(e.target.value)} />
            </Field>
            <Field label="批核金額">
              <input type="number" min="0" step="0.01" value={grantApprovedAmount} onChange={(e) => setGrantApprovedAmount(e.target.value)} />
            </Field>
          </div>
        )}
        <h2 className="section-title">客戶</h2>
        <div className="form-grid two">
          <Field label="客戶姓名" required>
            <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required />
          </Field>
          <Field label="聯絡電話" required>
            <input value={customer.phone} readOnly />
          </Field>
          <Field label="WhatsApp">
            <input value={customer.whatsapp} onChange={(e) => setCustomer({ ...customer, whatsapp: e.target.value })} />
          </Field>
          <Field label="地區">
            <input value={customer.district} onChange={(e) => setCustomer({ ...customer, district: e.target.value })} />
          </Field>
          <Field label="地址">
            <input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
          </Field>
        </div>
        <h2 className="section-title">工程項目</h2>
        <div className="table-scroll">
          <table className="invoice-list-table live-line-table">
            <thead>
              <tr><th>名稱</th><th>位置</th><th>數量</th><th>單位</th><th>單價</th><th className="numeric">金額</th><th /></tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td><input value={line.name} onChange={(e) => updateLine(line.key, { name: e.target.value })} required /></td>
                  <td><input value={line.position} onChange={(e) => updateLine(line.key, { position: e.target.value })} /></td>
                  <td><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} required /></td>
                  <td><input value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} required /></td>
                  <td><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} required /></td>
                  <td className="numeric">{money((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}</td>
                  <td>
                    <button type="button" className="icon-button" aria-label="移除項目" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" onClick={addLine}><Plus size={18} /> 新增項目</Button>
        <div className="live-edit-total">修改後總額：<strong>{money(totalCents / 100)}</strong></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button type="button" onClick={() => nav(`/invoices/${id}`)}>取消</Button>
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "儲存修改"}</Button>
        </div>
      </form>
    </>
  );
}

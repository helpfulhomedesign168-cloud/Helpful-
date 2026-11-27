import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, Field, PageHead, Search } from "../components/ui";
import { money } from "../domain/types";

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  priceCents: number;
  measure: string;
  published: boolean;
};

export function LiveServices() {
  const { accessToken, user } = useAuth();
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", category: "", unit: "項", price: "", measure: "fixed" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<ServiceRow[]>("/services", accessToken)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "未能讀取工程價目。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const categories = ["全部", ...Array.from(new Set(rows.map((row) => row.category)))];
  const visible = rows.filter(
    (row) =>
      (category === "全部" || row.category === category) &&
      `${row.code} ${row.name} ${row.category}`.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    setForm({ code: "", name: "", category: "", unit: "項", price: "", measure: "fixed" });
    setError("");
    setOpen(true);
  }

  function openEdit(row: ServiceRow) {
    setEditing(row);
    setForm({ code: row.code, name: row.name, category: row.category, unit: row.unit, price: String(row.priceCents / 100), measure: row.measure });
    setError("");
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({
        code: form.code,
        name: form.name,
        category: form.category,
        unit: form.unit,
        priceCents: Math.round((Number(form.price) || 0) * 100),
        measure: form.measure,
        published: true,
      });
      if (editing) {
        await apiRequest(`/services/${editing.id}`, accessToken, { method: "PATCH", body });
      } else {
        await apiRequest("/services", accessToken, { method: "POST", body });
      }
      setOpen(false);
      setEditing(null);
      const data = await apiRequest<ServiceRow[]>("/services", accessToken);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能儲存工程項目。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title="工程價目" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋工程名稱或代號" />
          <select aria-label="工程分類" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {canEdit && <Button variant="primary" onClick={openCreate}>新增工程項目</Button>}
        </div>
        {loading ? <p className="muted">正在讀取工程價目…</p> : error ? (
          <Empty title="未能讀取工程價目" description={error} />
        ) : visible.length === 0 ? (
          <Empty title="暫無工程項目" description="Admin 可在價目表新增工程。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>項目代號</th><th>工程名稱</th><th>分類</th><th>單位</th><th>價格</th><th>狀態</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.code}</strong></td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.unit}</td>
                    <td>{money(row.priceCents / 100)}</td>
                    <td><Badge strong={row.published}>{row.published ? "啟用" : "草稿"}</Badge></td>
                    {canEdit && <td><Button variant="ghost" onClick={() => openEdit(row)}>修改</Button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Dialog title={editing ? "修改工程項目" : "新增工程項目"} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="form-grid two">
              <Field label="項目代號" required><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></Field>
              <Field label="工程名稱" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="分類" required><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></Field>
              <Field label="單位" required><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required /></Field>
              <Field label="價格" required><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></Field>
              <Field label="計價方式"><select value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value })}><option value="fixed">固定</option><option value="area">面積</option><option value="length">長度</option><option value="quantity">數量</option></select></Field>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <Button type="button" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : editing ? "儲存修改" : "建立項目"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

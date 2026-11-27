import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, Field, PageHead, Search } from "../components/ui";

type Supplier = { id: string; name: string; phone: string | null; contact: string | null; active: boolean };

export function LiveSuppliers() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", contact: "" });
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");

  async function load() {
    setLoading(true);
    try {
      setRows(await apiRequest<Supplier[]>("/suppliers", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取供應商。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/suppliers", accessToken, { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ name: "", phone: "", contact: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增供應商。");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(supplier: Supplier) {
    await apiRequest(`/suppliers/${supplier.id}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ active: !supplier.active }),
    });
    await load();
  }

  const visible = rows.filter((row) => `${row.name} ${row.contact ?? ""} ${row.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageHead title="供應商" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋供應商" />
          {canEdit && <Button variant="primary" onClick={() => setOpen(true)}><Plus size={18} /> 新增供應商</Button>}
        </div>
        {loading ? <p className="muted">正在讀取供應商…</p> : error ? <Empty title="未能讀取供應商" description={error} /> : visible.length === 0 ? <Empty title="暫無供應商" /> : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>名稱</th><th>聯絡人</th><th>電話</th><th>狀態</th>{canEdit && <th />}</tr></thead>
              <tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.contact || "—"}</td><td>{row.phone || "—"}</td><td><Badge strong={row.active}>{row.active ? "啟用" : "停用"}</Badge></td>{canEdit && <td><Button variant="secondary" onClick={() => void toggle(row)}>{row.active ? "停用" : "啟用"}</Button></td>}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {open && <Dialog title="新增供應商" onClose={() => setOpen(false)}><form onSubmit={create}><div className="form-grid two"><Field label="名稱" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field><Field label="聯絡人"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field><Field label="電話"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div><div className="dialog-actions"><Button type="button" onClick={() => setOpen(false)}>取消</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "建立供應商"}</Button></div></form></Dialog>}
    </>
  );
}

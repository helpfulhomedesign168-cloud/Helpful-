import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, Field, PageHead, Search } from "../components/ui";

type Contractor = { id: string; name: string; phone: string | null; active: boolean };

export function LiveContractors() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<Contractor[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");

  async function load() {
    setLoading(true);
    try { setRows(await apiRequest<Contractor[]>("/contractors", accessToken)); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取師傅。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await apiRequest("/contractors", accessToken, { method: "POST", body: JSON.stringify(form) }); setOpen(false); setForm({ name: "", phone: "" }); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能新增師傅。"); }
    finally { setSaving(false); }
  }
  async function toggle(row: Contractor) {
    await apiRequest(`/contractors/${row.id}`, accessToken, { method: "PATCH", body: JSON.stringify({ active: !row.active }) });
    await load();
  }
  const visible = rows.filter((row) => `${row.name} ${row.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <PageHead title="工程師傅" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋師傅" />
          {canEdit && <Button variant="primary" onClick={() => setOpen(true)}><Plus size={18} /> 新增師傅</Button>}
        </div>
        {loading ? <p className="muted">正在讀取師傅…</p> : error ? <Empty title="未能讀取師傅" description={error} /> : visible.length === 0 ? <Empty title="暫無師傅" /> : (
          <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>名稱</th><th>電話</th><th>狀態</th>{canEdit && <th />}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.phone || "—"}</td><td><Badge strong={row.active}>{row.active ? "啟用" : "停用"}</Badge></td>{canEdit && <td><Button variant="secondary" onClick={() => void toggle(row)}>{row.active ? "停用" : "啟用"}</Button></td>}</tr>)}</tbody></table></div>
        )}
      </div>
      {open && <Dialog title="新增師傅" onClose={() => setOpen(false)}><form onSubmit={create}><div className="form-grid two"><Field label="名稱" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field><Field label="電話"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div><div className="dialog-actions"><Button type="button" onClick={() => setOpen(false)}>取消</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "建立師傅"}</Button></div></form></Dialog>}
    </>
  );
}

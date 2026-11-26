import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Button, Dialog, Empty, Field, PageHead, Search } from "../components/ui";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  district: string | null;
  createdAt: string;
};

export function LiveCustomers() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", address: "", district: "" });

  async function load() {
    setLoading(true);
    try {
      const params = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      setRows(await apiRequest<CustomerRow[]>(`/customers${params}`, accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取客戶。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, search]);

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({
        name: form.name,
        phone: form.phone,
        whatsapp: form.whatsapp || null,
        address: form.address || null,
        district: form.district || null,
      });
      if (editing) {
        await apiRequest(`/customers/${editing.id}`, accessToken, {
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest("/customers", accessToken, { method: "POST", body });
      }
      setOpen(false);
      setEditing(null);
      setForm({ name: "", phone: "", whatsapp: "", address: "", district: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能儲存客戶。");
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", whatsapp: "", address: "", district: "" });
    setError("");
    setOpen(true);
  }

  function openEdit(customer: CustomerRow) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      whatsapp: customer.whatsapp ?? "",
      address: customer.address ?? "",
      district: customer.district ?? "",
    });
    setError("");
    setOpen(true);
  }

  return (
    <>
      <PageHead title="客戶" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋客戶姓名／電話" />
          <Button variant="primary" onClick={openCreate}><Plus size={18} /> 新增客戶</Button>
        </div>
        {loading ? <p className="muted">正在讀取客戶…</p> : error ? (
          <Empty title="未能讀取客戶" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無客戶" description="建立 Invoice 或在此新增客戶。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>客戶</th><th>電話</th><th>WhatsApp</th><th>地區／地址</th><th>建立日期</th><th /></tr></thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td><strong>{customer.name}</strong></td>
                    <td>{customer.phone}</td>
                    <td>{customer.whatsapp || "—"}</td>
                    <td>{customer.district || customer.address || "—"}</td>
                    <td>{customer.createdAt.slice(0, 10)}</td>
                    <td><Button variant="ghost" onClick={() => openEdit(customer)}>修改</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Dialog title={editing ? "修改客戶" : "新增客戶"} onClose={() => setOpen(false)}>
          <form onSubmit={saveCustomer}>
            <div className="form-grid two">
              <Field label="客戶姓名" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="聯絡電話" required><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Field>
              <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
              <Field label="地區"><input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
              <Field label="地址"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <Button type="button" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : editing ? "儲存修改" : "建立客戶"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

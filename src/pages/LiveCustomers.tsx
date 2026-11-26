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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/customers", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          whatsapp: form.whatsapp || undefined,
          address: form.address || undefined,
          district: form.district || undefined,
        }),
      });
      setOpen(false);
      setForm({ name: "", phone: "", whatsapp: "", address: "", district: "" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增客戶。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead title="客戶" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋客戶姓名／電話" />
          <Button variant="primary" onClick={() => { setError(""); setOpen(true); }}><Plus size={18} /> 新增客戶</Button>
        </div>
        {loading ? <p className="muted">正在讀取客戶…</p> : error ? (
          <Empty title="未能讀取客戶" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無客戶" description="建立 Invoice 或在此新增客戶。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>客戶</th><th>電話</th><th>WhatsApp</th><th>地區／地址</th><th>建立日期</th></tr></thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td><strong>{customer.name}</strong></td>
                    <td>{customer.phone}</td>
                    <td>{customer.whatsapp || "—"}</td>
                    <td>{customer.district || customer.address || "—"}</td>
                    <td>{customer.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Dialog title="新增客戶" onClose={() => setOpen(false)}>
          <form onSubmit={create}>
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
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : "建立客戶"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

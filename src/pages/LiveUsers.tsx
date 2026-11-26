import React, { useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, Field, PageHead } from "../components/ui";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  invoice_clerk: "直接開單員",
  finance: "會計",
  finance_supervisor: "會計主管",
  cs: "CS",
  cs_supervisor: "CS主管",
  admin: "Super Admin",
  admin_staff: "Admin Staff",
};

const ROLES = ["invoice_clerk", "finance", "finance_supervisor", "cs", "cs_supervisor", "admin", "admin_staff"];

export function LiveUsers() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "invoice_clerk" });
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await apiRequest<StaffUser[]>("/users", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取用戶。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/users", accessToken, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "invoice_clerk" });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能建立用戶。");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(user: StaffUser) {
    setBusy(user.id);
    try {
      await apiRequest(`/users/${user.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能更新用戶。");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="用戶管理" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <p className="muted">正式登入帳戶由 Supabase Auth 管理；此頁只顯示已開通帳戶。</p>
          <Button variant="primary" onClick={() => { setError(""); setOpen(true); }}><Plus size={18} /> 新增用戶</Button>
        </div>
        {loading ? <p className="muted">正在讀取用戶…</p> : error ? (
          <Empty title="未能讀取用戶" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無用戶" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>用戶</th><th>Email</th><th>角色</th><th>狀態</th><th /></tr></thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td><Badge>{ROLE_LABELS[user.role] ?? user.role}</Badge></td>
                    <td><Badge strong={user.active}>{user.active ? "啟用" : "停用"}</Badge></td>
                    <td><Button variant={user.active ? "secondary" : "primary"} disabled={busy === user.id} onClick={() => toggle(user)}>{user.active ? "停用" : "啟用"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && (
        <Dialog title="新增用戶" onClose={() => setOpen(false)}>
          <form onSubmit={create}>
            <div className="form-grid two">
              <Field label="姓名" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="Email" required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
              <Field label="初始密碼" required><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
              <Field label="角色" required>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <Button type="button" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "建立中…" : "建立用戶"}</Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

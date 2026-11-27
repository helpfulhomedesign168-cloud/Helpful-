import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, KeyRound, Plus, UserCog } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, PageHead } from "../components/ui";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  phone: string | null;
  avatarUrl: string | null;
  code: string | null;
};
const ROLE_LABELS: Record<string, string> = {
  invoice_clerk: "直接開單員", finance: "會計", finance_supervisor: "會計主管",
  cs: "CS", cs_supervisor: "CS主管", admin: "Super Admin", admin_staff: "Admin Staff",
  sales: "Sales", supervisor: "Sales主管", head: "Sales阿頭", clerk: "舊開單員",
};
const TABS = [
  { key: "sales", label: "Sales", roles: ["sales", "supervisor", "head"] },
  { key: "cs", label: "工程部", roles: ["cs", "cs_supervisor"] },
  { key: "finance", label: "會計", roles: ["finance", "finance_supervisor", "clerk"] },
  { key: "admin", label: "Admin", roles: ["admin", "admin_staff", "invoice_clerk"] },
];
function Avatar({ user }: { user: StaffUser }) {
  return <span className="user-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.name.trim().slice(0, 1) || "U"}</span>}</span>;
}

export function LiveUsers() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [tab, setTab] = useState("sales");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setLoading(true);
    try { setRows(await apiRequest<StaffUser[]>("/users", accessToken)); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取用戶。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function reset(user: StaffUser) {
    if (!confirm(`確定要重設 ${user.name} 的密碼？`)) return;
    setBusy(user.id);
    try {
      const result = await apiRequest<{ password: string }>(`/users/${user.id}/reset-password`, accessToken, { method: "POST" });
      setResetUser(user); setResetPassword(result.password);
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能重設密碼。"); }
    finally { setBusy(""); }
  }
  async function toggle(user: StaffUser) {
    if (!confirm(`確定要${user.active ? "停用" : "啟用"} ${user.name}？`)) return;
    setBusy(user.id);
    try { await apiRequest(`/users/${user.id}`, accessToken, { method: "PATCH", body: JSON.stringify({ active: !user.active }) }); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能更新用戶。"); }
    finally { setBusy(""); }
  }
  const department = TABS.find((item) => item.key === tab) ?? TABS[0];
  const visible = rows.filter((user) => user.active && department.roles.includes(user.role));
  const inactive = rows.filter((user) => !user.active);

  return (
    <>
      <PageHead title="用戶管理" actions={<Link className="btn btn-primary users-add-button" to="/users/new"><Plus size={20} /> 新增用戶</Link>} />
      <div className="user-tabs" role="tablist" aria-label="用戶部門">
        {TABS.map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}
      </div>
      <div className="list-panel user-list-panel">
        {loading ? <p className="muted">正在讀取用戶…</p> : error ? <Empty title="未能讀取用戶" description={error} /> : visible.length === 0 ? <Empty title={`${department.label}暫時沒有用戶`} /> : (
          <div className="table-scroll"><table className="user-list-table"><thead><tr><th>用戶姓名</th><th>職位</th><th>聯絡電話</th><th>電郵</th><th>狀態</th><th /></tr></thead><tbody>{visible.map((user) => <tr key={user.id}><td><Link className="user-list-person" to={`/users/${user.id}`}><Avatar user={user} /><strong>{user.name}</strong></Link></td><td>{ROLE_LABELS[user.role] ?? user.role}</td><td>{user.phone || "—"}</td><td>{user.email || "—"}</td><td><Badge strong>啟用中</Badge></td><td><Link className="user-view-link" to={`/users/${user.id}`}>查看 <ChevronRight size={18} /></Link><Button variant="secondary" onClick={() => void reset(user)} disabled={busy === user.id}><KeyRound size={16} /> 重設密碼</Button><Button variant="ghost" onClick={() => void toggle(user)} disabled={busy === user.id}>停用</Button></td></tr>)}</tbody></table></div>
        )}
        {inactive.length > 0 && <div className="inactive-users"><h3><UserCog size={18} /> 已停用帳戶（{inactive.length}）</h3>{inactive.map((user) => <div key={user.id} className="inactive-user-row"><Avatar user={user} /><strong>{user.name}</strong><span>{user.email}</span><Button variant="secondary" onClick={() => void toggle(user)}>重新啟用</Button></div>)}</div>}
      </div>
      {resetUser && <Dialog title="臨時密碼" onClose={() => { setResetUser(null); setResetPassword(""); }}><p>已重設 <strong>{resetUser.name}</strong> 的密碼。請將以下臨時密碼交給他，並要求登入後更改。</p><div className="temp-password"><code>{resetPassword}</code></div><p className="muted">此密碼只會顯示一次。</p><div className="dialog-actions"><Button variant="secondary" onClick={() => void navigator.clipboard.writeText(resetPassword)}>複製密碼</Button><Button variant="primary" onClick={() => { setResetUser(null); setResetPassword(""); }}>完成</Button></div></Dialog>}
    </>
  );
}

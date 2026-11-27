import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ImagePlus, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Badge, Button, Empty, Field, PageHead } from "../components/ui";

const ROLE_LABELS: Record<string, string> = {
  invoice_clerk: "直接開單員", finance: "會計", finance_supervisor: "會計主管",
  cs: "CS", cs_supervisor: "CS主管", admin: "Super Admin", admin_staff: "Admin Staff",
  sales: "Sales", supervisor: "Sales主管", head: "Sales阿頭", clerk: "舊開單員",
};
const SALES_ROLES = ["sales", "supervisor", "head"];
type Draft = {
  name: string; surname: string; salutation: string; bio: string; phone: string; companyPhone: string;
  email: string; address: string; emergencyName: string; emergencyPhone: string; code: string;
  role: string; team: string; password: string;
};
const EMPTY: Draft = { name: "", surname: "", salutation: "", bio: "", phone: "", companyPhone: "", email: "", address: "", emergencyName: "", emergencyPhone: "", code: "", role: "invoice_clerk", team: "B", password: "" };

export function LiveUserProfile() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { accessToken } = useAuth();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [existing, setExisting] = useState<{ id: string; active: boolean; avatarUrl: string | null } | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    apiRequest<Array<Draft & { id: string; active: boolean; avatarUrl: string | null }>>("/users", accessToken)
      .then((rows) => {
        const user = rows.find((item) => item.id === id);
        if (!user) { setError("找不到用戶。"); return; }
        setExisting({ id: user.id, active: user.active, avatarUrl: user.avatarUrl });
        setAvatarPreview(user.avatarUrl ?? "");
        setDraft({
          name: user.name ?? "", surname: user.surname ?? "", salutation: user.salutation ?? "", bio: user.bio ?? "",
          phone: user.phone ?? "", companyPhone: user.companyPhone ?? "", email: user.email ?? "", address: user.address ?? "",
          emergencyName: user.emergencyName ?? "", emergencyPhone: user.emergencyPhone ?? "", code: user.code ?? "",
          role: user.role, team: user.team ?? "B", password: "",
        });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取用戶。"))
      .finally(() => setLoading(false));
  }, [accessToken, id, isNew]);

  function update(patch: Partial<Draft>) { setDraft((current) => ({ ...current, ...patch })); }
  async function save() {
    if (!draft.name.trim() || !draft.email.trim()) { setError("姓名及 Email 為必填。"); return; }
    if (isNew && draft.password.length < 8) { setError("密碼最少 8 個字元。"); return; }
    setSaving(true); setError("");
    try {
      const body = JSON.stringify({
        name: draft.name, surname: draft.surname || undefined, salutation: draft.salutation || undefined,
        bio: draft.bio || undefined, phone: draft.phone || undefined, companyPhone: draft.companyPhone || undefined,
        address: draft.address || undefined, emergencyName: draft.emergencyName || undefined,
        emergencyPhone: draft.emergencyPhone || undefined, code: draft.code || undefined,
        team: draft.team || undefined, role: draft.role,
      });
      let userId = existing?.id;
      if (isNew) {
        const created = await apiRequest<{ id: string }>("/users", accessToken, {
          method: "POST",
          body: JSON.stringify({ name: draft.name, email: draft.email, password: draft.password, role: draft.role, surname: draft.surname || undefined, salutation: draft.salutation || undefined, bio: draft.bio || undefined, phone: draft.phone || undefined, companyPhone: draft.companyPhone || undefined, address: draft.address || undefined, emergencyName: draft.emergencyName || undefined, emergencyPhone: draft.emergencyPhone || undefined, code: draft.code || undefined, team: draft.team || undefined }),
        });
        userId = created.id;
      } else {
        await apiRequest(`/users/${userId}`, accessToken, { method: "PATCH", body });
        if (draft.password) {
          await apiRequest(`/users/${userId}/reset-password`, accessToken, { method: "POST" });
        }
      }
      if (avatarFile && userId) {
        const data = new FormData(); data.append("file", avatarFile);
        await apiUpload(`/users/${userId}/avatar`, accessToken, data);
      }
      nav(`/users/${userId}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能儲存用戶。");
    } finally { setSaving(false); }
  }

  if (loading) return <p className="muted">正在讀取用戶…</p>;
  if (error && !isNew && !existing) return <Empty title="找不到用戶" description={error} action={<Button onClick={() => nav("/users")}>返回用戶管理</Button>} />;
  const sales = SALES_ROLES.includes(draft.role);
  const avatar = avatarPreview || existing?.avatarUrl;
  return (
    <>
      <PageHead eyebrow={isNew ? "新增用戶" : (ROLE_LABELS[draft.role] ?? draft.role)} title={isNew ? "建立用戶檔案" : draft.name} actions={<><Button onClick={() => nav("/users")}><ArrowLeft size={18} /> 返回用戶管理</Button><Button variant="primary" disabled={saving} onClick={() => void save()}><Check size={18} /> {saving ? "儲存中…" : isNew ? "建立用戶" : "儲存修改"}</Button></>} />
      <div className="user-profile-layout">
        <div className="user-profile-main">
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head"><span>01</span><h2>個人資料</h2></div>
            <div className="form-grid two">
              <Field label="姓名" required><input aria-label="用戶姓名" value={draft.name} onChange={(e) => update({ name: e.target.value })} /></Field>
              <Field label="姓氏"><input aria-label="用戶姓氏" value={draft.surname} onChange={(e) => update({ surname: e.target.value })} placeholder="例如：陳" /></Field>
              <Field label="稱呼"><input aria-label="用戶稱呼" value={draft.salutation} onChange={(e) => update({ salutation: e.target.value })} placeholder="例如：陳生／阿文" /></Field>
              <div className="form-field-wide"><Field label="個人簡介"><textarea aria-label="個人簡介" value={draft.bio} onChange={(e) => update({ bio: e.target.value })} placeholder="簡單介紹這位同事的職責或背景" /></Field></div>
            </div>
          </section>
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head"><span>02</span><h2>聯絡資料</h2></div>
            <div className="form-grid two">
              <Field label="聯絡電話"><input value={draft.phone} onChange={(e) => update({ phone: e.target.value })} /></Field>
              <Field label="公司電話"><input value={draft.companyPhone} onChange={(e) => update({ companyPhone: e.target.value })} /></Field>
              <Field label="Email" required><input type="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} disabled={!isNew} /></Field>
              <Field label="住址"><input value={draft.address} onChange={(e) => update({ address: e.target.value })} /></Field>
              <Field label="緊急聯絡人"><input value={draft.emergencyName} onChange={(e) => update({ emergencyName: e.target.value })} /></Field>
              <Field label="緊急聯絡電話"><input value={draft.emergencyPhone} onChange={(e) => update({ emergencyPhone: e.target.value })} /></Field>
            </div>
          </section>
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head"><span>03</span><h2>帳戶及權限</h2></div>
            <div className="form-grid two">
              <Field label="員工Code" required><input value={draft.code} disabled={!isNew} onChange={(e) => update({ code: e.target.value.toUpperCase() })} placeholder="例如：MM" /></Field>
              <Field label={isNew ? "登入密碼" : "重設登入密碼"} required={isNew}><input type="password" value={draft.password} onChange={(e) => update({ password: e.target.value })} placeholder={isNew ? "最少 8 位" : "留空保留現有密碼"} autoComplete="new-password" /></Field>
              <Field label="角色" required><select value={draft.role} onChange={(e) => update({ role: e.target.value, team: SALES_ROLES.includes(e.target.value) ? draft.team || "B" : "" })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              {sales && <Field label="Team" required><select value={draft.team || "B"} onChange={(e) => update({ team: e.target.value })}><option value="A">Team A</option><option value="B">Team B</option></select></Field>}
            </div>
          </section>
        </div>
        <aside className="user-profile-side">
          <section className="list-panel user-profile-card">
            <div className="profile-avatar-editor"><span className="user-avatar large">{avatar ? <img src={avatar} alt="" /> : <UserRound size={34} />}</span><div><Button type="button" onClick={() => inputRef.current?.click()}><ImagePlus size={17} /> 更換個人相片</Button><p>支援 JPG、PNG；上限 5MB。</p></div></div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); e.target.value = ""; }} />
            <h2>{draft.name || "新用戶"}</h2>
            <p>{ROLE_LABELS[draft.role] ?? draft.role}</p>
            <div className="user-profile-status"><Badge strong={existing?.active !== false}>{existing?.active === false ? "已停用" : "啟用中"}</Badge>{draft.team && <span>Team {draft.team}</span>}</div>
          </section>
        </aside>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );
}

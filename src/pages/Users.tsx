import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Plus,
  UserCog,
  UserRound,
} from "lucide-react";
import {
  getAttachmentBlob,
  saveAttachment,
  useApp,
} from "../context";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
} from "../components/ui";
import {
  Actor,
  Attachment,
  ROLE_NAMES,
  Role,
  Team,
} from "../domain/types";

const SALES_ROLES: Role[] = ["sales", "supervisor", "head"];
const DEPARTMENT_TABS: Array<{
  key: string;
  label: string;
  roles: Role[];
}> = [
  { key: "sales", label: "Sales", roles: SALES_ROLES },
  { key: "cs", label: "工程部", roles: ["cs", "cs_supervisor"] },
  {
    key: "finance",
    label: "會計",
    roles: ["finance", "finance_supervisor", "clerk"],
  },
  { key: "admin", label: "Admin", roles: ["admin", "admin_staff"] },
];

function departmentForRole(role: Role) {
  return (
    DEPARTMENT_TABS.find((department) => department.roles.includes(role)) ??
    DEPARTMENT_TABS[3]
  );
}

function UserAvatar({
  attachment,
  name,
  large = false,
}: {
  attachment?: Attachment;
  name: string;
  large?: boolean;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setUrl(undefined);
    if (!attachment) return;
    getAttachmentBlob(attachment).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id]);
  return (
    <span className={`user-avatar ${large ? "large" : ""}`}>
      {url ? (
        <img src={url} alt={`${name}個人相片`} />
      ) : (
        <span>{name.trim().slice(0, 1) || <UserRound size={large ? 34 : 18} />}</span>
      )}
    </span>
  );
}

function AvatarUpload({
  attachment,
  name,
  onChange,
}: {
  attachment?: Attachment;
  name: string;
  onChange: (attachment: Attachment) => void;
}) {
  const { run } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="profile-avatar-editor">
      <UserAvatar attachment={attachment} name={name} large />
      <div>
        <Button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <ImagePlus size={17} /> {busy ? "上載中…" : "更換個人相片"}
        </Button>
        <p>支援 JPG、PNG；相片只保存在此瀏覽器。</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const next = await saveAttachment(file);
            onChange(next);
          } catch (error) {
            run(() => {
              throw error;
            });
          } finally {
            setBusy(false);
            if (input.current) input.current.value = "";
          }
        }}
      />
    </div>
  );
}

export function Users() {
  const { actor, engine } = useApp();
  const [activeTab, setActiveTab] = useState("sales");
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const users = engine.listUsers(actor);
  const activeUsers = users.filter((user) => user.active !== false);
  const inactiveUsers = users.filter((user) => user.active === false);
  const department = DEPARTMENT_TABS.find((item) => item.key === activeTab)!;
  const visibleUsers = activeUsers.filter((user) =>
    department.roles.includes(user.role),
  );
  return (
    <>
      <PageHead
        title="用戶管理"
        actions={
          <>
            {inactiveUsers.length > 0 && (
              <Button onClick={() => setInactiveOpen(true)}>
                <UserCog size={18} /> 已停用帳戶（{inactiveUsers.length}）
              </Button>
            )}
            <Link className="btn" to="/design/users">
              預覽新設計
            </Link>
            <Link className="btn btn-primary" to="/users/new">
              <Plus size={20} /> 新增用戶
            </Link>
          </>
        }
      />
      <div className="user-tabs" role="tablist" aria-label="用戶部門">
        {DEPARTMENT_TABS.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={activeTab === item.key}
            className={activeTab === item.key ? "active" : ""}
            onClick={() => setActiveTab(item.key)}
          >
            {item.label}
            <span>
              {
                activeUsers.filter((user) => item.roles.includes(user.role))
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="list-panel user-list-panel">
        {visibleUsers.length === 0 ? (
          <Empty title={`${department.label}暫時沒有用戶`} />
        ) : (
          <div className="table-scroll">
            <table className="user-list-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>部門</th>
                  <th>聯絡電話</th>
                  <th>Email</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link className="user-list-person" to={`/users/${user.id}`}>
                        <UserAvatar attachment={user.avatar} name={user.name} />
                        <span>
                          <strong>{user.name}</strong>
                          <small>{ROLE_NAMES[user.role]}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{departmentForRole(user.role).label}</td>
                    <td>{user.phone || "—"}</td>
                    <td>{user.email || "—"}</td>
                    <td>
                      <Link className="user-view-link" to={`/users/${user.id}`}>
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {inactiveOpen && (
        <Dialog title="已停用帳戶" onClose={() => setInactiveOpen(false)}>
          <p className="dialog-intro">
            停用帳戶不會出現在部門列表，但歷史單據仍然保留。可按入profile重新啟用。
          </p>
          <div className="inactive-user-list">
            {inactiveUsers.map((user) => (
              <Link key={user.id} to={`/users/${user.id}`} onClick={() => setInactiveOpen(false)}>
                <UserAvatar attachment={user.avatar} name={user.name} />
                <span>
                  <strong>{user.name}</strong>
                  <small>
                    {departmentForRole(user.role).label} · {ROLE_NAMES[user.role]}
                  </small>
                </span>
                <span>查看</span>
              </Link>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}

type UserDraft = {
  id?: string;
  name: string;
  code: string;
  role: Role;
  team?: Team;
  surname?: string;
  salutation?: string;
  phone?: string;
  companyPhone?: string;
  email?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  bio?: string;
  avatar?: Attachment;
  username?: string;
  password?: string;
};

const EMPTY_USER: UserDraft = {
  name: "",
  code: "",
  role: "sales",
  team: "B",
  username: "",
  password: "",
};

export function UserProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { actor, engine, run } = useApp();
  const isNew = !id || id === "new";
  const existing = isNew
    ? undefined
    : engine.listUsers(actor).find((user) => user.id === id);
  const [draft, setDraft] = useState<UserDraft | null>(
    existing
      ? {
          id: existing.id,
          name: existing.name,
          code: existing.code,
          role: existing.role,
          team: existing.team,
          surname: existing.surname,
          salutation: existing.salutation,
          phone: existing.phone,
          companyPhone: existing.companyPhone,
          email: existing.email,
          address: existing.address,
          emergencyName: existing.emergencyName,
          emergencyPhone: existing.emergencyPhone,
          bio: existing.bio,
          avatar: existing.avatar,
          username: existing.username,
          password: "",
        }
      : isNew
        ? { ...EMPTY_USER }
        : null,
  );
  if (!draft) {
    return (
      <Empty
        title="找不到用戶"
        action={
          <Button onClick={() => nav("/users")}>返回用戶管理</Button>
        }
      />
    );
  }
  const salesDepartment = SALES_ROLES.includes(draft.role);
  const department = departmentForRole(draft.role);
  const update = (patch: Partial<UserDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));
  const save = () => {
    const saved = run(
      () => engine.saveUser(actor, draft),
      isNew ? "用戶已新增。" : "用戶資料已保存。",
    );
    if (saved) nav(`/users/${saved.id}`, { replace: true });
  };
  return (
    <>
      <PageHead
        eyebrow={isNew ? "新增用戶" : `${department.label} · ${draft.code}`}
        title={isNew ? "建立用戶檔案" : draft.name}
        actions={
          <>
            <Button onClick={() => nav("/users")}>
              <ArrowLeft size={18} /> 返回用戶管理
            </Button>
            <Button variant="primary" onClick={save}>
              <Check size={18} /> {isNew ? "建立用戶" : "儲存修改"}
            </Button>
          </>
        }
      />
      <div className="user-profile-layout">
        <div className="user-profile-main">
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head">
              <span>01</span>
              <h2>個人資料</h2>
            </div>
            <div className="form-grid two">
              <Field label="姓名" required>
                <input
                  aria-label="用戶姓名"
                  value={draft.name}
                  onChange={(event) => update({ name: event.target.value })}
                />
              </Field>
              <Field label="姓氏">
                <input
                  aria-label="用戶姓氏"
                  value={draft.surname ?? ""}
                  onChange={(event) =>
                    update({ surname: event.target.value })
                  }
                  placeholder="例如：陳"
                />
              </Field>
              <Field label="稱呼">
                <input
                  aria-label="用戶稱呼"
                  value={draft.salutation ?? ""}
                  onChange={(event) =>
                    update({ salutation: event.target.value })
                  }
                  placeholder="例如：陳生／阿文"
                />
              </Field>
              <div className="form-field-wide">
                <Field label="個人簡介">
                  <textarea
                    aria-label="個人簡介"
                    value={draft.bio ?? ""}
                    onChange={(event) => update({ bio: event.target.value })}
                    placeholder="簡單介紹這位同事的職責或背景"
                  />
                </Field>
              </div>
            </div>
          </section>
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head">
              <span>02</span>
              <h2>聯絡資料</h2>
            </div>
            <div className="form-grid two">
              <Field label="聯絡電話">
                <input
                  aria-label="用戶聯絡電話"
                  value={draft.phone ?? ""}
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </Field>
              <Field label="公司電話">
                <input
                  aria-label="用戶公司電話"
                  value={draft.companyPhone ?? ""}
                  onChange={(event) =>
                    update({ companyPhone: event.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  aria-label="用戶Email"
                  value={draft.email ?? ""}
                  onChange={(event) => update({ email: event.target.value })}
                />
              </Field>
              <Field label="住址">
                <input
                  aria-label="用戶住址"
                  value={draft.address ?? ""}
                  onChange={(event) => update({ address: event.target.value })}
                />
              </Field>
              <Field label="緊急聯絡人">
                <input
                  aria-label="用戶緊急聯絡人"
                  value={draft.emergencyName ?? ""}
                  onChange={(event) =>
                    update({ emergencyName: event.target.value })
                  }
                />
              </Field>
              <Field label="緊急聯絡電話">
                <input
                  aria-label="用戶緊急聯絡電話"
                  value={draft.emergencyPhone ?? ""}
                  onChange={(event) =>
                    update({ emergencyPhone: event.target.value })
                  }
                />
              </Field>
            </div>
          </section>
          <section className="list-panel user-profile-section">
            <div className="user-profile-section-head">
              <span>03</span>
              <h2>帳戶及權限</h2>
            </div>
            <div className="form-grid two">
              <Field label="員工Code" required>
                <input
                  aria-label="員工Code"
                  value={draft.code}
                  disabled={!isNew}
                  onChange={(event) =>
                    update({ code: event.target.value.toUpperCase() })
                  }
                  placeholder="例如：MM"
                />
              </Field>
              <Field label="登入用戶名" required={isNew}>
                <input
                  aria-label="登入用戶名"
                  autoComplete="off"
                  value={draft.username ?? ""}
                  onChange={(event) =>
                    update({ username: event.target.value })
                  }
                  placeholder="例如：mm.chan"
                />
              </Field>
              <Field label={isNew ? "登入密碼" : "重設登入密碼"} required={isNew}>
                <input
                  type="password"
                  aria-label="登入密碼"
                  autoComplete="new-password"
                  value={draft.password ?? ""}
                  onChange={(event) =>
                    update({ password: event.target.value })
                  }
                  placeholder={
                    isNew
                      ? "最少6位"
                      : existing?.password
                        ? "已設定；留空保留現有密碼"
                        : "尚未設定密碼"
                  }
                />
              </Field>
              <Field label="部門">
                <input value={department.label} disabled />
              </Field>
              <Field label="角色" required>
                <select
                  aria-label="用戶角色"
                  value={draft.role}
                  onChange={(event) => {
                    const role = event.target.value as Role;
                    update({
                      role,
                      team: SALES_ROLES.includes(role)
                        ? (draft.team ?? "B")
                        : undefined,
                    });
                  }}
                >
                  {(Object.keys(ROLE_NAMES) as Role[]).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_NAMES[role]}
                    </option>
                  ))}
                </select>
              </Field>
              {salesDepartment && (
                <Field label="Team" required>
                  <select
                    aria-label="用戶Team"
                    value={draft.team ?? "B"}
                    onChange={(event) =>
                      update({ team: event.target.value as Team })
                    }
                  >
                    <option value="A">Team A</option>
                    <option value="B">Team B</option>
                  </select>
                </Field>
              )}
            </div>
            <p className="user-code-note">
              登入用戶名及密碼由Super Admin設定。密碼只保存在此瀏覽器原型，不會顯示原有密碼。
            </p>
            {!isNew && (
              <p className="user-code-note">
                員工Code建立後不可更改，會用於報價、Invoice及業績編號。
              </p>
            )}
          </section>
        </div>
        <aside className="user-profile-side">
          <section className="list-panel user-profile-card">
            <AvatarUpload
              attachment={draft.avatar}
              name={draft.name}
              onChange={(avatar) => update({ avatar })}
            />
            <h2>{draft.name || "新用戶"}</h2>
            <p>{ROLE_NAMES[draft.role]}</p>
            <div className="user-profile-status">
              <Badge strong={!existing || existing.active !== false}>
                {existing?.active === false ? "已停用" : "啟用中"}
              </Badge>
              {draft.team && <span>Team {draft.team}</span>}
            </div>
            {existing && (
              <Button
                className="full-width"
                variant={existing.active === false ? "primary" : "ghost"}
                disabled={actor.id === existing.id}
                onClick={() => {
                  const updated = run(
                    () =>
                      engine.setUserActive(
                        actor,
                        existing.id,
                        existing.active === false,
                      ),
                    existing.active === false
                      ? "用戶已啟用。"
                      : "用戶已停用。",
                  );
                  if (updated) nav("/users");
                }}
              >
                {existing.active === false ? "重新啟用帳戶" : "停用帳戶"}
              </Button>
            )}
            {existing && actor.id === existing.id && (
              <p className="user-code-note">不可停用目前登入帳戶。</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

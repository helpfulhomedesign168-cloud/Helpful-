import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Plus, ChevronRight } from "lucide-react";
import { useApp } from "../context";
import { Actor, ROLE_NAMES, Role } from "../domain/types";

const DEPARTMENTS: Array<{ key: string; label: string; roles: Role[] }> = [
  { key: "sales", label: "Sales", roles: ["sales", "supervisor", "head"] },
  { key: "cs", label: "工程部", roles: ["cs", "cs_supervisor"] },
  {
    key: "finance",
    label: "會計",
    roles: ["finance", "finance_supervisor", "clerk"],
  },
  { key: "admin", label: "Admin", roles: ["admin", "admin_staff"] },
];

const NAV = [
  ["/design/users", "用戶管理", "nav-users"],
  ["/handoff", "工程單", "nav-orders"],
  ["/orders", "工程管理", "nav-engineering"],
  ["/contractors", "工程師傅", "nav-contractors"],
  ["/suppliers", "供應商", "nav-suppliers"],
  ["/municipal-orders", "市政單", "nav-municipal"],
  ["/business-orders", "營業單", "nav-business"],
  ["/cancellation-cases", "退款", "nav-refund"],
  ["/customers", "客戶", "nav-customers"],
  ["/product-styles", "產品款式", "nav-product-styles"],
  ["/services", "工程項目", "nav-services"],
  ["/custom-work-requests", "報價請示", "nav-requests"],
];

function departmentOf(role: Role) {
  return DEPARTMENTS.find((department) => department.roles.includes(role));
}

function PreviewAvatar({ user }: { user: Actor }) {
  return (
    <span className="preview-avatar">
      {user.name.trim().slice(0, 1) || "?"}
    </span>
  );
}

export function DesignUsersPreview() {
  const { actor, engine } = useApp();
  const [activeTab, setActiveTab] = useState("sales");
  const users = engine
    .listUsers(actor)
    .filter((user) => user.active !== false);
  const department = DEPARTMENTS.find((item) => item.key === activeTab)!;
  const visibleUsers = users.filter((user) =>
    department.roles.includes(user.role),
  );
  const unread = engine
    .notifications(actor)
    .filter((notice) => !notice.read).length;
  return (
    <div className="preview-app">
      <header className="preview-topbar">
        <Link to="/users" className="preview-brand">
          <img src="/design-assets/logo.svg" alt="好幫手家居裝修設計有限公司" />
        </Link>
        <div className="preview-topbar-actions">
          <button className="preview-bell" aria-label="通知">
            <Bell size={22} strokeWidth={1.6} />
            {unread > 0 && <span />}
          </button>
          <div className="preview-profile">
            <span className="preview-top-avatar">
              {actor.name.slice(0, 1)}
            </span>
            <div>
              <strong>{actor.name}</strong>
              <small>{ROLE_NAMES[actor.role]}</small>
            </div>
          </div>
        </div>
      </header>
      <aside className="preview-sidebar">
        <nav>
          {NAV.map(([path, label, icon]) => (
            <Link
              key={path}
              to={path}
              className={`preview-nav-item ${
                label === "用戶管理" ? "active" : ""
              }`}
            >
              <img
                src={`/design-assets/icons/${icon}.svg`}
                alt=""
                width={25}
                height={25}
              />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="preview-main">
        <div className="preview-page-head">
          <h1>用戶管理</h1>
          <Link to="/users/new" className="preview-primary-button">
            <Plus size={26} />
            新增用戶
          </Link>
        </div>
        <section className="preview-card">
          <div className="preview-tabs" role="tablist">
            {DEPARTMENTS.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={activeTab === item.key}
                className={activeTab === item.key ? "active" : ""}
                onClick={() => setActiveTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>用戶姓名</th>
                  <th>職位</th>
                  <th>聯絡電話</th>
                  <th>電郵</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="preview-user-cell">
                        <PreviewAvatar user={user} />
                        <strong>{user.name}</strong>
                      </div>
                    </td>
                    <td>{ROLE_NAMES[user.role]}</td>
                    <td>{user.phone || "—"}</td>
                    <td>{user.email || "—"}</td>
                    <td>
                      <Link to={`/users/${user.id}`} className="preview-view">
                        查看 <ChevronRight size={22} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

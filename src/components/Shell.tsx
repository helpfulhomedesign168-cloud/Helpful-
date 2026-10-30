import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Plus,
  Files,
  FileText,
  Users,
  Receipt,
  Hammer,
  ArrowRightLeft,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Menu,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  HardHat,
  Truck,
  Palette,
  Tags,
} from "lucide-react";
import { useApp } from "../context";
import { ROLE_NAMES } from "../domain/types";
import { Button, Dialog, Notice } from "./ui";
export const roleHome = (role: string) =>
  role === "finance"
    ? "/finance"
    : role === "clerk"
      ? "/submissions"
      : role === "cs" || role === "cs_supervisor"
        ? "/handoff"
        : role === "admin"
          ? "/services"
          : "/quotes";
export function Shell() {
  const { actor, engine, setActor, run } = useApp();
  const nav = useNavigate();
  const [roles, setRoles] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [tools, setTools] = useState(false);
  const selling = ["sales", "supervisor", "head"].includes(actor.role);
  const office = ["cs", "cs_supervisor", "clerk", "finance", "admin"].includes(
    actor.role,
  );
  const items = selling
    ? [
        ["/quotes", "報價管理", Files],
        ["/quotes/new", "建立報價", Plus],
        ["/customers", "客戶", Users],
        ["/product-styles", "產品款式", Palette],
        ["/performance", "我的業績", ChartNoAxesCombined],
      ]
    : actor.role === "cs" || actor.role === "cs_supervisor"
      ? [
          ["/handoff", "工程單", ArrowRightLeft],
          ["/orders", "工程管理", Hammer],
          ["/contractors", "工程師傅", HardHat],
          ["/suppliers", "供應商", Truck],
          ["/customers", "客戶", Users],
          ["/services", "工程價目", Tags],
        ]
      : actor.role === "finance"
        ? [
            ["/finance", "收款核對", Receipt],
            ["/invoices", "已開單據", Files],
          ]
        : actor.role === "clerk"
          ? [
              ["/submissions", "提交報價", ArrowRightLeft],
              ["/invoices", "單據管理", Files],
              ["/municipal-orders", "市政單", FileText],
              ["/customers", "客戶", Users],
            ]
          : [
              ["/handoff", "工程單", ArrowRightLeft],
              ["/orders", "工程管理", Hammer],
              ["/contractors", "工程師傅", HardHat],
              ["/suppliers", "供應商", Truck],
              ["/municipal-orders", "市政單", FileText],
              ["/customers", "客戶", Users],
              ["/product-styles", "產品款式", Palette],
              ["/services", "工程價目", Tags],
              ["/quotes", "報價查閱", Files],
            ];
  const notices = engine.notifications(actor);
  const unread = notices.filter((n) => !n.read).length;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <NavLink to={roleHome(actor.role)} className="wordmark">
          <span className="wordmark-symbol">H</span>
          <span>
            好幫手<strong>工程營運</strong>
          </span>
        </NavLink>
        <div className="nav-caption">
          {selling ? "Sales 工作區" : office ? "Office 工作區" : "工作區"}
        </div>
        <nav>
          {items.map(([path, label, Icon]) => {
            const I = Icon as typeof Files;
            return (
              <NavLink
                key={path as string}
                end
                to={path as string}
                onClick={() => setMobile(false)}
                className={({ isActive }) =>
                  "nav-item " + (isActive ? "active" : "")
                }
              >
                <I size={22} strokeWidth={1.7} />
                {label as string}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="prototype-tools" onClick={() => setTools(true)}>
            <SlidersHorizontal size={19} />
            原型工具
          </button>
          <span className="demo-label">流程原型 · Demo資料</span>
          <span className="build-label">初階版本 0.1</span>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="關閉選單"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-main">
        <div className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="開啟選單"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="topbar-actions">
            <button
              className="notification-button"
              onClick={() => setNotifications(!notifications)}
              aria-label="通知"
            >
              <Bell size={22} />
              {unread > 0 && (
                <span className="notification-count">{unread}</span>
              )}
            </button>
            <button className="actor-button" onClick={() => setRoles(true)}>
              <span className="avatar">{actor.name.slice(0, 1)}</span>
              <span>
                {actor.name}
                <small>{ROLE_NAMES[actor.role]}</small>
              </span>
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
        <main className="workspace">
          <Notice />
          <Outlet />
        </main>
        <footer className="app-footer">
          好幫手家居裝修設計有限公司{" "}
          <span>測試資料僅保存在這個瀏覽器，不作正式單據。</span>
        </footer>
      </div>
      {roles && (
        <Dialog title="切換測試角色" onClose={() => setRoles(false)}>
          <p className="muted">切換角色後，保留同一張單的最新進度。</p>
          <div className="role-list">
            {engine.listActors().map((a) => (
              <button
                key={a.id}
                className={`role-option ${a.id === actor.id ? "selected" : ""}`}
                onClick={() => {
                  setActor(a.id);
                  setRoles(false);
                  nav(roleHome(a.role));
                }}
              >
                <span className="avatar">{a.name.slice(0, 1)}</span>
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {ROLE_NAMES[a.role]}
                    {a.team ? " · Team " + a.team : ""}
                  </small>
                </span>
                <ArrowUpRight size={20} />
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {notifications && (
        <Dialog title="通知" onClose={() => setNotifications(false)}>
          {notices.length === 0 ? (
            <p className="muted">暫無通知。</p>
          ) : (
            notices
              .slice()
              .reverse()
              .map((n) => (
                <button
                  className="notification-row"
                  key={n.id}
                  onClick={() => {
                    run(() => engine.readNotification(actor, n.id));
                    setNotifications(false);
                    nav(
                      actor.role === "cs" ||
                      actor.role === "cs_supervisor"
                        ? "/handoff"
                        : actor.role === "finance"
                          ? "/finance"
                          : actor.role === "clerk"
                            ? "/submissions"
                            : "/quotes/" + n.quoteId,
                    );
                  }}
                >
                  <span className={!n.read ? "unread-dot" : ""} />
                  <strong>{n.message}</strong>
                  <ArrowUpRight size={20} />
                </button>
              ))
          )}
        </Dialog>
      )}
      {tools && (
        <Dialog title="原型工具" onClose={() => setTools(false)}>
          <p>
            這一輪用虛構資料測試四個角色的交接；不是正式登入、銀行連線或多人資料庫。
          </p>
          <div className="tools-note">
            <strong>本輪可試</strong>
            <p>報價、簽署、交Office、開單員分類核款、分期收據及50%發工程部。</p>
            <strong>下一輪深化</strong>
            <p>
              完整Catalog、採購、補單、SEL、會計整合及結算；不以空頁代替完成。
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  "重置這個瀏覽器的Demo資料？已建立的測試單會被清除。",
                )
              ) {
                run(() => engine.reset(), "Demo資料已重置。");
                setActor("sales-mm");
                setTools(false);
                nav("/quotes");
              }
            }}
          >
            <LogOut size={18} />
            重置Demo資料
          </Button>
        </Dialog>
      )}
    </div>
  );
}

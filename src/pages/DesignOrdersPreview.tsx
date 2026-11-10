import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { useApp } from "../context";
import {
  InvoiceCategory,
  INVOICE_CATEGORY_NAMES,
  ROLE_NAMES,
} from "../domain/types";

const NAV = [
  ["/design/users", "用戶管理", "nav-users"],
  ["/design/orders", "工程單", "nav-orders"],
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

const CATEGORY_CLASS: Record<string, string> = {
  "self-pay": "green",
  "group-buy": "blue",
  "grant-80k": "orange",
};

export function DesignOrdersPreview() {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [search, ownerFilter, monthFilter, salesFilter]);
  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const rows = engine.listHandoffs(actor);
  const csTeam = engine.listCsTeam(actor);
  const salesActors = engine
    .listActors()
    .filter((item) => ["sales", "supervisor", "head"].includes(item.role));
  const months = Array.from(
    new Set(rows.map((row) => row.releasedAt.slice(0, 7))),
  )
    .sort()
    .reverse();
  const quoteCategories = (quoteId: string, fallback?: InvoiceCategory) => {
    try {
      const quote = engine.getQuote(actor, quoteId);
      return quote.orderCategories?.length
        ? quote.orderCategories
        : fallback
          ? [fallback]
          : [];
    } catch {
      return fallback ? [fallback] : [];
    }
  };
  const shown = rows
    .filter((row) => {
      if (
        search &&
        !`${row.workOrderNumber} ${row.invoiceNumber} ${row.customerName} ${row.phone} ${row.salesName} ${row.csOwnerName ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      if (
        ownerFilter !== "all" &&
        (row.csOwnerId ?? "unassigned") !== ownerFilter
      )
        return false;
      if (monthFilter !== "all" && !row.releasedAt.startsWith(monthFilter))
        return false;
      if (salesFilter !== "all" && row.salesId !== salesFilter) return false;
      return true;
    })
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = shown.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const unread = engine.notifications(actor).filter((n) => !n.read).length;
  return (
    <div className="preview-app">
      <header className="preview-topbar">
        <button
          type="button"
          className={`preview-menu-toggle ${menuOpen ? "open" : ""}`}
          aria-label={menuOpen ? "關閉選單" : "開啟選單"}
          aria-expanded={menuOpen}
          aria-controls="orders-preview-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link to="/design/users" className="preview-brand">
          <img src="/design-assets/logo.svg" alt="好幫手家居裝修設計有限公司" />
        </Link>
        <div className="preview-topbar-actions">
          <button className="preview-bell" aria-label="通知">
            <Bell size={22} strokeWidth={1.6} />
            {unread > 0 && <span />}
          </button>
          <div className="preview-profile">
            <span className="preview-top-avatar">{actor.name.slice(0, 1)}</span>
            <div>
              <strong>{actor.name}</strong>
              <small>{ROLE_NAMES[actor.role]}</small>
            </div>
          </div>
        </div>
      </header>
      <aside
        id="orders-preview-sidebar"
        className={`preview-sidebar ${menuOpen ? "open" : ""}`}
      >
        <div className="preview-drawer-head">
          <img src="/design-assets/logo.svg" alt="好幫手" />
          <button
            type="button"
            className="preview-drawer-close"
            aria-label="關閉選單"
            onClick={() => setMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        <nav>
          {NAV.map(([path, label, icon]) => (
            <Link
              key={path}
              to={path}
              className={`preview-nav-item ${
                label === "工程單" ? "active" : ""
              }`}
              onClick={() => setMenuOpen(false)}
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
      <button
        type="button"
        className={`preview-overlay ${menuOpen ? "visible" : ""}`}
        aria-label="關閉選單"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <main className="preview-main preview-orders-main">
        <div className="preview-page-head">
          <h1>工程單</h1>
        </div>
        <section className="preview-orders-card">
          <div className="preview-orders-filters">
            <label className="preview-search">
              <Search size={20} />
              <input
                aria-label="搜尋工程單、客戶、電話或Sales"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜尋工程單、客戶、電話或Sales"
              />
            </label>
            <label className="preview-filter">
              <select
                aria-label="跟進同事"
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
              >
                <option value="all">全部跟進</option>
                <option value="unassigned">未安排</option>
                {csTeam.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} />
            </label>
            <label className="preview-filter">
              <select
                aria-label="工程單月份"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              >
                <option value="all">全部月份</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month.replace("-", "年")}月
                  </option>
                ))}
              </select>
              <ChevronDown size={18} />
            </label>
            <label className="preview-filter">
              <select
                aria-label="工程單Sales"
                value={salesFilter}
                onChange={(event) => setSalesFilter(event.target.value)}
              >
                <option value="all">全部Sales</option>
                {salesActors.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} />
            </label>
          </div>
          <div className="preview-orders-table-wrap">
            <table className="preview-orders-table">
              <thead>
                <tr>
                  <th>工程單</th>
                  <th>客戶</th>
                  <th>聯絡電話</th>
                  <th>Sales</th>
                  <th>類別</th>
                  <th>跟進同事</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => {
                  const categories = quoteCategories(row.quoteId, row.category);
                  return (
                    <tr key={row.workOrderId ?? row.quoteId}>
                      <td>
                        <strong>{row.workOrderNumber}</strong>
                        <small>{row.invoiceNumber}</small>
                      </td>
                      <td>
                        <strong>{row.customerName}</strong>
                        <small>{row.district}</small>
                      </td>
                      <td>{row.phone}</td>
                      <td>{row.salesName}</td>
                      <td>
                        <span className="preview-category-group">
                          {categories.map((category) => (
                            <span
                              key={category}
                              className={`preview-category ${CATEGORY_CLASS[category] ?? "neutral"}`}
                            >
                              {category === "grant-80k"
                                ? "8萬"
                                : INVOICE_CATEGORY_NAMES[category]}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>{row.csOwnerName ?? "未安排"}</td>
                      <td>
                        {row.csOwnerName ? (
                          <button
                            className="preview-outline-action"
                            onClick={() => nav(`/orders/${row.workOrderId}`)}
                          >
                            安排工程 <ChevronRight size={18} />
                          </button>
                        ) : (
                          <button
                            className="preview-orange-action"
                            onClick={() => nav(`/orders/${row.workOrderId}`)}
                          >
                            安排工程 <ChevronRight size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && (
              <div className="preview-orders-empty">沒有符合條件的工程單</div>
            )}
          </div>
          {shown.length > 0 && (
            <div className="preview-orders-pager">
              <span>
                共 {shown.length} 張 · 第 {currentPage} / {pageCount} 頁
              </span>
              <div>
                <button
                  aria-label="上一頁"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button
                  aria-label="下一頁"
                  disabled={currentPage >= pageCount}
                  onClick={() =>
                    setPage((value) => Math.min(pageCount, value + 1))
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Empty, PageHead, Button } from "../components/ui";

type Filter = "all" | "unread";
type NotificationRow = { id: string; title: string; body: string; entityType: string | null; entityId: string | null; read: boolean; createdAt: string };
const ROLE_LABELS: Record<string, string> = {
  invoice_clerk: "直接開單員", finance: "會計", finance_supervisor: "會計主管", cs: "CS",
  cs_supervisor: "CS主管", admin: "Super Admin", admin_staff: "Admin Staff", sales: "Sales",
  supervisor: "Sales主管", head: "Sales阿頭", clerk: "舊開單員",
};
const kind = (row: NotificationRow) =>
  row.entityType === "invoice" ? "單據" : row.entityType === "work_order" ? "工程單" : row.entityType === "cancellation_case" ? "退款" : row.entityType === "custom_work_request" ? "自訂工程" : "系統";

export function LiveNotifications() {
  const { accessToken, user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows(await apiRequest<NotificationRow[]>("/notifications", accessToken)); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取通知。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function markRead(row: NotificationRow) {
    await apiRequest(`/notifications/${row.id}/read`, accessToken, { method: "POST" });
    if (row.entityType === "invoice" && row.entityId) nav(`/invoices/${row.entityId}`);
    else if (row.entityType === "work_order" && row.entityId) nav(`/orders/${row.entityId}`);
    else if (row.entityType === "cancellation_case" && row.entityId) nav(`/cancellation-cases/${row.entityId}`);
    else await load();
  }
  async function markAll() {
    await apiRequest("/notifications/read-all", accessToken, { method: "POST" });
    await load();
  }

  const unread = rows.filter((row) => !row.read).length;
  const shown = filter === "unread" ? rows.filter((row) => !row.read) : rows;
  return (
    <>
      <PageHead eyebrow={`${ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? ""} · 通知`} title="訊息通知" description="所有同你工作相關嘅報價、單據及退款通知都會集中在這裏。" actions={unread > 0 ? <Button onClick={() => void markAll()}>全部標為已讀</Button> : undefined} />
      <div className="list-panel notifications-page">
        <div className="notification-tabs">
          <button type="button" className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>全部 <span>{rows.length}</span></button>
          <button type="button" className={filter === "unread" ? "selected" : ""} onClick={() => setFilter("unread")}>未讀 <span>{unread}</span></button>
        </div>
        {loading ? <p className="muted">正在讀取通知…</p> : error ? <Empty title="未能讀取通知" description={error} /> : shown.length === 0 ? <Empty title={filter === "unread" ? "沒有未讀通知" : "暫無通知"} description={filter === "unread" ? "所有通知都已經睇過。" : "有新嘅單據、工程或退款消息時會在這裏出現。"} /> : (
          <div className="notification-list">{shown.map((row) => <button type="button" className={`notification-row notification-page-row ${row.read ? "" : "unread"}`} key={row.id} onClick={() => void markRead(row)}><span className={!row.read ? "unread-dot" : ""} /><div className="notification-copy"><strong>{row.title}</strong><small>{row.body}</small><small>{row.createdAt.slice(0, 16).replace("T", " ")} · {kind(row)}</small></div><ArrowUpRight size={20} /></button>)}</div>
        )}
      </div>
    </>
  );
}

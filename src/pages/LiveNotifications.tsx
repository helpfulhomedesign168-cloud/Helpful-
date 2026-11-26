import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, PageHead } from "../components/ui";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
};

export function LiveNotifications() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await apiRequest<NotificationRow[]>("/notifications", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取通知。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function markRead(row: NotificationRow) {
    await apiRequest(`/notifications/${row.id}/read`, accessToken, { method: "POST" });
    if (row.entityType === "invoice" && row.entityId) nav(`/invoices/${row.entityId}`);
    else if (row.entityType === "work_order" && row.entityId) nav(`/orders/${row.entityId}`);
    else await load();
  }

  async function markAll() {
    await apiRequest("/notifications/read-all", accessToken, { method: "POST" });
    await load();
  }

  const unread = rows.filter((row) => !row.read).length;
  return (
    <>
      <PageHead title="訊息通知" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <span className="muted">{unread} 則未讀</span>
          <Button onClick={markAll}><CheckCheck size={18} /> 全部已讀</Button>
        </div>
        {loading ? <p className="muted">正在讀取通知…</p> : error ? (
          <Empty title="未能讀取通知" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無通知" />
        ) : (
          <div className="notification-list">
            {rows.map((row) => (
              <button key={row.id} className={`notification-card ${row.read ? "" : "unread"}`} onClick={() => void markRead(row)}>
                <span className="notification-icon"><Bell size={18} /></span>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.body}</small>
                  <small>{row.createdAt.slice(0, 16).replace("T", " ")}</small>
                </span>
                {!row.read && <Badge strong>未讀</Badge>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

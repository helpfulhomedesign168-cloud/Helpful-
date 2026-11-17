import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context";
import { Empty, PageHead, Button } from "../components/ui";
import { ROLE_NAMES } from "../domain/types";
import { notificationTarget } from "../notificationTarget";

type NotificationFilter = "all" | "unread";

function notificationKind(notification: {
  invoiceId?: string;
  customRequestId?: string;
  cancellationCaseId?: string;
}) {
  if (notification.invoiceId) return "單據";
  if (notification.customRequestId) return "自訂工程";
  if (notification.cancellationCaseId) return "退款";
  return "報價";
}

function notificationTime(value: string) {
  return value.slice(0, 16).replace("T", " ");
}

export function Notifications() {
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const notices = engine
    .notifications(actor)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notices.filter((notice) => !notice.read).length;
  const shown =
    filter === "unread"
      ? notices.filter((notice) => !notice.read)
      : notices;
  return (
    <>
      <PageHead
        eyebrow={`${ROLE_NAMES[actor.role]} · 通知`}
        title="訊息通知"
        description="所有同你工作相關嘅報價、單據及退款通知都會集中在這裏。"
        actions={
          unread > 0 ? (
            <Button
              onClick={() =>
                run(() => {
                  notices
                    .filter((notice) => !notice.read)
                    .forEach((notice) =>
                      engine.readNotification(actor, notice.id),
                    );
                  return true;
                }, "所有通知已標為已讀。")
              }
            >
              全部標為已讀
            </Button>
          ) : undefined
        }
      />
      <div className="list-panel notifications-page">
        <div className="notification-tabs">
          <button
            type="button"
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            全部 <span>{notices.length}</span>
          </button>
          <button
            type="button"
            className={filter === "unread" ? "selected" : ""}
            onClick={() => setFilter("unread")}
          >
            未讀 <span>{unread}</span>
          </button>
        </div>
        {shown.length === 0 ? (
          <Empty
            title={filter === "unread" ? "沒有未讀通知" : "暫無通知"}
            description={
              filter === "unread"
                ? "所有通知都已經睇過。"
                : "有新嘅報價、單據或退款消息時會在這裏出現。"
            }
          />
        ) : (
          <div className="notification-list">
            {shown.map((notice) => (
              <button
                type="button"
                className={`notification-row notification-page-row ${
                  notice.read ? "" : "unread"
                }`}
                key={notice.id}
                onClick={() => {
                  run(() => engine.readNotification(actor, notice.id));
                  nav(notificationTarget(actor.role, notice));
                }}
              >
                <span className={!notice.read ? "unread-dot" : ""} />
                <div className="notification-copy">
                  <strong>{notice.message}</strong>
                  <small>
                    {notificationTime(notice.createdAt)} ·{" "}
                    {notificationKind(notice)}
                  </small>
                </div>
                <ArrowUpRight size={20} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

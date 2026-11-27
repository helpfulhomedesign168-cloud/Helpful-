import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Empty, PageHead, Search } from "../components/ui";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  requestId: string | null;
  createdAt: string;
  actorName: string | null;
};

export function LiveAudit() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
    apiRequest<AuditRow[]>(`/audit-logs${params}`, accessToken)
      .then((data) => { setRows(data); setError(""); })
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取審計紀錄。"))
      .finally(() => setLoading(false));
  }, [accessToken, search]);

  return (
    <>
      <PageHead title="審計紀錄" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋動作／對象／操作人" />
          <span className="muted">最近 100 條</span>
        </div>
        {loading ? <p className="muted">正在讀取審計紀錄…</p> : error ? <Empty title="未能讀取審計紀錄" description={error} /> : rows.length === 0 ? <Empty title="暫無審計紀錄" /> : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>時間</th><th>操作人</th><th>動作</th><th>對象</th><th>Entity ID</th><th>Request ID</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id}><td>{row.createdAt.slice(0, 19).replace("T", " ")}</td><td>{row.actorName || "—"}</td><td><strong>{row.action}</strong></td><td>{row.entityType}</td><td><small>{row.entityId || "—"}</small></td><td><small>{row.requestId || "—"}</small></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

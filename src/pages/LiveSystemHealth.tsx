import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Empty, PageHead } from "../components/ui";

type Health = {
  db: { ok: boolean };
  migrations: number;
  counts: { users: number; invoices: number; customers: number; work_orders: number; services: number; payments: number };
  flags: { key: string; enabled: boolean }[];
  storage: { bucket: string; ok: boolean; status: number };
  region: string;
  now: string;
};

export function LiveSystemHealth() {
  const { accessToken } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<Health>("/system/health", accessToken)
      .then(setHealth)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取系統狀態。"));
  }, [accessToken]);
  if (error) return <Empty title="未能讀取系統狀態" description={error} />;
  if (!health) return <p className="muted">正在檢查系統…</p>;
  return (
    <>
      <PageHead title="系統狀態" />
      <div className="list-panel">
        <div className="invoice-summary-grid">
          <div><span>Database</span><strong><Badge strong={health.db.ok}>{health.db.ok ? "正常" : "異常"}</Badge></strong></div>
          <div><span>Migrations</span><strong>{health.migrations}</strong></div>
          <div><span>Storage</span><strong><Badge strong={health.storage.ok}>{health.storage.ok ? "正常" : `HTTP ${health.storage.status || "—"}`}</Badge></strong></div>
          <div><span>Function region</span><strong>{health.region}</strong></div>
        </div>
        <h2 className="section-title">資料量</h2>
        <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>Users</th><th>Customers</th><th>Invoices</th><th>Payments</th><th>Work orders</th><th>Services</th></tr></thead><tbody><tr><td>{health.counts.users}</td><td>{health.counts.customers}</td><td>{health.counts.invoices}</td><td>{health.counts.payments}</td><td>{health.counts.work_orders}</td><td>{health.counts.services}</td></tr></tbody></table></div>
        <h2 className="section-title">Feature flags</h2>
        <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>Flag</th><th>狀態</th></tr></thead><tbody>{health.flags.map((flag) => <tr key={flag.key}><td><code>{flag.key}</code></td><td><Badge strong={flag.enabled}>{flag.enabled ? "啟用" : "停用"}</Badge></td></tr>)}</tbody></table></div>
        <p className="muted">最後檢查：{health.now.slice(0, 19).replace("T", " ")} UTC</p>
      </div>
    </>
  );
}

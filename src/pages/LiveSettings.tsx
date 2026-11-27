import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, PageHead } from "../components/ui";

type Flag = { key: string; enabled: boolean; updatedAt: string | null };

const LABELS: Record<string, string> = {
  direct_invoice: "Direct Invoice",
  sales_workspace: "Sales Workspace",
  legacy_clerk: "Legacy Clerk",
};

export function LiveSettings() {
  const { accessToken } = useAuth();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setFlags(await apiRequest<Flag[]>("/feature-flags", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取設定。");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function toggle(flag: Flag) {
    if (!confirm(`確定要${flag.enabled ? "停用" : "啟用"} ${LABELS[flag.key] ?? flag.key}？`)) return;
    setSaving(flag.key);
    setNotice("");
    try {
      await apiRequest("/feature-flags", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ key: flag.key, enabled: !flag.enabled }),
      });
      await load();
      setNotice(`${LABELS[flag.key] ?? flag.key} 已${flag.enabled ? "停用" : "啟用"}。`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能更新設定。");
    } finally {
      setSaving("");
    }
  }

  return (
    <>
      <PageHead title="系統設定" />
      <div className="list-panel">
        {error ? <Empty title="未能讀取設定" description={error} /> : flags.length === 0 ? <p className="muted">正在讀取設定…</p> : (
          <div className="table-scroll"><table className="invoice-list-table live-work-table"><thead><tr><th>功能</th><th>Flag</th><th>狀態</th><th>最後更新</th><th /></tr></thead><tbody>{flags.map((flag) => <tr key={flag.key}><td><strong>{LABELS[flag.key] ?? flag.key}</strong></td><td><code>{flag.key}</code></td><td><Badge strong={flag.enabled}>{flag.enabled ? "啟用" : "停用"}</Badge></td><td>{flag.updatedAt ? flag.updatedAt.slice(0, 16).replace("T", " ") : "—"}</td><td><Button variant={flag.enabled ? "secondary" : "primary"} disabled={saving === flag.key} onClick={() => void toggle(flag)}>{saving === flag.key ? "更新中…" : flag.enabled ? "停用" : "啟用"}</Button></td></tr>)}</tbody></table></div>
        )}
        {notice && <p className="muted">{notice}</p>}
        <p className="auth-warning">Feature flag 會即時影響所有用戶；停用前請確認沒有同事正在使用相關流程。</p>
      </div>
    </>
  );
}

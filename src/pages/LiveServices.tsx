import React, { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Empty, PageHead, Search } from "../components/ui";
import { money } from "../domain/types";

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  priceCents: number;
  measure: string;
  published: boolean;
};

export function LiveServices() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<ServiceRow[]>("/services", accessToken)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "未能讀取工程價目。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const categories = ["全部", ...Array.from(new Set(rows.map((row) => row.category)))];
  const visible = rows.filter(
    (row) =>
      (category === "全部" || row.category === category) &&
      `${row.code} ${row.name} ${row.category}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHead title="工程價目" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋工程名稱或代號" />
          <select aria-label="工程分類" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {loading ? <p className="muted">正在讀取工程價目…</p> : error ? (
          <Empty title="未能讀取工程價目" description={error} />
        ) : visible.length === 0 ? (
          <Empty title="暫無工程項目" description="Admin 可在價目表新增工程。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>項目代號</th><th>工程名稱</th><th>分類</th><th>單位</th><th>價格</th><th>狀態</th></tr></thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.code}</strong></td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.unit}</td>
                    <td>{money(row.priceCents / 100)}</td>
                    <td><Badge strong={row.published}>{row.published ? "啟用" : "草稿"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Badge, Button, Empty, PageHead } from "../components/ui";
import { money } from "../domain/types";

type PendingPayment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  installment: number;
  amountCents: number;
  method: string;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
};

export function LiveFinance() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<PendingPayment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(await apiRequest<PendingPayment[]>("/payments/pending", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取待核對付款。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function validate(row: PendingPayment) {
    setBusy(row.id);
    try {
      await apiRequest(
        `/invoices/${row.invoiceId}/payments/${row.id}/validate`,
        accessToken,
        { method: "POST" },
      );
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能核對付款。");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="收款核對" />
      <div className="list-panel">
        {loading ? <p className="muted">正在讀取待核對付款…</p> : error ? (
          <Empty title="未能讀取付款" description={error} />
        ) : rows.length === 0 ? (
          <Empty title="暫無待核對付款" description="直接開單員儲存的待核對期款會出現在這裏。" />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table live-work-table">
              <thead><tr><th>Invoice</th><th>客戶</th><th>期數</th><th>金額</th><th>日期</th><th>方式</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.invoiceNumber}</strong></td>
                    <td><strong>{row.customerName}</strong><small>{row.customerPhone}</small></td>
                    <td>第{row.installment}期</td>
                    <td>{money(row.amountCents / 100)}</td>
                    <td>{row.paidAt}</td>
                    <td>{row.method.toUpperCase()}</td>
                    <td><Button variant="primary" disabled={busy === row.id} onClick={() => validate(row)}><Check size={17} /> {busy === row.id ? "核對中…" : "核對收款"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted">核對後會更新 Invoice 收款進度；累計達 50% 會自動建立工程單。</p>
      </div>
    </>
  );
}

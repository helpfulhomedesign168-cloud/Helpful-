import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Button, Empty } from "../components/ui";
import { METHOD_NAMES, money } from "../domain/types";

type ReceiptDetail = {
  id: string;
  number: string;
  amountCents: number;
  issuedAt: string;
  installment: number;
  paidAt: string;
  method: string;
  reference: string | null;
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  validPaidCents: number;
  customer: { name: string; phone: string; address: string | null; district: string | null };
  issuedBy: string;
};

function dateDisplay(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year ? `${day} / ${month} / ${year}` : "—";
}

export function LiveReceipt() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest<ReceiptDetail>(`/receipts/${id}`, accessToken)
      .then((data) => {
        if (!cancelled) setReceipt(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "未能讀取收據。");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  if (error) return <Empty title="未能讀取收據" description={error} />;
  if (!receipt) return <p className="muted">正在讀取收據…</p>;

  return (
    <div className="document-page quotation-page">
      <div className="document-toolbar">
        <Button onClick={() => nav(-1)}><ArrowLeft size={20} /> 返回</Button>
        <span>正式收據</span>
        <Button variant="primary" onClick={() => window.print()}><Printer size={20} /> 列印／另存PDF</Button>
      </div>
      <article className="document-sheet quotation-sheet receipt-sheet">
        <header className="quotation-head">
          <div className="quotation-brand"><img src="/company-logo.png" alt="好幫手家居裝修設計有限公司" /></div>
          <div className="quotation-contact">
            <span>九龍荔枝角長義街 2-4 號新昌工業大廈 2 樓 202A 室</span>
            <span>info@helpfulhomedesign.com.hk</span>
            <span>+852 6600 2878 · +852 3615 0180 · 3615 0198</span>
          </div>
        </header>
        <div className="quotation-title">
          <h1>正式收據</h1>
          <span>Receipt</span>
        </div>
        <div className="quotation-meta-line">
          <div>No. <strong className="document-number">{receipt.number}</strong></div>
          <div>日期：<strong>{dateDisplay(receipt.issuedAt)}</strong></div>
        </div>
        <div className="quotation-customer-lines">
          <div><span>客戶姓名：</span><strong>{receipt.customer.name}</strong><span className="quotation-phone-label">聯絡電話：</span><strong>{receipt.customer.phone}</strong></div>
          <div><span>客戶地址：</span><strong>{receipt.customer.address || receipt.customer.district || "—"}</strong></div>
        </div>
        <table className="document-table receipt-summary-table">
          <thead><tr><th>項目</th><th>內容</th></tr></thead>
          <tbody>
            <tr><td>對應 Invoice</td><td><strong>{receipt.invoiceNumber}</strong></td></tr>
            <tr><td>收款期數</td><td><strong>第{receipt.installment}期</strong></td></tr>
            <tr><td>收款日期</td><td><strong>{dateDisplay(receipt.paidAt)}</strong></td></tr>
            <tr><td>付款方式</td><td><strong>{METHOD_NAMES[receipt.method as keyof typeof METHOD_NAMES] || receipt.method}{receipt.reference ? ` · ${receipt.reference}` : ""}</strong></td></tr>
          </tbody>
        </table>
        <div className="document-totals receipt-totals">
          <div className="total"><span>本次已收</span><strong>{money(receipt.amountCents / 100)}</strong></div>
        </div>
        <div className="document-terms receipt-statement">
          <h3>收據聲明</h3>
          <p>此收據只代表上述一筆款項已由公司核對為有效收款；並不代表全部工程款已結清。</p>
          <p>經手人：{receipt.issuedBy}</p>
        </div>
      </article>
    </div>
  );
}

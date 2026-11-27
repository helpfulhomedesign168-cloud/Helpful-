import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError, type InvoiceDetailData } from "../api/client";
import { Button, Empty } from "../components/ui";
import { money } from "../domain/types";

function displayDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year ? `${day} / ${month} / ${year}` : "—";
}

export function LiveInvoiceDocument() {
  const { id = "" } = useParams();
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetailData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<InvoiceDetailData>(`/invoices/${id}`, accessToken)
      .then(setInvoice)
      .catch((e) => setError(e instanceof ApiError ? e.message : "未能讀取發票。"));
  }, [accessToken, id]);

  if (error) return <Empty title="未能讀取發票" description={error} />;
  if (!invoice) return <p className="muted">正在讀取發票…</p>;

  return (
    <div className="document-page quotation-page">
      <div className="document-toolbar">
        <Button onClick={() => nav(-1)}><ArrowLeft size={20} /> 返回</Button>
        <span>Invoice預覽</span>
        <Button variant="primary" onClick={() => window.print()}><Printer size={20} /> 列印／另存PDF</Button>
      </div>
      <article className="document-sheet quotation-sheet invoice-sheet">
        <header className="quotation-head">
          <div className="quotation-brand"><img src="/company-logo.png" alt="好幫手家居裝修設計有限公司" /></div>
          <div className="quotation-contact">
            <span>九龍荔枝角長義街 2-4 號新昌工業大廈 2 樓 202A 室</span>
            <span>info@helpfulhomedesign.com.hk</span>
            <span>+852 6600 2878 · +852 3615 0180 · 3615 0198</span>
          </div>
        </header>
        <div className="quotation-title"><h1>INVOICE</h1><span>發票</span></div>
        <div className="quotation-meta-line">
          <div>No. <strong className="document-number">{invoice.number}</strong></div>
          <div>日期：<strong>{displayDate(invoice.createdAt)}</strong></div>
        </div>
        <div className="quotation-customer-lines">
          <div><span>客戶姓名：</span><strong>{invoice.customer.name}</strong><span className="quotation-phone-label">聯絡電話：</span><strong>{invoice.customer.phone}</strong></div>
          <div><span>客戶地址：</span><strong>{invoice.customer.address || invoice.customer.district || "—"}</strong></div>
        </div>
        <table className="document-table">
          <thead><tr><th>#</th><th>工程項目</th><th>數量</th><th className="numeric">單價</th><th className="numeric">金額</th></tr></thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td><strong>{line.name}</strong>{line.position && <small>{line.position}</small>}</td>
                <td>{line.quantity} {line.unit}</td>
                <td className="numeric">{money(line.unitPriceCents / 100)}</td>
                <td className="numeric">{money(line.amountCents / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="document-totals">
          <div className="total"><span>總額</span><strong>{money(invoice.totalCents / 100)}</strong></div>
          <div><span>已核收款</span><strong>{money(invoice.validPaidCents / 100)}</strong></div>
        </div>
        {invoice.categories.includes("grant-80k") && (
          <div className="document-terms">
            <h3>8萬資助資料</h3>
            <p>申請編號：{invoice.grantApplicationNumber || "待政府批核"}</p>
            <p>批核金額：{invoice.grantApprovedAmountCents ? money(invoice.grantApprovedAmountCents / 100) : "—"}</p>
          </div>
        )}
      </article>
    </div>
  );
}

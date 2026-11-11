import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { useApp } from "../context";
import { Button, Empty } from "../components/ui";
import { currentVersion, discountLabel, money } from "../domain/types";
export function Documents() {
  const { kind, id = "" } = useParams();
  const { engine, actor } = useApp();
  const nav = useNavigate();
  try {
    const municipal =
      kind === "municipal" ? engine.getMunicipalOrder(actor, id) : undefined;
    const receipt =
      kind === "receipt" ? engine.getReceipt(actor, id) : undefined;
    const inv =
      kind === "invoice"
        ? engine.getInvoice(actor, id)
        : receipt
          ? engine.getInvoice(actor, receipt.invoiceId)
          : undefined;
    const quote = kind === "quote" ? engine.getQuote(actor, id) : undefined;
    const v = quote ? currentVersion(quote) : undefined;
    const lines = inv?.lines || v?.lines || [];
    const customer = municipal?.customer || inv?.customer || v?.customer;
    if (!customer) throw new Error("沒有可預覽來源");
    const totals = municipal
      ? undefined
      : inv
        ? engine.invoicePricing(actor, inv.id)
        : engine.pricing(actor, quote!.id);
    const canPrintClerkCorrection =
      Boolean(quote?.clerkCorrectionCount) &&
      (["clerk", "finance_supervisor"].includes(actor.role) ||
        ["admin", "admin_staff"].includes(actor.role));
    if (quote && !v?.printPreparation && !canPrintClerkCorrection)
      throw new Error("請先在報價詳情確認當日主管並準備列印正式報價單。");
    const number =
      municipal?.number ||
      receipt?.number ||
      inv?.number ||
      v?.printPreparation?.quoteNumber ||
      quote!.number;
    const displayNumber = quote?.clerkCorrectionCount
      ? `${number}（V${quote.clerkCorrectionCount}）`
      : number;
    const d = inv?.discount ?? v?.discount ?? 1;
    const quoteDate =
      v?.printPreparation?.date ||
      v?.signature?.date ||
      v?.createdAt.slice(0, 10) ||
      "—";
    const [quoteYear, quoteMonth, quoteDay] = quoteDate.split("-");
    const quoteDateDisplay =
      quoteYear && quoteMonth && quoteDay
        ? `${quoteDay} / ${quoteMonth} / ${quoteYear}`
        : quoteDate;
    return (
      <div className={`document-page ${quote ? "quotation-page" : ""}`}>
        <div className={`document-toolbar ${quote ? "quote-toolbar" : ""}`}>
          {!quote && (
            <Button onClick={() => nav(-1)}>
              <ArrowLeft size={20} />
              返回
            </Button>
          )}
          <span>
            {municipal
              ? "市政單預覽"
              : receipt
                ? "正式收據"
                : inv
                  ? "Invoice預覽"
                  : "報價單預覽"}
          </span>
          {!quote && (
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={20} />
              列印／另存PDF
            </Button>
          )}
        </div>
        <article className={`document-sheet ${quote ? "quotation-sheet" : ""}`}>
          {quote ? (
            <>
              <header className="quotation-head">
                <div className="quotation-brand">
                  <img
                    src="/design-assets/logo.svg"
                    alt="好幫手家居裝修設計有限公司"
                  />
                </div>
                <div className="quotation-contact">
                  <span>九龍荔枝角長義街 2-4 號新昌工業大廈 2 樓 202A 室</span>
                  <span>info@helpfulhomedesign.com.hk</span>
                  <span>+852 6600 2878 · +852 3615 0180 · 3615 0198</span>
                </div>
              </header>
              <div className="quotation-title">
                <h1>報價單</h1>
                <span>Quotation</span>
              </div>
              <div className="quotation-meta-line">
                <div>No. <strong className="document-number">{displayNumber}</strong></div>
                <div>日期：<strong>{quoteDateDisplay}</strong></div>
              </div>
              <div className="quotation-customer-lines">
                <div>
                  <span>客戶姓名：</span>
                  <strong>{customer.name || "待填客戶"}</strong>
                  <span className="quotation-phone-label">聯絡電話：</span>
                  <strong>{customer.phone}</strong>
                </div>
                <div>
                  <span>客戶地址：</span>
                  <strong>{customer.address || "待填地址"}</strong>
                </div>
              </div>
            </>
          ) : (
            <>
          <header className="document-letterhead">
            <img src="/company-logo.png" alt="好幫手家居裝修設計有限公司" />
            <div>
              <h1>
                {municipal
                  ? "市政單"
                  : receipt
                    ? "正式收據"
                    : inv
                      ? "工程Invoice"
                      : "工程報價單"}
              </h1>
              <strong className="document-number">{displayNumber}</strong>
              <p>
                {municipal
                  ? `正單 ${municipal.principalOrderNumber} · 政府8萬資助申請`
                  : `版本 ${v?.index || "快照"} · ${
                      inv?.createdAt.slice(0, 10) ||
                      v?.printPreparation?.date ||
                      v?.createdAt.slice(0, 10)
                    }`}
              </p>
            </div>
          </header>
          <div className="document-company-bar">
            <span>
              住宅裝修工程{" "}
              {municipal
                ? "市政單"
                : receipt
                  ? "收據"
                  : inv
                    ? "Invoice"
                    : "報價"}
            </span>
            <span>聯絡、條款及收款資料將由公司設定代入</span>
          </div>
          <div className="document-recipient">
            <div>
              <span>客戶</span>
              <strong>{customer.name || "待填客戶"}</strong>
              <p>
                {customer.phone}
                {customer.whatsapp && customer.whatsapp !== customer.phone
                  ? ` · WhatsApp ${customer.whatsapp}`
                  : ""}
              </p>
            </div>
            <div>
              <span>工程地址</span>
              <strong>{customer.address || "待填地址"}</strong>
            </div>
          </div>
            </>
          )}
          {municipal ? (
            <>
              <table className="document-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>工程項目</th>
                    <th>說明</th>
                    <th className="numeric">數量</th>
                    <th className="numeric">單價</th>
                    <th className="numeric">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {municipal.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{line.name}</strong>
                      </td>
                      <td>{line.description || "—"}</td>
                      <td className="numeric">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="numeric">{money(line.unitPrice)}</td>
                      <td className="numeric">{money(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="document-totals">
                <div className="total">
                  <span>市政單總額（不作正式會計）</span>
                  <strong>
                    {money(
                      municipal.lines.reduce(
                        (sum, line) => sum + line.amount,
                        0,
                      ),
                    )}
                  </strong>
                </div>
              </div>
              <div className="document-terms">
                <h3>市政單用途</h3>
                <p>
                  此市政單由正單 {municipal.principalOrderNumber} 分拆，只作政府8萬資助申請用途，不是客戶真實成交單，亦不計入公司會計。
                </p>
                <p>
                  市政單項目及金額可按政府申請要求調整；正單、Invoice及收款紀錄不受影響。
                </p>
              </div>
            </>
          ) : receipt ? (
            <div className="document-totals">
              <div>
                <span>對應Invoice</span>
                <strong>{inv?.number}</strong>
              </div>
              <div>
                <span>收款期數</span>
                <strong>
                  {receipt.installmentLabel || `第${receipt.installment}期`}
                  {receipt.percentage ? ` · ${receipt.percentage}%` : ""}
                </strong>
              </div>
              <div className="total">
                <span>本次已收</span>
                <strong>{money(receipt.amount)}</strong>
              </div>
              <p>
                此收據只代表上述一筆款項已由公司核對為有效收款；並不代表全部工程款已結清。
              </p>
            </div>
          ) : (
            <table className="document-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>工程項目</th>
                  <th>{quote ? "數量" : "實際範圍"}</th>
                  <th className="numeric">{quote ? "價格" : "單價"}</th>
                  <th className="numeric">金額</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const a = totals!.lineAmounts.find((a) => a.id === l.id);
                  return (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{l.itemSnapshot.name}</strong>
                        <small>
                          {l.position}
                          {l.style ? " · " + l.style : ""}
                        </small>
                        {l.productStyle && (
                          <span className="style-snapshot-text">
                            產品款式：{l.productStyle.factoryName} ·{" "}
                            {l.productStyle.seriesName} ·{" "}
                            {l.productStyle.productCode}
                          </span>
                        )}
                      </td>
                      <td>
                        {l.itemSnapshot.measure === "area"
                          ? `${l.length} × ${l.width} ${l.dimensionUnit}`
                          : l.itemSnapshot.measure === "length"
                            ? `${l.length} ${l.dimensionUnit}`
                            : l.itemSnapshot.measure === "fixed"
                              ? "一式"
                              : `${l.quantity} ${l.itemSnapshot.unit}`}
                        {a?.minApplied && <small>按最低收費計算</small>}
                      </td>
                      <td className="numeric">
                        {money(l.itemSnapshot.price)}
                        <small>／{l.itemSnapshot.unit}</small>
                      </td>
                      <td className="numeric">{money(a?.preDiscount || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!receipt && !municipal && (
            <div className="document-totals">
              <div>
                <span>工程小計</span>
                <strong>{money(totals!.subtotal)}</strong>
              </div>
              <div>
                <span>
                  折扣{" "}
                  {inv
                    ? discountLabel(d, inv.discountMode, inv.discountValue)
                    : discountLabel(d, v?.discountMode, v?.discountValue)}
                </span>
                <strong>−{money(totals!.subtotal - totals!.total)}</strong>
              </div>
              <div className="total">
                <span>成交總額</span>
                <strong>{money(inv?.netTotal ?? totals!.total)}</strong>
              </div>
              {inv?.paymentPlan?.map((stage) => (
                <div key={stage.installment}>
                  <span>
                    第{stage.installment}期 · {stage.label} {stage.percentage}%
                  </span>
                  <strong>{money(stage.amount)}</strong>
                </div>
              ))}
            </div>
          )}
          {quote && (
            <div className="quotation-bank">
              <div>
                <span>客戶入帳戶口</span>
                <strong>HELPFUL HOME DESIGN LIMITED</strong>
              </div>
              <div>
                <span>中國銀行</span>
                <strong>012 866 2028 1718</strong>
              </div>
              <div>
                <span>匯豐銀行</span>
                <strong>004 521 363952 838</strong>
              </div>
              <div>
                <span>富邦銀行</span>
                <strong>128 865 02105259</strong>
              </div>
            </div>
          )}
          {!receipt && !municipal && (
            <div className="document-terms">
              <h3>確認及付款</h3>
              <p>
                本報價按列明工程範圍及款式／位置計算；客戶簽署指定版本後，開單員會按成交分類確認收款計劃。
              </p>
              <p>
                此工程單經客戶確認簽署後正式生效，表示客戶同意清楚明白報價單所有維修項目內容不能減少。如客戶要求取消工程，所付之訂金將不獲退還。如需更改工程日期，請於工程前兩星期通知，否則公司將有機會收取客人港幣 $1,500 行政費用。
              </p>
              <p>
                本報價單不等同收據；收款後將另行發出收據。
              </p>
            </div>
          )}
          {quote ? (
            <div className="document-sign quotation-signature">
              <div>公司蓋印：____________________</div>
              <div>客人簽名：____________________</div>
              <div>日期：____________________</div>
            </div>
          ) : (
            !inv &&
            !municipal && (
              <div className="document-sign">
                <div>客戶簽署：________________________</div>
                <div>日期：________________________</div>
              </div>
            )
          )}
          {quote ? (
            <footer className="quotation-footer">
              <span>好幫手家居裝修設計有限公司</span>
              <span>工程報價單 · {displayNumber}</span>
            </footer>
          ) : (
            <footer>
              <strong>好幫手工程管理系統</strong>
              <span>好幫手家居裝修設計有限公司</span>
            </footer>
          )}
        </article>
      </div>
    );
  } catch (e) {
    return (
      <div className="document-page">
        <Empty
          title="沒有這份文件的查看權限"
          description={e instanceof Error ? e.message : "請返回合法來源查看。"}
          action={<Button onClick={() => nav(-1)}>返回</Button>}
        />
      </div>
    );
  }
}

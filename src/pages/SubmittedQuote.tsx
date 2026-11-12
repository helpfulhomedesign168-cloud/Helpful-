import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Printer, Upload } from "lucide-react";
import { QuoteDetail as LegacyQuoteDetail } from "./Quotes";
import {
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  UploadField,
} from "../components/ui";
import {
  getAttachmentBlob,
  saveAttachment,
  showAttachment,
  useApp,
} from "../context";
import {
  Attachment,
  DEMO_TODAY,
  INVOICE_CATEGORY_NAMES,
  InvoiceCategory,
  METHOD_NAMES,
  Payment,
  Quote,
  currentVersion,
  currentVersion as cv,
  money,
} from "../domain/types";

function AttachmentBox({
  attachment,
  label,
}: {
  attachment?: Attachment;
  label: string;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    if (!attachment) return;
    getAttachmentBlob(attachment).then((blob) => {
      if (cancelled || !blob || !blob.type.startsWith("image/")) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id]);
  if (!attachment)
    return <div className="submitted-file-empty">未上載{label}</div>;
  if (url)
    return (
      <button
        type="button"
        className="submitted-file-image"
        aria-label={`開啟 ${attachment.name}`}
        onClick={() =>
          showAttachment(attachment).catch(() => {
            /* attachment viewer handles errors */
          })
        }
      >
        <img src={url} alt={attachment.name} />
      </button>
    );
  return (
    <button
      type="button"
      className="submitted-file-card"
      onClick={() =>
        showAttachment(attachment).catch(() => {
          /* attachment viewer handles errors */
        })
      }
    >
      <FileText size={24} />
      <span>{attachment.name}</span>
    </button>
  );
}

function roleListPath(role: string) {
  return role === "finance"
    ? "/finance"
    : role === "clerk" || role === "finance_supervisor"
      ? "/submissions"
      : "/quotes";
}

export function SubmittedQuoteView({ quote }: { quote: Quote }) {
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const version = currentVersion(quote);
  const preparation = version.printPreparation;
  const pricing = engine.pricing(actor, quote.id);
  const payments = engine
    .listPayments(actor)
    .filter((payment) => payment.quoteId === quote.id);
  const audit = engine.listAudit(actor, quote.id);
  const supervisor = engine
    .listActors()
    .find((candidate) => candidate.id === preparation?.supervisorId);
  const totalPaid = payments
    .filter((payment) => payment.status !== "rejected")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const [amount, setAmount] = useState(String(Math.max(0, pricing.total - totalPaid)));
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [custody, setCustody] = useState<Payment["custody"]>("sales");
  const [paymentDate, setPaymentDate] = useState(DEMO_TODAY);
  const [proof, setProof] = useState<Attachment>();
  const [busy, setBusy] = useState(false);
  const [confirmSigned, setConfirmSigned] = useState(false);
  const [grantWarning, setGrantWarning] = useState(false);
  const [additionalOrder, setAdditionalOrder] = useState(
    Boolean(quote.isAdditionalOrder),
  );
  const [parentQuoteId, setParentQuoteId] = useState(quote.parentQuoteId ?? "");
  const [grantNumber, setGrantNumber] = useState(
    quote.grantApplicationNumber ?? "",
  );
  const [grantAmount, setGrantAmount] = useState(
    quote.grantApprovedAmount ? String(quote.grantApprovedAmount) : "",
  );
  useEffect(() => {
    setAdditionalOrder(Boolean(quote.isAdditionalOrder));
    setParentQuoteId(quote.parentQuoteId ?? "");
    setGrantNumber(quote.grantApplicationNumber ?? "");
    setGrantAmount(
      quote.grantApprovedAmount ? String(quote.grantApprovedAmount) : "",
    );
  }, [
    quote.id,
    quote.isAdditionalOrder,
    quote.parentQuoteId,
    quote.grantApplicationNumber,
    quote.grantApprovedAmount,
  ]);
  const categories = (
    quote.orderCategories?.length
      ? quote.orderCategories
      : quote.officeCategory
        ? [quote.officeCategory]
        : []
  ) as InvoiceCategory[];
  const hasGrant = categories.includes("grant-80k");
  const canEditCategories =
    !quote.archived &&
    (quote.ownerId === actor.id ||
      ["admin", "admin_staff"].includes(actor.role));
  const canEditGrant =
    !quote.archived &&
    (quote.ownerId === actor.id ||
      ["admin", "admin_staff"].includes(actor.role));
  const canSaveGrant =
    canEditGrant &&
    Boolean(grantNumber.trim()) &&
    Number(grantAmount) > 0;
  const canEditOrderMeta =
    quote.ownerId === actor.id &&
    !quote.archived &&
    !quote.invoiceId &&
    ["sales", "supervisor", "head"].includes(actor.role);
  const previousQuotes = engine
    .listQuotes(actor)
    .filter((candidate) => candidate.id !== quote.id && candidate.ownerId === quote.ownerId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const canAddPayment =
    !quote.archived &&
    !quote.invoiceId &&
    totalPaid < pricing.total &&
    ["sales", "supervisor", "head", "admin", "admin_staff"].includes(actor.role);
  const chooseProof = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setProof(await saveAttachment(file));
    } catch (error) {
      run(() => {
        throw error;
      });
    } finally {
      setBusy(false);
    }
  };
  const registerPayment = () => {
    if (!proof || Number(amount) <= 0) return;
    run(
      () =>
        engine.recordPayment(actor, quote.id, {
          amount: Number(amount),
          method,
          custody,
          date: paymentDate,
          proof,
        }),
      "付款已登記，待會計核對。",
    );
    setProof(undefined);
  };
  return (
    <>
      <PageHead
        title={quote.number}
        actions={
          <>
            <Button onClick={() => nav(roleListPath(actor.role))}>
              返回列表
            </Button>
            {canEditGrant && (
              <Button onClick={() => nav(`/quotes/${quote.id}/edit?order=1`)}>
                更改訂單
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => nav(`/documents/quote/${quote.id}`)}
            >
              <Printer size={18} /> 列印報價單
            </Button>
          </>
        }
      />
      <div className="submitted-layout">
        <aside className="submitted-summary">
          <h3>報價摘要</h3>
          <div className="submitted-summary-row">
            <span>簽署日期</span>
            <strong>{version.signature?.date ?? preparation?.date ?? "—"}</strong>
          </div>
          <div className="submitted-summary-row">
            <span>當日主管</span>
            <strong>{supervisor?.name ?? "—"}</strong>
          </div>
          <div className="submitted-summary-block">
            <span>訂單分類</span>
            <div className="submitted-chips">
              {(Object.keys(INVOICE_CATEGORY_NAMES) as InvoiceCategory[]).map(
                (category) => {
                  const active = categories.includes(category);
                  return (
                    <button
                      type="button"
                      key={category}
                      className={active ? "selected" : ""}
                      disabled={!canEditCategories}
                      onClick={() => {
                        if (category === "grant-80k" && active) {
                          setGrantWarning(true);
                          return;
                        }
                        const next = active
                          ? categories.filter((item) => item !== category)
                          : [...categories, category];
                        run(
                          () =>
                            engine.updateQuoteOrderMeta(actor, quote.id, {
                              orderCategories: next,
                            }),
                          "訂單分類已更新。",
                        );
                      }}
                    >
                      {INVOICE_CATEGORY_NAMES[category]}
                    </button>
                  );
                },
              )}
            </div>
          </div>
          <div className="submitted-summary-block">
            <span>訂單性質</span>
            <div className="submitted-order-nature">
              <label>
                <input
                  type="radio"
                  name="submitted-order-nature"
                  checked={!additionalOrder}
                  disabled={!canEditOrderMeta}
                  onChange={() => {
                    setAdditionalOrder(false);
                    setParentQuoteId("");
                    run(
                      () =>
                        engine.updateQuoteOrderMeta(actor, quote.id, {
                          isAdditionalOrder: false,
                        }),
                      "已設為新訂單。",
                    );
                  }}
                />
                新訂單
              </label>
              <label>
                <input
                  type="radio"
                  name="submitted-order-nature"
                  checked={additionalOrder}
                  disabled={!canEditOrderMeta}
                  onChange={() => setAdditionalOrder(true)}
                />
                加單
              </label>
            </div>
            {additionalOrder && (
              <select
                aria-label="原本報價單"
                value={parentQuoteId}
                disabled={!canEditOrderMeta}
                onChange={(event) => {
                  const value = event.target.value;
                  setParentQuoteId(value);
                  if (!value) return;
                  run(
                    () =>
                      engine.updateQuoteOrderMeta(actor, quote.id, {
                        isAdditionalOrder: true,
                        parentQuoteId: value,
                      }),
                    "加單資料已更新。",
                  );
                }}
              >
                <option value="">選擇原本報價單</option>
                {previousQuotes.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.number} · {cv(candidate).customer.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="submitted-totals">
            <div><span>工程小計</span><strong>{money(pricing.subtotal)}</strong></div>
            <div><span>全單折扣</span><strong>{version.discount < 1 ? `${Math.round(version.discount * 100)}折` : "原價"}</strong></div>
            <div className="grand"><span>成交金額</span><strong>{money(pricing.total)}</strong></div>
          </div>
          {hasGrant && (
            <div className="submitted-grant">
              <h4>批核結果</h4>
              <Field label="資助申請編號">
                <input
                  aria-label="資助申請編號"
                  value={grantNumber}
                  disabled={!canEditGrant}
                  onChange={(event) => setGrantNumber(event.target.value)}
                />
              </Field>
              <Field label="政府批核金額（HKD）">
                <input
                  aria-label="政府批核金額"
                  type="number"
                  min=".01"
                  value={grantAmount}
                  disabled={!canEditGrant}
                  onChange={(event) => setGrantAmount(event.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                disabled={!canSaveGrant}
                onClick={() =>
                  run(
                    () =>
                      engine.recordGrantApproval(actor, quote.id, {
                        applicationNumber: grantNumber,
                        approvedAmount: Number(grantAmount),
                      }),
                    "8萬資助批核結果已儲存。",
                  )
                }
              >
                儲存
              </Button>
            </div>
          )}
        </aside>
        <div className="submitted-document">
          <iframe title="正式報價單" src={`/documents/quote/${quote.id}`} />
        </div>
      </div>
      <section className="submitted-card">
        <div className="submitted-card-head">
          <h3>1. 客戶簽署</h3>
          {version.signature && (
            <span className="submitted-complete">✓ 已完成</span>
          )}
        </div>
        <div className="submitted-sign-grid">
          <div>
            <p>客戶姓名：<strong>{version.customer.name}</strong></p>
            <p>聯絡電話：<strong>{version.customer.phone}</strong></p>
            <p>客戶地址：<strong>{version.customer.address}</strong></p>
            <p>簽署日期：<strong>{version.signature?.date ?? preparation?.date ?? "—"}</strong></p>
            <p>當日主管：<strong>{supervisor?.name ?? "—"}</strong></p>
          </div>
          {version.signedDocument ? (
            <AttachmentBox
              attachment={version.signedDocument}
              label="已簽文件"
            />
          ) : (
            <UploadField
              label="上載已簽文件"
              onSave={(attachment) =>
                engine.uploadDocument(actor, quote.id, attachment)
              }
            />
          )}
        </div>
        {!version.signature && (
          <>
            {quote.orderRevision && (
              <p className="submitted-resign-note">
                由於報價單已修改，要重新列印、簽署及上載。
              </p>
            )}
            <label className="submitted-confirm-sign">
              <input
                type="checkbox"
                checked={confirmSigned}
                onChange={(event) => setConfirmSigned(event.target.checked)}
              />
              我確認客戶已簽署上述正式報價版本
            </label>
            <div className="submitted-sign-action">
              <Button
                variant="primary"
                disabled={!version.signedDocument || !confirmSigned}
                onClick={() =>
                  run(
                    () =>
                      engine.recordSignature(actor, quote.id, {
                        date: preparation?.date ?? DEMO_TODAY,
                        supervisorId: preparation?.supervisorId ?? "",
                        confirmed: confirmSigned,
                      }),
                    "客戶簽署已重新確認。",
                  )
                }
              >
                確認客戶已簽
              </Button>
            </div>
          </>
        )}
      </section>
      {payments.map((payment, index) => (
        <section className="submitted-card" key={payment.id}>
          <div className="submitted-card-head">
            <h3>{index + 2}. 第{index + 1}期付款</h3>
            <span className="submitted-complete">✓ 已完成</span>
          </div>
          <div className="submitted-payment-grid">
            <div><span>付款金額（HKD）</span><strong>{money(payment.amount)}</strong></div>
            <div><span>付款方式</span><strong>{METHOD_NAMES[payment.method]}</strong></div>
            <div><span>收款／保管位置</span><strong>{payment.custody === "sales" ? "Sales保管" : "公司"}</strong></div>
            <div><span>收款日期</span><strong>{payment.date}</strong></div>
            <AttachmentBox attachment={payment.proof} label="付款記錄" />
          </div>
        </section>
      ))}
      {canAddPayment && (
        <section className="submitted-card">
          <div className="submitted-card-head">
            <h3>{payments.length + 2}. 第{payments.length + 1}期付款</h3>
          </div>
          <div className="submitted-payment-form">
            <Field label="付款金額（HKD）" required>
              <input type="number" min=".01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
            <Field label="付款方式" required>
              <select value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])}>
                {Object.entries(METHOD_NAMES).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="收款／保管位置">
              <select value={custody} onChange={(event) => setCustody(event.target.value as Payment["custody"])}>
                <option value="sales">Sales保管</option>
                <option value="company">公司</option>
              </select>
            </Field>
            <Field label="收款日期" required>
              <input type="date" max={DEMO_TODAY} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </Field>
            <label className="submitted-upload">
              <Upload size={20} />
              <span>{proof?.name ?? (busy ? "上載中…" : "上載付款記錄")}</span>
              <input
                type="file"
                accept="image/*,.pdf"
                aria-label="上載付款記錄"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void chooseProof(file);
                }}
              />
            </label>
          </div>
          <div className="submitted-payment-action">
            <Button
              variant="primary"
              disabled={!proof || Number(amount) <= 0 || busy}
              onClick={registerPayment}
            >
              確認客戶付款
            </Button>
          </div>
        </section>
      )}
      <section className="submitted-card">
        <h3>處理紀錄</h3>
        <div className="submitted-audit">
          {audit.slice(-8).reverse().map((event) => (
            <div key={event.id}>
              <strong>{event.action}</strong>
              <span>{event.detail}</span>
              <small>
                {engine.listActors().find((candidate) => candidate.id === event.actorId)?.name ?? event.actorId}
                {" · "}
                {event.at.slice(0, 16).replace("T", " ")}
              </small>
            </div>
          ))}
          {audit.length === 0 && <p>未有處理紀錄。</p>}
        </div>
      </section>
      {grantWarning && (
        <Dialog
          title="不能移除 8萬資助"
          onClose={() => setGrantWarning(false)}
        >
          <p className="dialog-intro">
            此訂單已包含 8萬資助，不能移除。其他分類仍可更改。
          </p>
          <div className="dialog-actions">
            <Button variant="primary" onClick={() => setGrantWarning(false)}>
              確定
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function QuoteView() {
  const { id = "" } = useParams();
  const { actor, engine } = useApp();
  let quote: Quote | undefined;
  try {
    quote = engine.getQuote(actor, id);
  } catch {}
  if (!quote)
    return (
      <Empty
        title="沒有這張報價的查看權限"
        action={<Button onClick={() => history.back()}>返回</Button>}
      />
    );
  if (quote.submission) return <SubmittedQuoteView quote={quote} />;
  return <LegacyQuoteDetail />;
}


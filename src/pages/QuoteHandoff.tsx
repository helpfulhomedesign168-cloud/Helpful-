import React, { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Check,
  FileCheck2,
  Printer,
  Send,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  Field,
  PageHead,
  UploadField,
} from "../components/ui";
import { useApp, saveAttachment } from "../context";
import {
  Attachment,
  DEMO_TODAY,
  INVOICE_CATEGORY_NAMES,
  InvoiceCategory,
  METHOD_NAMES,
  money,
  Payment,
  currentVersion,
} from "../domain/types";
import { QuoteWizardProgress } from "./Quotes";

function paymentMethodOptions() {
  return Object.entries(METHOD_NAMES).map(([value, label]) => ({ value, label }));
}

export function QuoteHandoff() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  let quote: ReturnType<typeof engine.getQuote> | undefined;
  try {
    quote = engine.getQuote(actor, id);
  } catch {}
  if (!quote)
    return (
      <Empty
        title="沒有這張報價的查看權限"
        action={<Button onClick={() => nav("/quotes")}>返回報價管理</Button>}
      />
    );
  const version = currentVersion(quote);
  const preparation = version.printPreparation;
  const signature = version.signature;
  const [step, setStep] = useState(
    searchParams.get("step") === "4" || signature ? 4 : 3,
  );
  const [printDate, setPrintDate] = useState(preparation?.date ?? DEMO_TODAY);
  const [supervisorId, setSupervisorId] = useState(
    preparation?.supervisorId ?? "",
  );
  const [confirmSigned, setConfirmSigned] = useState(false);
  const [additionalOrder, setAdditionalOrder] = useState(
    Boolean(quote.isAdditionalOrder),
  );
  const [parentQuoteId, setParentQuoteId] = useState(
    quote.parentQuoteId ?? "",
  );
  const [amount, setAmount] = useState("1500");
  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [custody, setCustody] = useState<Payment["custody"]>("sales");
  const [paymentDate, setPaymentDate] = useState(DEMO_TODAY);
  const [proof, setProof] = useState<Attachment | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (signature) setStep(4);
  }, [signature?.createdAt]);
  const supervisors = engine
    .listActors()
    .filter(
      (candidate) =>
        candidate.role === "head" ||
        (candidate.role === "supervisor" && candidate.team === quote.team),
    );
  let payments: Payment[] = [];
  try {
    payments = engine
      .listPayments(actor)
      .filter((payment) => payment.quoteId === quote!.id);
  } catch {}
  const ownPreviousQuotes = engine
    .listQuotes(actor)
    .filter(
      (candidate) =>
        candidate.ownerId === quote!.ownerId && candidate.id !== quote!.id,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sameCustomerPrevious = ownPreviousQuotes.find((candidate) => {
    const customer = currentVersion(candidate).customer;
    return (
      (version.customer.id && customer.id === version.customer.id) ||
      (version.customer.phone &&
        customer.phone.replace(/\s+/g, "") ===
          version.customer.phone.replace(/\s+/g, ""))
    );
  });
  useEffect(() => {
    if (
      !quote.isAdditionalOrder &&
      !preparation &&
      !quote.submission &&
      sameCustomerPrevious
    ) {
      setAdditionalOrder(true);
      setParentQuoteId(sameCustomerPrevious.id);
    }
    // Only default once for this quote/customer pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id, sameCustomerPrevious?.id]);
  const canEdit =
    quote.ownerId === actor.id ||
    actor.role === "admin" ||
    actor.role === "admin_staff";
  const signedDocument = version.signedDocument;
  const paymentDone = payments.length > 0;
  const canSubmit = Boolean(signature) && paymentDone && !quote.submission;
  const canPreview =
    Boolean(printDate && supervisorId) &&
    Boolean(quote.orderCategories?.length) &&
    (!additionalOrder || Boolean(parentQuoteId));
  const prepare = () => {
    if (!canPreview) return;
    if (
      additionalOrder &&
      parentQuoteId &&
      quote.parentQuoteId !== parentQuoteId
    ) {
      run(
        () =>
          engine.updateQuoteOrderMeta(actor, quote!.id, {
            isAdditionalOrder: true,
            parentQuoteId,
          }),
        "加單資料已更新。",
      );
    }
    const prepared = run(
      () =>
        engine.prepareQuoteForPrint(actor, quote!.id, {
          date: printDate,
          supervisorId,
        }),
      "已生成正式報價號，可以預覽報價單。",
    );
    if (prepared) {
      setSupervisorId(
        currentVersion(prepared).printPreparation?.supervisorId ??
          supervisorId,
      );
    }
  };
  const archive = () => {
    if (
      !window.confirm(
        "封存後此報價不會再出現在日常待辦，確定封存？",
      )
    )
      return;
    run(
      () =>
        engine.archiveQuote(actor, quote!.id, {
          reason: "customer_rejected",
          note: "從報價簽署頁封存",
        }),
      "報價已封存。",
    );
    nav("/quotes?tab=archived");
  };
  const savePayment = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const attachment = await saveAttachment(file);
      setProof(attachment);
    } catch (error) {
      run(() => {
        throw error;
      });
    } finally {
      setBusy(false);
    }
  };
  const recordPayment = () => {
    if (!amount || Number(amount) <= 0) return;
    run(
      () =>
        engine.recordPayment(actor, quote!.id, {
          amount: Number(amount),
          method,
          custody,
          date: paymentDate,
          proof,
        }),
      "客戶付款已登記。",
    );
  };
  const currentStep = quote.submission ? 4 : step;
  return (
    <>
      <PageHead
        title="建立報價"
        actions={
          <>
            <Button
              onClick={() =>
                currentStep === 4
                  ? setStep(3)
                  : nav(`/quotes/${id}/edit?step=2`)
              }
            >
              <ArrowLeft size={18} /> 返回
            </Button>
            {currentStep === 4 ? (
              <Button
                onClick={() => {
                  run(
                    () => engine.markDraftStep(actor, id, 4),
                    "報價已標記為待提交。",
                  );
                  nav("/quotes?tab=pending");
                }}
              >
                待提交
              </Button>
            ) : (
              <Button onClick={() => nav(`/quotes/${id}`)}>報價詳情</Button>
            )}
          </>
        }
      />
      <QuoteWizardProgress step={currentStep} />
      {currentStep === 3 && (
        <>
          <h2 className="quote-step-title">3. 列印簽署</h2>
          <div className="handoff-actions">
            <Button
              variant="primary"
              disabled={!preparation}
              onClick={() => nav(`/documents/quote/${id}`)}
            >
              <Printer size={18} /> 列印報價單
            </Button>
            <Button onClick={() => nav(`/quotes/${id}/edit`)}>修改報價</Button>
            <Button
              onClick={() => {
                run(
                  () => engine.markDraftStep(actor, id, 3),
                  "草稿已儲存。",
                );
                nav("/quotes?tab=draft");
              }}
            >
              儲為草稿
            </Button>
            <Button variant="danger" onClick={archive}>
              封存
            </Button>
          </div>
          <div className="handoff-print-grid">
            <div className="handoff-print-settings">
              <h3>報價摘要</h3>
              <Field label="簽署日期" required>
                <input
                  type="date"
                  max={DEMO_TODAY}
                  value={printDate}
                  disabled={Boolean(preparation)}
                  onChange={(event) => setPrintDate(event.target.value)}
                />
              </Field>
              <Field label="當日主管" required>
                <select
                  value={supervisorId}
                  disabled={Boolean(preparation)}
                  onChange={(event) => setSupervisorId(event.target.value)}
                >
                  <option value="">選擇當日主管</option>
                  {supervisors.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="handoff-category-block">
                <strong>訂單分類</strong>
                <div className="order-category-chips">
                  {(Object.keys(INVOICE_CATEGORY_NAMES) as InvoiceCategory[]).map(
                    (category) => {
                      const active = (quote.orderCategories ?? []).includes(category);
                      return (
                        <button
                          type="button"
                          key={category}
                          className={active ? "selected" : ""}
                          disabled={Boolean(preparation) || !canEdit}
                          onClick={() => {
                            const current = quote.orderCategories ?? [];
                            const next = active
                              ? current.filter((item) => item !== category)
                              : [...current, category];
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
              <div className="handoff-nature">
                <strong>訂單性質</strong>
                <label>
                  <input
                    type="radio"
                    name="order-nature"
                    checked={!additionalOrder}
                    disabled={Boolean(preparation) || !canEdit}
                    onChange={() => {
                      setAdditionalOrder(false);
                      setParentQuoteId("");
                      run(
                        () =>
                          engine.updateQuoteOrderMeta(actor, quote!.id, {
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
                    name="order-nature"
                    checked={additionalOrder}
                    disabled={Boolean(preparation) || !canEdit}
                    onChange={() => {
                      setAdditionalOrder(true);
                      if (sameCustomerPrevious) {
                        setParentQuoteId(sameCustomerPrevious.id);
                        run(
                          () =>
                            engine.updateQuoteOrderMeta(actor, quote!.id, {
                              isAdditionalOrder: true,
                              parentQuoteId: sameCustomerPrevious.id,
                            }),
                          `已自動配對同客戶舊報價 ${sameCustomerPrevious.number}。`,
                        );
                      }
                    }}
                  />
                  加單
                </label>
                {additionalOrder && (
                  <select
                    aria-label="原本報價單"
                    value={parentQuoteId}
                    disabled={Boolean(preparation) || !canEdit}
                    onChange={(event) => {
                      const value = event.target.value;
                      setParentQuoteId(value);
                      if (!value) return;
                      run(
                        () =>
                          engine.updateQuoteOrderMeta(actor, quote!.id, {
                            isAdditionalOrder: true,
                            parentQuoteId: value,
                          }),
                        "加單資料已更新。",
                      );
                    }}
                  >
                    <option value="">選擇自己之前的報價單</option>
                    {ownPreviousQuotes.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.number} ·{" "}
                        {currentVersion(candidate).customer.name} ·{" "}
                        {candidate.createdAt.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {preparation && (
                <div className="handoff-prepared">
                  <span>正式報價號</span>
                  <strong>{preparation.quoteNumber}</strong>
                  <span>列印日期</span>
                  <strong>{preparation.date}</strong>
                  <span>當日主管</span>
                  <strong>
                    {engine
                      .listActors()
                      .find((candidate) => candidate.id === preparation.supervisorId)
                      ?.name}
                  </strong>
                </div>
              )}
              <p className="handoff-note">
                請列印此版本交客人簽署，回來上載同一份已簽紙本。
              </p>
              <Button
                className="full-width"
                variant="primary"
                disabled={!canPreview}
                onClick={() => {
                  if (preparation) {
                    nav(`/documents/quote/${id}`);
                  } else {
                    prepare();
                  }
                }}
              >
                預覽報價單
              </Button>
            </div>
            <div className="handoff-quote-preview">
              {preparation ? (
                <iframe
                  key={preparation.quoteNumber}
                  title="報價單預覽"
                  src={`/documents/quote/${id}`}
                />
              ) : (
                <div className="handoff-preview-placeholder">
                  <Printer size={28} />
                  <strong>先準備列印，才顯示正式報價單</strong>
                  <p>選擇簽署日期及當日主管，系統會產生正式報價號。</p>
                </div>
              )}
            </div>
          </div>
          <div className="quote-wizard-footer">
            <Button onClick={() => nav(`/quotes/${id}/edit`)}>上一步</Button>
            <Button
              variant="primary"
              disabled={!preparation}
              onClick={() => setStep(4)}
            >
              下一步
            </Button>
          </div>
        </>
      )}
      {currentStep === 4 && (
        <>
          <h2 className="quote-step-title">4. 遞交office</h2>
          <div className="handoff-quote-number">
            報價單號碼：<strong>{preparation?.quoteNumber ?? quote.number}</strong>
          </div>
          <div className="handoff-card">
            <div className="handoff-card-head">
              <h3>1. 客戶簽署</h3>
              {signature && <span className="handoff-done">✓ 已完成</span>}
            </div>
            <div className="handoff-sign-grid">
              <div>
                <p>客戶姓名：<strong>{version.customer.name}</strong></p>
                <p>聯絡電話：<strong>{version.customer.phone}</strong></p>
                <p>客戶地址：<strong>{version.customer.address}</strong></p>
                <p>簽署日期：<strong>{preparation?.date ?? "—"}</strong></p>
                <p>當日主管：<strong>{engine.listActors().find((candidate) => candidate.id === preparation?.supervisorId)?.name ?? "—"}</strong></p>
              </div>
              {signedDocument ? (
                <button
                  type="button"
                  className="handoff-signed-file"
                  onClick={() => nav(`/documents/quote/${id}`)}
                >
                  <FileCheck2 size={22} />
                  {signedDocument.name}
                </button>
              ) : (
                <div className="handoff-upload-box">
                  <UploadField
                    label="上載已簽文件"
                    onSave={(attachment) =>
                      engine.uploadDocument(actor, quote.id, attachment)
                    }
                  />
                </div>
              )}
            </div>
            {!signature && (
              <>
                <label className="handoff-confirm-check">
                  <input
                    type="checkbox"
                    checked={confirmSigned}
                    onChange={(event) => setConfirmSigned(event.target.checked)}
                  />
                  我確認客戶已簽署上述正式報價版本
                </label>
                <div className="handoff-card-action">
                  <Button
                    variant="primary"
                    disabled={!signedDocument || !confirmSigned}
                    onClick={() =>
                      run(
                        () =>
                          engine.recordSignature(actor, quote.id, {
                            date: preparation?.date ?? printDate,
                            supervisorId:
                              preparation?.supervisorId ?? supervisorId,
                            confirmed: confirmSigned,
                          }),
                        "指定版本的客戶簽署已確認。",
                      )
                    }
                  >
                    確認客戶已簽
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="handoff-card">
            <div className="handoff-card-head">
              <h3>2. 登記客戶付款</h3>
              {paymentDone && <span className="handoff-done">✓ 已完成</span>}
            </div>
            <div className="handoff-payment-layout">
                  <div className="handoff-payment-grid">
                    <Field label="付款金額（HKD）" required>
                      <input
                        type="number"
                        min=".01"
                        value={amount}
                        disabled={paymentDone}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </Field>
                    <Field label="付款方式" required>
                      <select
                        value={method}
                        disabled={paymentDone}
                        onChange={(event) =>
                          setMethod(event.target.value as Payment["method"])
                        }
                      >
                        {paymentMethodOptions().map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="收款／保管位置">
                      <select
                        value={custody}
                        disabled={paymentDone}
                        onChange={(event) =>
                          setCustody(event.target.value as Payment["custody"])
                        }
                      >
                        <option value="sales">Sales保管</option>
                        <option value="company">公司戶口／公司</option>
                      </select>
                    </Field>
                    <Field label="收款日期" required>
                      <input
                        type="date"
                        max={DEMO_TODAY}
                        value={paymentDate}
                        disabled={paymentDone}
                        onChange={(event) => setPaymentDate(event.target.value)}
                      />
                    </Field>
                  </div>
                  <label className={`handoff-payment-proof ${paymentDone ? "completed" : ""}`}>
                    <Upload size={22} />
                    <span>
                      {proof?.name ?? (busy ? "上載中…" : "上載付款記錄")}
                    </span>
                    {!proof && <small>支援圖片或 PDF</small>}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      aria-label="上載付款記錄"
                      disabled={paymentDone}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        void savePayment(file);
                      }}
                    />
                  </label>
                </div>
                {!paymentDone && (
                  <div className="handoff-card-action">
                    <Button
                      variant="primary"
                      disabled={!signature || !proof || Number(amount) <= 0 || busy}
                      onClick={recordPayment}
                    >
                      確認客戶付款
                    </Button>
                  </div>
                )}
          </div>
          <div className="handoff-card handoff-office-card">
            <div className="handoff-card-head">
              <h3>3. 交Office跟進</h3>
              {quote.submission && <span className="handoff-done">✓ 已完成</span>}
            </div>
            {!quote.submission && (
              <div className="handoff-card-action">
                <Button
                  variant="primary"
                  disabled={!canSubmit}
                  onClick={() =>
                    run(
                      () => engine.submitOffice(actor, quote.id),
                      "已交Office；開單、會計及CS將按同一來源跟進。",
                    )
                  }
                >
                  提交Office
                </Button>
              </div>
            )}
            {quote.submission && (
              <p className="handoff-note">已提交 Office，報價流程已完成。</p>
            )}
          </div>
          <div className="quote-wizard-footer">
            <Button onClick={() => nav("/quotes")}>回主頁</Button>
            <Button onClick={() => nav(`/quotes/${id}`)}>查看報價</Button>
          </div>
        </>
      )}
    </>
  );
}

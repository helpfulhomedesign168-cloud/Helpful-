import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Empty,
  Field,
  PageHead,
  Pagination,
  UploadField,
  usePagination,
} from "../components/ui";
import { useApp } from "../context";
import { Attachment, money } from "../domain/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "待會計處理",
  awaiting_credit_note: "待客人簽 Credit Note",
  awaiting_transfer: "待轉帳",
  completed: "已完成退款",
};

export function CancellationCases() {
  const { actor, engine } = useApp();
  const cases = engine.listCancellationCases(actor);
  const pager = usePagination(cases, "cancellations");
  return (
    <>
      <PageHead
        eyebrow="會計 · 退訂管理"
        title="退訂／退款"
      />
      <div className="list-panel cancellation-list">
        {cases.length === 0 ? (
          <Empty title="暫時沒有退訂個案" />
        ) : (
          <>
            <div className="table-scroll">
              <table className="cancellation-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>客戶</th>
                    <th>Sales</th>
                    <th>退訂原因</th>
                    <th className="numeric">已收款</th>
                    <th className="numeric">退款</th>
                    <th>狀態</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pager.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.invoiceNumber}</strong>
                        <small>{item.createdAt.slice(0, 10)}</small>
                      </td>
                      <td>{item.customerName}</td>
                      <td>{item.salesName}</td>
                      <td className="cancellation-reason">{item.reason}</td>
                      <td className="numeric">{money(item.paid)}</td>
                      <td className="numeric">
                        {item.refundAmount ? money(item.refundAmount) : "—"}
                      </td>
                      <td>
                        <Badge strong={item.status === "completed"}>
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td>
                        <Link to={`/cancellation-cases/${item.id}`}>查看</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={pager.page}
              pages={pager.pages}
              total={pager.total}
              onChange={pager.setPage}
            />
          </>
        )}
      </div>
    </>
  );
}

export function CancellationCaseDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  let caseItem;
  try {
    caseItem = engine.getCancellationCase(actor, id);
  } catch {
    return (
      <Empty
        title="找不到退訂個案"
        action={
          <Button onClick={() => nav("/cancellation-cases")}>
            返回退訂列表
          </Button>
        }
      />
    );
  }
  const canEdit =
    ["finance", "admin"].includes(actor.role) &&
    caseItem.status !== "completed";
  const [refundAmount, setRefundAmount] = useState(
    caseItem.refundAmount ? String(caseItem.refundAmount) : "",
  );
  const [deductions, setDeductions] = useState(
    caseItem.deductions ? String(caseItem.deductions) : "",
  );
  const [refundReason, setRefundReason] = useState(
    caseItem.refundReason ?? "",
  );
  const [bankName, setBankName] = useState(caseItem.bankName ?? "");
  const [bankAccountName, setBankAccountName] = useState(
    caseItem.bankAccountName ?? "",
  );
  const [bankAccountNumber, setBankAccountNumber] = useState(
    caseItem.bankAccountNumber ?? "",
  );
  const [transferReference, setTransferReference] = useState(
    caseItem.transferReference ?? "",
  );
  const [creditNote, setCreditNote] = useState<Attachment | undefined>(
    caseItem.creditNote,
  );
  const [signedCreditNote, setSignedCreditNote] = useState<
    Attachment | undefined
  >(caseItem.signedCreditNote);
  const [transferProof, setTransferProof] = useState<Attachment | undefined>(
    caseItem.transferProof,
  );
  const input = {
    refundAmount: Number(refundAmount || 0),
    deductions: Number(deductions || 0),
    refundReason,
    bankName,
    bankAccountName,
    bankAccountNumber,
    transferReference,
    creditNote,
    signedCreditNote,
    transferProof,
  };
  const readyToTransfer =
    Boolean(creditNote) &&
    Boolean(signedCreditNote) &&
    Boolean(transferProof) &&
    Number(refundAmount) > 0 &&
    Boolean(bankName) &&
    Boolean(bankAccountName) &&
    Boolean(bankAccountNumber);
  return (
    <>
      <PageHead
        eyebrow={`${caseItem.invoiceNumber} · ${caseItem.customerName}`}
        title="退訂個案"
        actions={
          <Button onClick={() => nav("/cancellation-cases")}>
            返回退訂列表
          </Button>
        }
      />
      <div className="cancellation-summary">
        <div>
          <span>已核有效收款</span>
          <strong>{money(caseItem.paid)}</strong>
        </div>
        <div>
          <span>50% 門檻</span>
          <strong>{money(caseItem.threshold)}</strong>
        </div>
        <div>
          <span>狀態</span>
          <strong>{STATUS_LABELS[caseItem.status]}</strong>
        </div>
        <div>
          <span>退款方式</span>
          <strong>銀行轉帳</strong>
        </div>
      </div>
      <div className="cancellation-layout">
        <div className="cancellation-main">
          <section className="list-panel cancellation-section">
            <h2>退訂資料</h2>
            <Field label="退訂原因">
              <textarea value={caseItem.reason} readOnly />
            </Field>
            <div className="form-grid two">
              <Field label="退款金額">
                <input
                  type="number"
                  min="0"
                  max={caseItem.paid}
                  step="0.01"
                  aria-label="退款金額"
                  value={refundAmount}
                  disabled={!canEdit}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </Field>
              <Field label="扣減金額">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label="扣減金額"
                  value={deductions}
                  disabled={!canEdit}
                  onChange={(event) => setDeductions(event.target.value)}
                />
              </Field>
            </div>
            <Field label="退款原因／扣減說明">
              <textarea
                aria-label="退款原因"
                value={refundReason}
                disabled={!canEdit}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="例如：合約訂明沒收訂金、行政費"
              />
            </Field>
            <div className="form-grid two">
              <Field label="銀行名稱">
                <input
                  aria-label="銀行名稱"
                  value={bankName}
                  disabled={!canEdit}
                  onChange={(event) => setBankName(event.target.value)}
                />
              </Field>
              <Field label="戶名">
                <input
                  aria-label="退款戶名"
                  value={bankAccountName}
                  disabled={!canEdit}
                  onChange={(event) => setBankAccountName(event.target.value)}
                />
              </Field>
              <Field label="戶口號碼">
                <input
                  aria-label="退款戶口號碼"
                  value={bankAccountNumber}
                  disabled={!canEdit}
                  onChange={(event) => setBankAccountNumber(event.target.value)}
                />
              </Field>
              <Field label="轉帳參考">
                <input
                  aria-label="轉帳參考"
                  value={transferReference}
                  disabled={!canEdit}
                  onChange={(event) => setTransferReference(event.target.value)}
                />
              </Field>
            </div>
          </section>
          <section className="list-panel cancellation-section">
            <h2>文件</h2>
            <div className="form-grid two">
              <Field label="Credit Note">
                <UploadField
                  attachment={creditNote}
                  label="上載 Credit Note"
                  onSave={setCreditNote}
                  onClear={() => setCreditNote(undefined)}
                />
              </Field>
              <Field label="客人已簽 Credit Note">
                <UploadField
                  attachment={signedCreditNote}
                  label="上載已簽 Credit Note"
                  onSave={setSignedCreditNote}
                  onClear={() => setSignedCreditNote(undefined)}
                />
              </Field>
              <Field label="銀行轉帳證明">
                <UploadField
                  attachment={transferProof}
                  label="上載轉帳證明"
                  onSave={setTransferProof}
                  onClear={() => setTransferProof(undefined)}
                />
              </Field>
            </div>
          </section>
          {canEdit && (
            <div className="cancellation-actions">
              <Button
                variant="primary"
                onClick={() => {
                  const saved = run(
                    () => engine.updateCancellationCase(actor, id, input),
                    "退款資料已保存。",
                  );
                  if (saved) {
                    setRefundAmount(String(saved.refundAmount ?? ""));
                    setDeductions(String(saved.deductions ?? ""));
                  }
                }}
              >
                儲存退款資料
              </Button>
              <Button
                variant="primary"
                disabled={!readyToTransfer}
                onClick={() =>
                  run(
                    () => {
                      engine.updateCancellationCase(actor, id, input);
                      return engine.completeCancellationRefund(actor, id);
                    },
                    "退款已完成。",
                  )
                }
              >
                完成銀行轉帳退款
              </Button>
            </div>
          )}
        </div>
        <aside className="list-panel cancellation-side">
          <h2>佣金扣回</h2>
          {caseItem.commissionReversals.length === 0 ? (
            <p>退款完成後會自動計算並扣回該單佣金。</p>
          ) : (
            <div className="commission-reversal-list">
              {caseItem.commissionReversals.map((item) => (
                <div key={item.actorId}>
                  <span>{item.actorName}</span>
                  <strong>−{money(item.amount)}</strong>
                </div>
              ))}
              <div className="commission-reversal-total">
                <span>合計</span>
                <strong>
                  −
                  {money(
                    caseItem.commissionReversals.reduce(
                      (sum, item) => sum + item.amount,
                      0,
                    ),
                  )}
                </strong>
              </div>
            </div>
          )}
          <p className="cancellation-side-note">
            原 Invoice、付款及收據會保留；退款完成後 Invoice 會標記為已退訂。
          </p>
        </aside>
      </div>
    </>
  );
}

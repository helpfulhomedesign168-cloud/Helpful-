import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Eye,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { useApp } from "../context";
import {
  Button,
  Empty,
  Field,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { MunicipalOrderLine, money } from "../domain/types";

export function MunicipalOrders() {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const [monthFilter, setMonthFilter] = useState("all");
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">(
    "newest",
  );
  const orders = engine.listMunicipalOrders(actor);
  const months = [
    ...new Set(orders.map((order) => order.createdAt.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const shown = orders
    .filter(
      (order) =>
        monthFilter === "all" ||
        order.createdAt.startsWith(monthFilter),
    )
    .sort((a, b) =>
      dateOrder === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
  const pager = usePagination(
    shown,
    `${monthFilter}|${dateOrder}`,
  );
  return (
    <>
      <PageHead title="市政單" />
      <div className="list-panel">
        <div className="municipal-toolbar">
          <span>共 {shown.length} 張市政單</span>
          <div className="submission-filters">
            <select
              aria-label="市政單月份"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="all">全部月份</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month.replace("-", "年")}月
                </option>
              ))}
            </select>
            <select
              aria-label="市政單排序"
              value={dateOrder}
              onChange={(event) =>
                setDateOrder(
                  event.target.value as "newest" | "oldest",
                )
              }
            >
              <option value="newest">最新至最舊</option>
              <option value="oldest">最舊至最新</option>
            </select>
          </div>
        </div>
        {orders.length === 0 ? (
          <Empty
            title="暫無市政單"
          />
        ) : (
          <div className="table-scroll">
            <table className="municipal-table">
              <thead>
                <tr>
                  <th>市政單</th>
                  <th>正單</th>
                  <th>日期</th>
                  <th>客戶</th>
                  <th>申請編號</th>
                  <th className="numeric">批核金額</th>
                  <th className="numeric">市政單金額</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((order) => {
                  let grantApplicationNumber = "";
                  let grantApprovedAmount = 0;
                  try {
                    const quote = engine.getQuote(actor, order.quoteId);
                    grantApplicationNumber =
                      quote.grantApplicationNumber ?? "";
                    grantApprovedAmount =
                      quote.grantApprovedAmount ?? 0;
                  } catch {}
                  return (
                    <tr
                      key={order.id}
                      className="municipal-clickable-row"
                      tabIndex={0}
                      onClick={() =>
                        nav(`/municipal-orders/${order.id}`)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          nav(`/municipal-orders/${order.id}`);
                        }
                      }}
                    >
                      <td>
                        <strong>{order.number}</strong>
                      </td>
                      <td>{order.principalOrderNumber}</td>
                      <td>{order.createdAt.slice(0, 10)}</td>
                      <td>
                        <strong>{order.customer.name}</strong>
                        <small>{order.customer.district}</small>
                      </td>
                      <td>{grantApplicationNumber || "—"}</td>
                      <td className="numeric money">
                        {grantApprovedAmount
                          ? money(grantApprovedAmount)
                          : "—"}
                      </td>
                      <td className="numeric money">
                        {money(
                          order.lines.reduce(
                            (sum, line) => sum + line.amount,
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pager.total > 0 && (
          <Pagination
            page={pager.page}
            pages={pager.pages}
            total={pager.total}
            onChange={pager.setPage}
          />
        )}
      </div>
    </>
  );
}

export function MunicipalOrderDetail() {
  const { id = "" } = useParams();
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  let order;
  try {
    order = engine.getMunicipalOrder(actor, id);
  } catch {
    return (
      <Empty
        title="找不到市政單"
        action={
          <Button onClick={() => nav("/municipal-orders")}>返回市政單</Button>
        }
      />
    );
  }
  const [lines, setLines] = useState<MunicipalOrderLine[]>(
    structuredClone(order.lines),
  );
  let principal;
  try {
    principal = engine.getOrder(actor, order.principalOrderId);
  } catch {}
  useEffect(() => {
    setLines(structuredClone(order.lines));
  }, [order.id, order.updatedAt]);
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const update = (index: number, values: Partial<MunicipalOrderLine>) => {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...values } : line)),
    );
  };
  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        position: "",
        measure: "quantity",
        length: 0,
        width: 0,
        dimensionUnit: "呎",
        quantity: 1,
        unit: "項",
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };
  return (
    <>
      <PageHead
        eyebrow={`${order.principalOrderNumber} 的市政單`}
        title={order.number}
        actions={
          <>
            <Button onClick={() => nav("/municipal-orders")}>
              <ArrowLeft size={18} /> 返回市政單
            </Button>
            <Button
              onClick={() => {
                let saved = false;
                run(() => {
                  engine.updateMunicipalOrder(actor, order.id, lines);
                  saved = true;
                  return true;
                }, "市政單已保存。");
                if (saved)
                  nav("/documents/municipal/" + order.id);
              }}
            >
              <Eye size={18} /> 預覽
            </Button>
            <Button
              onClick={() => {
                let saved = false;
                run(() => {
                  engine.updateMunicipalOrder(actor, order.id, lines);
                  saved = true;
                  return true;
                }, "市政單已保存。");
                if (saved)
                  nav("/documents/municipal/" + order.id);
              }}
            >
              <Printer size={18} /> 列印
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const saved = run(
                  () => engine.updateMunicipalOrder(actor, order.id, lines),
                  "市政單已保存。",
                );
                if (saved) setLines(structuredClone(saved.lines));
              }}
            >
              <Check size={18} /> 儲存市政單
            </Button>
          </>
        }
      />
      <div className="municipal-info">
        <div>
          <span>正單</span>
          <strong>{order.principalOrderNumber}</strong>
        </div>
        <div>
          <span>客戶</span>
          <strong>{order.customer.name}</strong>
        </div>
        <div>
          <span>工程地址</span>
          <strong>{order.customer.address || "—"}</strong>
        </div>
        <div>
          <span>市政單用途</span>
          <strong>政府8萬資助申請，不作會計</strong>
        </div>
      </div>
      <div className="municipal-editor-layout">
        <div className="municipal-editor-main">
      {principal && (
        <section className="municipal-principal">
          <div className="municipal-principal-head">
            <div>
              <span className="eyebrow">正單 A</span>
              <h2>{principal.number}</h2>
            </div>
            <p>
              客戶：{principal.customer.name} · {principal.customer.phone}
              <br />
              地址：{principal.customer.address || "—"}
              <br />
              工程期：{principal.startDate} 至 {principal.endDate}
            </p>
          </div>
          <div className="table-scroll">
            <table className="municipal-principal-table">
              <thead>
                <tr>
                  <th>工程項目</th>
                  <th>位置</th>
                  <th>尺寸／數量</th>
                  <th>產品款式</th>
                </tr>
              </thead>
              <tbody>
                {principal.lines.map((line) => {
                  const dimensions =
                    line.itemSnapshot.measure === "area"
                      ? `${line.length} × ${line.width} ${line.dimensionUnit}`
                      : line.itemSnapshot.measure === "length"
                        ? `${line.length} ${line.dimensionUnit}`
                        : line.itemSnapshot.measure === "fixed"
                          ? "一式"
                          : `${line.quantity} ${line.itemSnapshot.unit}`;
                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.itemSnapshot.name}</strong>
                      </td>
                      <td>{line.position || "—"}</td>
                      <td>{dimensions}</td>
                      <td>
                        {line.productStyle
                          ? `${line.productStyle.factoryName} · ${line.productStyle.seriesName} · ${line.productStyle.productCode}`
                          : line.style || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="list-panel municipal-lines-panel">
        <div className="municipal-lines-head">
          <div>
            <strong>市政單項目</strong>
            <p>可自由調整項目名稱、數量、單價及金額，只影響市政單。</p>
          </div>
          <Button onClick={addLine}>
            <Plus size={18} /> 新增項目
          </Button>
        </div>
        <div className="municipal-line-cards">
          {lines.map((line, index) => (
            <article className="municipal-line-card" key={line.id}>
              <div className="municipal-line-title">
                <span className="municipal-line-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <input
                    className="municipal-line-name-input"
                    aria-label={`第${index + 1}項名稱`}
                    value={line.name}
                    onChange={(event) =>
                      update(index, { name: event.target.value })
                    }
                    placeholder="工程項目名稱"
                  />
                  <small>
                    {money(line.unitPrice)}／{line.unit}
                  </small>
                </div>
                <Button
                  variant="ghost"
                  aria-label={`刪除第${index + 1}項`}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={18} />
                </Button>
              </div>
              <div className="form-grid three municipal-line-fields">
                <Field label="位置">
                  <input
                    aria-label={`第${index + 1}項位置`}
                    value={line.position ?? ""}
                    onChange={(event) =>
                      update(index, { position: event.target.value })
                    }
                    placeholder="例如：廚房"
                  />
                </Field>
                {(line.measure === "area" || line.measure === "length") && (
                  <Field label="長度／呎數">
                    <input
                      className="numeric"
                      aria-label={`第${index + 1}項長度`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.length ?? 0}
                      onChange={(event) =>
                        update(index, { length: Number(event.target.value) })
                      }
                    />
                  </Field>
                )}
                {line.measure === "area" && (
                  <Field label="闊度">
                    <input
                      className="numeric"
                      aria-label={`第${index + 1}項闊度`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.width ?? 0}
                      onChange={(event) =>
                        update(index, { width: Number(event.target.value) })
                      }
                    />
                  </Field>
                )}
                {(line.measure === "area" || line.measure === "length") && (
                  <Field label="尺寸單位">
                    <select
                      aria-label={`第${index + 1}項尺寸單位`}
                      value={line.dimensionUnit ?? "呎"}
                      onChange={(event) =>
                        update(index, {
                          dimensionUnit: event.target.value as "呎" | "寸",
                        })
                      }
                    >
                      <option value="呎">呎</option>
                      <option value="寸">寸</option>
                    </select>
                  </Field>
                )}
                <Field label="數量">
                  <input
                    className="numeric"
                    aria-label={`第${index + 1}項數量`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) =>
                      update(index, { quantity: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="單位">
                  <input
                    aria-label={`第${index + 1}項單位`}
                    value={line.unit}
                    onChange={(event) =>
                      update(index, { unit: event.target.value })
                    }
                  />
                </Field>
                <Field label="單價">
                  <input
                    className="numeric"
                    aria-label={`第${index + 1}項單價`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) =>
                      update(index, { unitPrice: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="金額">
                  <input
                    className="numeric"
                    aria-label={`第${index + 1}項金額`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      update(index, { amount: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
              {line.measure &&
                line.measure !== "fixed" &&
                line.measure !== "quantity" && (
                  <p className="municipal-line-calculation">
                    {line.measure === "area"
                      ? `${line.length ?? 0} × ${line.width ?? 0} × ${line.quantity} ${line.dimensionUnit ?? "呎"}`
                      : `${line.length ?? 0} × ${line.quantity} ${line.dimensionUnit ?? "呎"}`}
                    <span>（市政單可獨立調整金額）</span>
                  </p>
                )}
              <Field label="現場要求及注意事項（選填）">
                <textarea
                  aria-label={`第${index + 1}項說明`}
                  value={line.description}
                  onChange={(event) =>
                    update(index, { description: event.target.value })
                  }
                  placeholder="例如：包運輸及安裝"
                />
              </Field>
              {line.productStyleText && (
                <p className="municipal-line-style">
                  產品款式：{line.productStyleText}
                </p>
              )}
              <div className="municipal-line-amount">
                金額 <strong>{money(line.amount)}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
        </div>
        <aside className="municipal-summary">
          <h2>市政單摘要</h2>
          <div className="municipal-summary-row">
            <span>項目數量</span>
            <strong>{lines.length} 項</strong>
          </div>
          <div className="municipal-summary-total">
            <span>市政單總額</span>
            <strong>{money(total)}</strong>
          </div>
          <p>市政單只作政府8萬資助申請，不是客戶真實成交單，亦不計入會計。</p>
          <Button
            className="full-width"
            variant="primary"
            onClick={() => {
              const saved = run(
                () => engine.updateMunicipalOrder(actor, order.id, lines),
                "市政單已保存。",
              );
              if (saved) setLines(structuredClone(saved.lines));
            }}
          >
            <Check size={18} /> 儲存市政單
          </Button>
          <Button
            className="full-width"
            onClick={() => {
              let saved = false;
              run(() => {
                engine.updateMunicipalOrder(actor, order.id, lines);
                saved = true;
                return true;
              }, "市政單已保存。");
              if (saved) nav("/documents/municipal/" + order.id);
            }}
          >
            <Eye size={18} /> 預覽
          </Button>
          <Button
            className="full-width"
            onClick={() => {
              let saved = false;
              run(() => {
                engine.updateMunicipalOrder(actor, order.id, lines);
                saved = true;
                return true;
              }, "市政單已保存。");
              if (saved) nav("/documents/municipal/" + order.id);
            }}
          >
            <Printer size={18} /> 列印
          </Button>
        </aside>
      </div>
    </>
  );
}

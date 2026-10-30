import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { useApp } from "../context";
import {
  Button,
  Empty,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { MunicipalOrderLine, money } from "../domain/types";

export function MunicipalOrders() {
  const { actor, engine } = useApp();
  const orders = engine.listMunicipalOrders(actor);
  const pager = usePagination(orders, "");
  return (
    <>
      <PageHead
        eyebrow="8萬資助"
        title="市政單"
        description="市政單由正單分拆，只作政府申請用途，不是客人真實成交單，也不計入會計。"
      />
      <div className="list-panel">
        {orders.length === 0 ? (
          <Empty
            title="暫無市政單"
            description="當8萬資助報價開立Invoice後，系統會建立正單A及市政單B。"
          />
        ) : (
          <div className="table-scroll">
            <table className="municipal-table">
              <thead>
                <tr>
                  <th>市政單</th>
                  <th>正單</th>
                  <th>客戶</th>
                  <th>Invoice</th>
                  <th className="numeric">市政單金額</th>
                  <th>建立日期</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pager.items.map((order) => {
                  let invoiceNumber = "";
                  try {
                    invoiceNumber = engine.getInvoice(actor, order.invoiceId).number;
                  } catch {}
                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.number}</strong>
                      </td>
                      <td>{order.principalOrderNumber}</td>
                      <td>
                        <strong>{order.customer.name}</strong>
                        <small>{order.customer.district}</small>
                      </td>
                      <td>{invoiceNumber || "—"}</td>
                      <td className="numeric money">
                        {money(
                          order.lines.reduce((sum, line) => sum + line.amount, 0),
                        )}
                      </td>
                      <td>{order.createdAt.slice(0, 10)}</td>
                      <td>
                        <Link
                          className="text-button"
                          to={`/municipal-orders/${order.id}`}
                        >
                          查看／修改
                        </Link>
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
        <div className="table-scroll">
          <table className="municipal-line-table">
            <thead>
              <tr>
                <th>項目名稱</th>
                <th>說明</th>
                <th className="numeric">數量</th>
                <th>單位</th>
                <th className="numeric">單價</th>
                <th className="numeric">金額</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td>
                    <input
                      aria-label={`第${index + 1}項名稱`}
                      value={line.name}
                      onChange={(event) =>
                        update(index, { name: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`第${index + 1}項說明`}
                      value={line.description}
                      onChange={(event) =>
                        update(index, { description: event.target.value })
                      }
                    />
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <input
                      aria-label={`第${index + 1}項單位`}
                      value={line.unit}
                      onChange={(event) =>
                        update(index, { unit: event.target.value })
                      }
                    />
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="municipal-total">
          <span>市政單總額（不用作正式會計）</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
    </>
  );
}

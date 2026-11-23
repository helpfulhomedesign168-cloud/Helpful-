import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "../context";
import {
  Button,
  CategoryChips,
  Dialog,
  Empty,
  Field,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import {
  Customer,
  EMPTY_CUSTOMER,
  INVOICE_CATEGORY_NAMES,
  InvoiceCategory,
  money,
} from "../domain/types";

type DraftItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  amount: string;
};

const newItem = (): DraftItem => ({
  id: crypto.randomUUID(),
  name: "",
  quantity: "1",
  unit: "項",
  amount: "",
});

export function DirectInvoices() {
  const { actor, engine, run } = useApp();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [customer, setCustomer] = useState<Customer>(
    structuredClone(EMPTY_CUSTOMER),
  );
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [category, setCategory] = useState<InvoiceCategory>("self-pay");
  const invoices = engine.listInvoices(actor);
  const shown = [...invoices].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pager = usePagination(shown, "");
  const updateItem = (id: string, values: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  const close = () => {
    setCreating(false);
    setCustomer(structuredClone(EMPTY_CUSTOMER));
    setItems([newItem()]);
    setCategory("self-pay");
  };
  const create = () => {
    const invoice = run(
      () =>
        engine.createDirectInvoice(actor, {
          customer,
          category,
          items: items.map((item) => ({
            name: item.name,
            quantity: Number(item.quantity),
            unit: item.unit,
            amount: Number(item.amount),
          })),
        }),
      "Invoice已建立。",
    );
    if (invoice) {
      close();
      nav("/invoices/" + invoice.id);
    }
  };
  return (
    <>
      <PageHead
        eyebrow="直接開單"
        title="直接開 Invoice"
        description="由開單員直接建立 Invoice，不需要先建立報價單。"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={19} /> 新增 Invoice
          </Button>
        }
      />
      <div className="list-panel">
        {shown.length === 0 ? (
          <Empty
            title="暫無 Invoice"
            description="按「新增 Invoice」直接建立第一張單。"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={19} /> 新增 Invoice
              </Button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="invoice-list-table">
              <thead>
                <tr>
                  <th>Invoice單</th>
                  <th>日期</th>
                  <th>客戶／地區</th>
                  <th>分類</th>
                  <th className="numeric">成交額</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {pager.items.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="submission-clickable-row"
                    tabIndex={0}
                    onClick={() => nav("/invoices/" + invoice.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        nav("/invoices/" + invoice.id);
                      }
                    }}
                  >
                    <td>
                      <strong>{invoice.number}</strong>
                    </td>
                    <td>{invoice.createdAt.slice(0, 10)}</td>
                    <td>
                      <strong>{invoice.customer.name}</strong>
                      <small>{invoice.customer.district || "地址待補"}</small>
                    </td>
                    <td>
                      {invoice.category ? (
                        <CategoryChips categories={[invoice.category]} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="numeric money">{money(invoice.netTotal)}</td>
                    <td>{invoice.voided ? "已退單" : "已開立"}</td>
                  </tr>
                ))}
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
      {creating && (
        <Dialog wide title="新增直接 Invoice" onClose={close}>
          <p className="dialog-intro">
            直接輸入客戶及工程項目；建立後會立即生成 Invoice，不經過報價單／簽署流程。
          </p>
          <div className="form-grid two">
            <Field label="客戶姓名" required>
              <input
                aria-label="客戶姓名"
                value={customer.name}
                onChange={(event) =>
                  setCustomer({ ...customer, name: event.target.value })
                }
              />
            </Field>
            <Field label="聯絡電話" required>
              <input
                aria-label="聯絡電話"
                value={customer.phone}
                onChange={(event) =>
                  setCustomer({ ...customer, phone: event.target.value })
                }
              />
            </Field>
            <Field label="工程地址">
              <input
                aria-label="工程地址"
                value={customer.address}
                onChange={(event) =>
                  setCustomer({ ...customer, address: event.target.value })
                }
              />
            </Field>
            <Field label="訂單分類" required>
              <select
                aria-label="訂單分類"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as InvoiceCategory)
                }
              >
                {Object.entries(INVOICE_CATEGORY_NAMES).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </Field>
          </div>
          <div className="direct-invoice-items">
            <div className="direct-invoice-items-head">
              <strong>工程項目</strong>
              <Button onClick={() => setItems([...items, newItem()])}>
                <Plus size={17} /> 新增一行
              </Button>
            </div>
            {items.map((item, index) => (
              <div className="direct-invoice-item" key={item.id}>
                <Field label={`第${index + 1}項工程`} required>
                  <input
                    aria-label={`第${index + 1}項工程`}
                    value={item.name}
                    onChange={(event) =>
                      updateItem(item.id, { name: event.target.value })
                    }
                    placeholder="例如：石屎剷落"
                  />
                </Field>
                <Field label="數量">
                  <input
                    aria-label={`第${index + 1}項數量`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, { quantity: event.target.value })
                    }
                  />
                </Field>
                <Field label="單位">
                  <input
                    aria-label={`第${index + 1}項單位`}
                    value={item.unit}
                    onChange={(event) =>
                      updateItem(item.id, { unit: event.target.value })
                    }
                  />
                </Field>
                <Field label="金額" required>
                  <input
                    aria-label={`第${index + 1}項金額`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(event) =>
                      updateItem(item.id, { amount: event.target.value })
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  aria-label={`刪除第${index + 1}項`}
                  onClick={() =>
                    setItems(items.filter((row) => row.id !== item.id))
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
          </div>
          <div className="dialog-actions">
            <Button onClick={close}>取消</Button>
            <Button
              variant="primary"
              disabled={
                !customer.name.trim() ||
                !customer.phone.trim() ||
                !items.length ||
                items.some(
                  (item) =>
                    !item.name.trim() ||
                    !Number(item.quantity) ||
                    !Number.isFinite(Number(item.amount)) ||
                    Number(item.amount) < 0,
                )
              }
              onClick={create}
            >
              建立 Invoice
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

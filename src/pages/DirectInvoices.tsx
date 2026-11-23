import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApp } from "../context";
import {
  Button,
  CategoryChips,
  Empty,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { money } from "../domain/types";

export function DirectInvoices() {
  const { actor, engine } = useApp();
  const nav = useNavigate();
  const invoices = engine.listInvoices(actor);
  const shown = [...invoices].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pager = usePagination(shown, "");
  return (
    <>
      <PageHead
        eyebrow="直接開單"
        title="直接開 Invoice"
        description="由開單員直接建立 Invoice，不需要先建立報價單。"
        actions={
          <Button
            variant="primary"
            onClick={() => nav("/quotes/new?direct=1")}
          >
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
              <Button
                variant="primary"
                onClick={() => nav("/quotes/new?direct=1")}
              >
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
    </>
  );
}

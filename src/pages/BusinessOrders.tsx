import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  CategoryChips,
  Empty,
  PageHead,
  Pagination,
  Search,
  usePagination,
} from "../components/ui";
import { useApp } from "../context";
import {
  DEMO_TODAY,
  INVOICE_CATEGORY_NAMES,
  InvoiceCategory,
  money,
} from "../domain/types";

type StatusFilter = "all" | "ongoing" | "completed" | "voided";

function monthParts(month: string) {
  return [month.slice(0, 4), month.slice(5, 7)] as const;
}

export function BusinessOrders() {
  const { actor, engine } = useApp();
  const [params] = useSearchParams();
  const initialMonth = params.get("month") || DEMO_TODAY.slice(0, 7);
  const [year, setYear] = useState(monthParts(initialMonth)[0]);
  const [month, setMonth] = useState(monthParts(initialMonth)[1]);
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const monthKey = `${year}-${month}`;
  const rows = engine.businessOrders(actor, monthKey);
  const salesOptions = engine
    .listActors()
    .filter((item) =>
      ["sales", "supervisor", "head"].includes(item.role),
    );
  const categories = Array.from(
    new Set(rows.map((row) => row.category)),
  );
  const filtered = rows.filter((row) => {
    if (
      search &&
      !`${row.invoiceNumber} ${row.orderNumber ?? ""} ${row.customerName}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    if (sales !== "all" && row.salesId !== sales) return false;
    if (category !== "all" && row.category !== category) return false;
    if (status === "voided" && !row.voided) return false;
    if (status === "completed" && (!row.completed || row.voided)) return false;
    if (status === "ongoing" && (row.completed || row.voided)) return false;
    return true;
  });
  const pager = usePagination(filtered, `${monthKey}-${status}-${search}-${sales}-${category}`);
  const sum = (values: number[]) =>
    values.reduce((total, value) => total + value, 0);
  const turnover = sum(filtered.map((row) => row.revenue));
  const expenses = sum(filtered.map((row) => row.expenses));
  const collected = sum(filtered.map((row) => row.collected));
  const categoryOf = (value: string): InvoiceCategory | undefined => {
    if (value === "自費") return "self-pay";
    if (value === "團購") return "group-buy";
    if (value === "8萬資助" || value === "8萬") return "grant-80k";
    return undefined;
  };
  const salesName = (id: string) =>
    engine.listActors().find((item) => item.id === id)?.name ?? "—";
  return (
    <>
      <PageHead title="營業單" eyebrow="會計主管 · 營業單列表" />
      <div className="list-panel business-order-panel">
        <div className="business-order-toolbar">
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜尋Invoice、工程單或客戶"
          />
          <label className="business-order-field">
            <select
              aria-label="營業單年份"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {["2024", "2025", "2026", "2027", "2028"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
          <label className="business-order-field">
            <select
              aria-label="營業單月份"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = String(index + 1).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {value} 月
                  </option>
                );
              })}
            </select>
            <ChevronDown size={18} />
          </label>
          <label className="business-order-field">
            <select
              aria-label="營業單Sales"
              value={sales}
              onChange={(event) => setSales(event.target.value)}
            >
              <option value="all">全部 Sales</option>
              {salesOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
          <label className="business-order-field">
            <select
              aria-label="營業單分類"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">全部分類</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
        </div>
        <div className="business-order-status-tabs" role="tablist">
          {(
            [
              ["all", "全部"],
              ["ongoing", "進行中"],
              ["completed", "完成單"],
              ["voided", "退單"],
            ] as Array<[StatusFilter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={status === value}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
          <span className="business-order-count">{filtered.length} 張單</span>
        </div>
        <div className="business-order-summary">
          <div>
            <span>營業額</span>
            <strong>{money(turnover)}</strong>
          </div>
          <div>
            <span>工程支出</span>
            <strong>{money(expenses)}</strong>
          </div>
          <div>
            <span>毛利</span>
            <strong>{money(turnover - expenses)}</strong>
          </div>
          <div>
            <span>已收款</span>
            <strong>{money(collected)}</strong>
          </div>
        </div>
        {filtered.length === 0 ? (
          <Empty
            title={
              status === "voided"
                ? "本月未有退單"
                : status === "completed"
                  ? "本月未有完成單"
                  : "找不到營業單"
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="accounting-job-table business-order-table">
                <thead>
                  <tr>
                    <th>Invoice／工程單</th>
                    <th>開單日期</th>
                    <th>客戶</th>
                    <th>Sales</th>
                    <th>分類</th>
                    <th className="numeric">收入</th>
                    <th className="numeric">支出</th>
                    <th className="numeric">毛利</th>
                    <th className="numeric">已收款</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.items.map((row) => (
                    <tr key={row.invoiceId}>
                      <td>
                        <Link to={`/invoices/${row.invoiceId}`}>
                          <strong>{row.invoiceNumber}</strong>
                        </Link>
                        <small>{row.orderNumber ?? "未出工程單"}</small>
                      </td>
                      <td>{row.createdAt.slice(0, 10)}</td>
                      <td>{row.customerName}</td>
                      <td>{salesName(row.salesId)}</td>
                      <td>
                        <CategoryChips
                          categories={
                            categoryOf(row.category)
                              ? [categoryOf(row.category)!]
                              : []
                          }
                        />
                      </td>
                      <td className="numeric">{money(row.revenue)}</td>
                      <td className="numeric">{money(row.expenses)}</td>
                      <td className="numeric">
                        <strong>{money(row.grossProfit)}</strong>
                        <small>{row.margin.toFixed(1)}%</small>
                      </td>
                      <td className="numeric">{money(row.collected)}</td>
                      <td>
                        <Badge strong={row.voided || row.completed}>
                          {row.voided
                            ? "退單"
                            : row.completed
                              ? "完成單"
                              : "進行中"}
                        </Badge>
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

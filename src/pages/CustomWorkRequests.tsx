import React, { useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
} from "../components/ui";
import { useApp } from "../context";
import { money } from "../domain/types";

type Filter = "pending" | "answered" | "all";

export function CustomWorkRequests() {
  const { actor, engine, run } = useApp();
  const requests = engine.listCustomWorkRequests(actor);
  const [filter, setFilter] = useState<Filter>("pending");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [catalogRequest, setCatalogRequest] = useState<string | null>(null);
  const [catalogCategory, setCatalogCategory] = useState("其他");
  const [catalogName, setCatalogName] = useState("");
  const [catalogDetails, setCatalogDetails] = useState("");
  let categories: string[] = [];
  try {
    categories = engine.listServiceCategories(actor);
  } catch {}
  const catalogItem = catalogRequest
    ? requests.find((request) => request.id === catalogRequest)
    : undefined;
  const pending = requests.filter((request) => request.status === "pending");
  const answered = requests.filter((request) => request.status === "answered");
  const visible =
    filter === "pending" ? pending : filter === "answered" ? answered : requests;
  return (
    <>
      <PageHead
        eyebrow="工程部 · 出街報價"
        title="自訂工程請示"
      />
      <div className="list-panel custom-request-panel">
        <div className="custom-request-tabs" role="tablist">
          {(
            [
              ["pending", `待回覆 ${pending.length}`],
              ["answered", `已回覆 ${answered.length}`],
              ["all", `全部 ${requests.length}`],
            ] as Array<[Filter, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <Empty
            title={
              filter === "pending"
                ? "暫時沒有待回覆的自訂工程"
                : filter === "answered"
                  ? "暫時沒有已回覆的自訂工程"
                  : "暫時沒有自訂工程請示"
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="custom-request-table">
              <thead>
                <tr>
                  <th>狀態</th>
                  <th>自訂工程</th>
                  <th>客戶／Sales</th>
                  <th>數量</th>
                  <th>要求日期</th>
                  <th className="numeric">工程部報價</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((request) => (
                  <tr
                    key={request.id}
                    className={
                      request.status === "pending" ? "request-pending" : ""
                    }
                  >
                    <td>
                      <Badge strong={request.status === "pending"}>
                        {request.status === "pending" ? "待回覆" : "已回覆"}
                      </Badge>
                    </td>
                    <td>
                      <strong>{request.description}</strong>
                      <small>{request.quoteNumber}</small>
                    </td>
                    <td>
                      {request.customerName}
                      <small>{request.salesName}</small>
                    </td>
                    <td>
                      {request.quantity} {request.unit}
                    </td>
                    <td>{request.requestedAt.slice(0, 10)}</td>
                    <td>
                      {request.status === "pending" ? (
                        <div className="request-price-entry">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label={`${request.description}工程部報價`}
                            placeholder="輸入出街價"
                            value={prices[request.id] ?? ""}
                            onChange={(event) =>
                              setPrices((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            variant="primary"
                            disabled={
                              !prices[request.id] ||
                              Number(prices[request.id]) < 0
                            }
                            onClick={() =>
                              run(
                                () =>
                                  engine.answerCustomWorkRequest(
                                    actor,
                                    request.id,
                                    Number(prices[request.id]),
                                  ),
                                "已回覆工程部報價。",
                              )
                            }
                          >
                            回覆報價
                          </Button>
                        </div>
                      ) : (
                        <div className="request-catalog-action">
                          <strong className="request-answered-price">
                            {money(request.price ?? 0)}
                          </strong>
                          {request.catalogServiceId ? (
                            <Badge>已加入價目表</Badge>
                          ) : (
                            <Button
                              onClick={() => {
                                setCatalogCategory(
                                  categories.includes("其他")
                                    ? "其他"
                                    : categories[0] ?? "其他",
                                );
                                setCatalogName(request.description);
                                setCatalogDetails("由自訂工程請示加入");
                                setCatalogRequest(request.id);
                              }}
                            >
                              加入工程價目表
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {catalogItem && (
        <Dialog
          title="加入工程價目表"
          onClose={() => setCatalogRequest(null)}
        >
          <p className="dialog-intro">
            會以工程部出街價 {money(catalogItem.price ?? 0)} 建立價目表項目。成本預設為 60%，可日後在工程價目調整。
          </p>
          <Field label="工程名稱" required>
            <input
              aria-label="價目表工程名稱"
              value={catalogName}
              onChange={(event) => setCatalogName(event.target.value)}
            />
          </Field>
          <Field label="工程詳細／內容">
            <textarea
              aria-label="價目表工程詳細"
              value={catalogDetails}
              onChange={(event) => setCatalogDetails(event.target.value)}
              placeholder="可修改工程範圍、內容或備註"
            />
          </Field>
          <Field label="工程分類" required>
            <select
              aria-label="工程分類"
              value={catalogCategory}
              onChange={(event) => setCatalogCategory(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setCatalogRequest(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const saved = run(
                  () =>
                    engine.addCustomWorkToCatalog(
                      actor,
                      catalogItem.id,
                      {
                        category: catalogCategory,
                        name: catalogName,
                        details: catalogDetails,
                      },
                    ),
                  "已加入工程價目表。",
                );
                if (saved) setCatalogRequest(null);
              }}
            >
              確認加入
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

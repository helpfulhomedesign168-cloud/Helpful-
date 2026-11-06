import React, { useState } from "react";
import { Badge, Button, Empty, PageHead } from "../components/ui";
import { useApp } from "../context";
import { money } from "../domain/types";

type Filter = "pending" | "answered" | "all";

export function CustomWorkRequests() {
  const { actor, engine, run } = useApp();
  const requests = engine.listCustomWorkRequests(actor);
  const [filter, setFilter] = useState<Filter>("pending");
  const [prices, setPrices] = useState<Record<string, string>>({});
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
                        <strong className="request-answered-price">
                          {money(request.price ?? 0)}
                        </strong>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

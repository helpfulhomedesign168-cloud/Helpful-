import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Empty,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { useApp } from "../context";
import {
  AccountingTrendPeriod,
  DEMO_TODAY,
  money,
} from "../domain/types";

export function AccountingDashboard() {
  const { actor, engine } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [period, setPeriod] = useState<AccountingTrendPeriod>("month");
  const dashboard = engine.accountingDashboard(actor, month);
  const trend = engine.accountingTrend(actor, month, period);
  const pager = usePagination(dashboard.jobs, month);
  const chartWidth = 820;
  const chartHeight = 230;
  const chartPadX = 46;
  const chartPadY = 24;
  const chartBottom = 30;
  const plotWidth = chartWidth - chartPadX * 2;
  const plotHeight = chartHeight - chartPadY - chartBottom;
  const maxValue = Math.max(
    1,
    ...trend.flatMap((point) => [
      point.revenue,
      point.expenses,
      point.grossProfit,
    ]),
  );
  const slot = plotWidth / Math.max(1, trend.length);
  const barWidth = Math.max(3, slot * 0.44);
  const xFor = (index: number) => chartPadX + slot * (index + 0.5);
  const yFor = (value: number) =>
    chartPadY + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;
  const lineFor = (key: "expenses" | "grossProfit") =>
    trend
      .map((point, index) => `${xFor(index)},${yFor(point[key])}`)
      .join(" ");
  const labelEvery = Math.max(1, Math.ceil(trend.length / 8));
  return (
    <>
      <PageHead
        eyebrow="會計主管 · 公司營運"
        title="儀表板"
        actions={
          <label className="month-picker">
            <span>統計月份</span>
            <input
              type="month"
              aria-label="統計月份"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        }
      />
      <div className="accounting-kpis">
        <div className="accounting-kpi primary">
          <span>本月營業額</span>
          <strong>{money(dashboard.turnover)}</strong>
          <small>{dashboard.jobCount} 張 Invoice</small>
        </div>
        <div className="accounting-kpi">
          <span>已收款</span>
          <strong>{money(dashboard.collected)}</strong>
          <small>有效付款</small>
        </div>
        <div className="accounting-kpi">
          <span>應收未收</span>
          <strong>{money(dashboard.outstanding)}</strong>
          <small>待收餘額</small>
        </div>
        <div className="accounting-kpi">
          <span>工程支出</span>
          <strong>{money(dashboard.expenses)}</strong>
          <small>師傅及額外工程</small>
        </div>
        <div className="accounting-kpi">
          <span>毛利</span>
          <strong>{money(dashboard.grossProfit)}</strong>
          <small>營業額 − 工程支出</small>
        </div>
        <div className="accounting-kpi">
          <span>應計Sales佣金</span>
          <strong>{money(dashboard.commissions)}</strong>
          <small>按已開單營業額計算</small>
        </div>
        <div className="accounting-kpi net">
          <span>扣除佣金後淨利</span>
          <strong>{money(dashboard.netProfit)}</strong>
          <small>{dashboard.completedJobs} 張工程已完成</small>
        </div>
      </div>

      <div className="accounting-overview-grid">
        <section className="list-panel accounting-trend">
          <div className="accounting-section-head">
            <div>
              <h2>營運趨勢</h2>
              <p>營業額、工程支出及毛利</p>
            </div>
            <div className="accounting-period-tabs" role="tablist">
              {([
                ["week", "星期"],
                ["month", "月"],
                ["year", "年"],
              ] as Array<[AccountingTrendPeriod, string]>).map(
                ([value, label]) => (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={period === value}
                    className={period === value ? "active" : ""}
                    onClick={() => setPeriod(value)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="accounting-chart-legend">
            <span><i className="revenue" />營業額</span>
            <span><i className="expenses" />工程支出</span>
            <span><i className="profit" />毛利</span>
          </div>
          <svg
            className="accounting-chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="營業額、工程支出及毛利趨勢圖"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = chartPadY + plotHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={chartPadX}
                    x2={chartWidth - chartPadX}
                    y1={y}
                    y2={y}
                    className="chart-grid"
                  />
                  <text x={4} y={y + 4} className="chart-axis">
                    {ratio === 0
                      ? "0"
                      : `${Math.round(maxValue * (1 - ratio) / 1000)}k`}
                  </text>
                </g>
              );
            })}
            {trend.map((point, index) => (
              <rect
                key={`bar-${point.label}`}
                x={xFor(index) - barWidth / 2}
                y={yFor(point.revenue)}
                width={barWidth}
                height={chartPadY + plotHeight - yFor(point.revenue)}
                rx={2}
                className="chart-revenue"
              />
            ))}
            <polyline points={lineFor("expenses")} className="chart-expenses" />
            <polyline points={lineFor("grossProfit")} className="chart-profit" />
            {trend.map((point, index) =>
              index % labelEvery === 0 ? (
                <text
                  key={`label-${point.label}`}
                  x={xFor(index)}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="chart-axis"
                >
                  {point.label}
                </text>
              ) : null,
            )}
          </svg>
          <div className="accounting-trend-total">
            毛利率：
            <strong>
              {dashboard.turnover > 0
                ? (
                    ((dashboard.turnover - dashboard.expenses) /
                      dashboard.turnover) *
                    100
                  ).toFixed(1)
                : "0.0"}
              %
            </strong>
          </div>
        </section>
        <section className="list-panel accounting-myob">
          <div className="accounting-section-head">
            <div>
              <h2>MYOB 對接</h2>
              <p>會計系統整合狀態</p>
            </div>
            <Badge>未連接</Badge>
          </div>
          <p>{dashboard.myobNote}</p>
          <div className="myob-mapping">
            <span>已預留欄位</span>
            <ul>
              <li>Invoice 收入</li>
              <li>工程支出</li>
              <li>Sales 佣金</li>
              <li>每月 Turnover</li>
            </ul>
          </div>
          <Button className="full-width" disabled>
            連接 MYOB（下一步）
          </Button>
        </section>
      </div>

      <section className="list-panel accounting-jobs">
        <div className="accounting-section-head">
          <div>
            <h2>營業單</h2>
            <p>只計已安排師傅及額外工程的實際支出；未安排工程支出暫為 HK$0。</p>
          </div>
          <Link className="btn" to={`/business-orders?month=${month}`}>
            查看全部營業單
          </Link>
        </div>
        {dashboard.jobs.length === 0 ? (
          <Empty title="本月未有 Invoice" />
        ) : (
          <div className="table-scroll">
            <table className="accounting-job-table">
              <thead>
                <tr>
                  <th>Invoice／工程單</th>
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
                {pager.items.map((job) => (
                  <tr key={job.invoiceId}>
                    <td>
                      <strong>{job.invoiceNumber}</strong>
                      <small>{job.orderNumber ?? "未出工程單"}</small>
                    </td>
                    <td>{job.customerName}</td>
                    <td>{job.salesName}</td>
                    <td>{job.category}</td>
                    <td className="numeric">{money(job.revenue)}</td>
                    <td className="numeric">{money(job.expenses)}</td>
                    <td className="numeric">
                      <strong>{money(job.grossProfit)}</strong>
                      <small>{job.margin.toFixed(1)}%</small>
                    </td>
                    <td className="numeric">{money(job.collected)}</td>
                    <td>
                      <Badge strong={job.completed}>
                        {job.completed ? "已完成工程" : "進行中"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>合計</td>
                  <td className="numeric">{money(dashboard.turnover)}</td>
                  <td className="numeric">{money(dashboard.expenses)}</td>
                  <td className="numeric">{money(dashboard.grossProfit)}</td>
                  <td className="numeric">{money(dashboard.collected)}</td>
                  <td />
                </tr>
              </tfoot>
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
      </section>

      <section className="list-panel accounting-sales">
        <div className="accounting-section-head">
          <div>
            <h2>每個 Sales 應計佣金</h2>
            <p>
              按已開單營業額及現有佣金率（8%／6%，管理佣金按Team規則）計算；實際支付佣金仍按有效付款確認。
            </p>
          </div>
        </div>
        {dashboard.sales.length === 0 ? (
          <Empty title="本月未有 Sales 佣金" />
        ) : (
          <div className="table-scroll">
            <table className="accounting-sales-table">
              <thead>
                <tr>
                  <th>Sales</th>
                  <th>角色</th>
                  <th className="numeric">已開單數</th>
                  <th className="numeric">營業額</th>
                  <th className="numeric">佣金</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.sales.map((row) => (
                  <tr key={row.actorId}>
                    <td>
                      <strong>{row.name}</strong>
                    </td>
                    <td>{row.role}</td>
                    <td className="numeric">{row.jobCount}</td>
                    <td className="numeric">{money(row.revenue)}</td>
                    <td className="numeric">
                      <strong>{money(row.commission)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>佣金合計</td>
                  <td className="numeric">{money(dashboard.commissions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

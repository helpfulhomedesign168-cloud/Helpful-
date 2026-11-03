import React, { useState } from "react";
import {
  Badge,
  Button,
  Empty,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { useApp } from "../context";
import { DEMO_TODAY, money } from "../domain/types";

export function AccountingDashboard() {
  const { actor, engine } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const dashboard = engine.accountingDashboard(actor, month);
  const pager = usePagination(dashboard.jobs, month);
  const maxMonthTurnover = Math.max(
    1,
    ...dashboard.months.map((item) => item.turnover),
  );
  return (
    <>
      <PageHead
        eyebrow="會計主管 · 公司營運"
        title="營運儀表板"
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
          <span>Sales佣金</span>
          <strong>{money(dashboard.commissions)}</strong>
          <small>本月佣金支出</small>
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
              <h2>每月 Turnover</h2>
              <p>最近 6 個月已開 Invoice 營業額。</p>
            </div>
          </div>
          <div className="accounting-bars">
            {dashboard.months.map((item) => (
              <div className="accounting-bar-row" key={item.month}>
                <span>{item.month}</span>
                <div className="accounting-bar-track">
                  <div
                    className="accounting-bar-fill"
                    style={{
                      width: `${Math.max(
                        2,
                        (item.turnover / maxMonthTurnover) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{money(item.turnover)}</strong>
              </div>
            ))}
          </div>
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
            <h2>每單工程收入及支出</h2>
            <p>只計已安排師傅及額外工程的實際支出；未安排工程支出暫為 HK$0。</p>
          </div>
          <span>{dashboard.jobs.length} 張單</span>
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
            <h2>每個 Sales 佣金</h2>
            <p>佣金按已核實付款及現有佣金規則計算。</p>
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

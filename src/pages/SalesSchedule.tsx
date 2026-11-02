import React, { useState } from "react";
import { useApp } from "../context";
import { Field, PageHead } from "../components/ui";
import {
  DEMO_TODAY,
  SALES_SHIFT_NAMES,
  SalesShiftCode,
} from "../domain/types";

const SHIFT_OPTIONS = Object.entries(SALES_SHIFT_NAMES) as Array<
  [SalesShiftCode, string]
>;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function monthDays(month: string) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, "0")}`;
    const weekday = new Date(`${date}T00:00:00`).getDay();
    return { date, day: index + 1, weekday };
  });
}

export function SalesSchedule() {
  const { actor, engine, run } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const canEdit = actor.role === "head" || actor.role === "supervisor";
  const schedule = engine.listSalesSchedule(actor, month);
  const days = monthDays(month);
  const shifts = new Map(
    schedule.shifts.map((shift) => [
      `${shift.actorId}|${shift.date}`,
      shift.shift,
    ]),
  );
  const shiftFor = (actorId: string, date: string) =>
    shifts.get(`${actorId}|${date}`);
  const updateShift = (
    actorId: string,
    date: string,
    value: string,
  ) => {
    const shift = (value || null) as SalesShiftCode | null;
    run(
      () => engine.setSalesShift(actor, actorId, date, shift),
      shift ? `排班已設為${SALES_SHIFT_NAMES[shift]}。` : "已清除排班。",
    );
  };
  return (
    <>
      <PageHead
        eyebrow={
          actor.role === "head"
            ? "全部 Team · 管理視圖"
            : actor.role === "supervisor"
              ? `Team ${actor.team} · 管理視圖`
              : "只看本人"
        }
        title={canEdit ? "Sales排班" : "我的排班"}
        actions={
          <Field label="排班月份">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value || DEMO_TODAY.slice(0, 7))}
            />
          </Field>
        }
      />
      <div className="list-panel roster-panel">
        <div className="roster-toolbar">
          <div>
            <strong>{month.replace("-", "年")}月排班</strong>
            <p>
              {canEdit
                ? "點擊更次即可即時更新；休息及年假不計上班人數。"
                : "你的排班由Sales阿頭或主管安排。"}
            </p>
          </div>
          <div className="roster-legend">
            {SHIFT_OPTIONS.map(([code, label]) => (
              <span key={code} data-shift={code}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="table-scroll roster-scroll">
          <table className="sales-roster-table">
            <thead>
              <tr>
                <th className="roster-person-head">Sales</th>
                {days.map((day) => (
                  <th
                    key={day.date}
                    className={
                      day.weekday === 0 || day.weekday === 6
                        ? "weekend"
                        : ""
                    }
                  >
                    <strong>{day.day}</strong>
                    <small>{WEEKDAYS[day.weekday]}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.members.map((member) => (
                <tr key={member.id}>
                  <th className="roster-person">
                    <strong>{member.name}</strong>
                    <small>Team {member.team ?? "—"}</small>
                  </th>
                  {days.map((day) => {
                    const shift = shiftFor(member.id, day.date);
                    return (
                      <td
                        key={day.date}
                        className={`roster-cell ${shift ? `shift-${shift}` : ""} ${
                          day.weekday === 0 || day.weekday === 6
                            ? "weekend"
                            : ""
                        }`}
                      >
                        {canEdit ? (
                          <select
                            aria-label={`${member.name} ${day.date} 排班`}
                            value={shift ?? ""}
                            onChange={(event) =>
                              updateShift(
                                member.id,
                                day.date,
                                event.target.value,
                              )
                            }
                          >
                            <option value="">—</option>
                            {SHIFT_OPTIONS.map(([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{shift ? SALES_SHIFT_NAMES[shift] : "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="roster-coverage">
                <th>上班人數</th>
                {days.map((day) => {
                  const count = schedule.members.filter((member) => {
                    const shift = shiftFor(member.id, day.date);
                    return (
                      shift &&
                      shift !== "off" &&
                      shift !== "leave"
                    );
                  }).length;
                  return (
                    <td key={day.date}>
                      {count > 0 ? count : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

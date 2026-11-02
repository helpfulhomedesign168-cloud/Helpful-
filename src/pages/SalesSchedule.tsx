import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "../context";
import {
  Badge,
  Button,
  Dialog,
  Field,
  PageHead,
} from "../components/ui";
import {
  DEMO_TODAY,
  SALES_ASSIGNMENT_NAMES,
  SALES_WORK_SHIFT_NAMES,
  SalesAssignment,
  SalesTeamLocation,
  SalesWorkShift,
} from "../domain/types";

const ASSIGNMENTS: SalesAssignment[] = ["A", "B", "C", "D", "PH"];
const TEAMS = ["A", "B", "C"] as const;
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

type LocationDraft = {
  id?: string;
  team: "A" | "B" | "C";
  startDate: string;
  endDate: string;
  location: string;
};

export function SalesSchedule() {
  const { actor, engine, run } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const canEdit = actor.role === "head" || actor.role === "supervisor";
  const schedule = engine.listSalesSchedule(actor, month);
  const days = monthDays(month);
  const shifts = new Map(
    schedule.shifts.map((shift) => [
      `${shift.actorId}|${shift.date}`,
      shift,
    ]),
  );
  const monthlyTeams = new Map(
    schedule.monthlyTeams.map((team) => [team.actorId, team.team]),
  );
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const locationFor = (team: "A" | "B" | "C", date: string) =>
    schedule.locations.find(
      (row) =>
        row.team === team && row.startDate <= date && row.endDate >= date,
    );
  const updateShift = (
    actorId: string,
    date: string,
    assignment: string,
    currentWorkShift?: SalesWorkShift,
  ) => {
    const next = (assignment || null) as SalesAssignment | null;
    run(
      () =>
        engine.setSalesShift(
          actor,
          actorId,
          date,
          next,
          next && next !== "D" && next !== "PH"
            ? currentWorkShift ?? "normal"
            : undefined,
        ),
      next
        ? `排班已設為${SALES_ASSIGNMENT_NAMES[next]}。`
        : "已清除排班。",
    );
  };
  const updateWorkShift = (
    actorId: string,
    date: string,
    assignment: SalesAssignment,
    workShift: SalesWorkShift,
  ) => {
    run(
      () =>
        engine.setSalesShift(
          actor,
          actorId,
          date,
          assignment,
          workShift,
        ),
      `更份已設為${SALES_WORK_SHIFT_NAMES[workShift]}。`,
    );
  };
  const openLocation = (row?: SalesTeamLocation) => {
    setLocation(
      row
        ? {
            id: row.id,
            team: row.team,
            startDate: row.startDate,
            endDate: row.endDate,
            location: row.location,
          }
        : {
            team:
              actor.role === "supervisor"
                ? (actor.team as "A" | "B" | "C")
                : "A",
            startDate: `${month}-01`,
            endDate: `${month}-${String(days.length).padStart(2, "0")}`,
            location: "",
          },
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
              onChange={(event) =>
                setMonth(event.target.value || DEMO_TODAY.slice(0, 7))
              }
            />
          </Field>
        }
      />
      <div className="roster-stack">
        <section className="list-panel roster-team-panel">
          <div className="roster-section-head">
            <div>
              <strong>月度 Team</strong>
              <p>每月可重新設定；每日更表仍可獨立改 A／B／C。</p>
            </div>
            <Badge>{month.replace("-", "年")}月</Badge>
          </div>
          <div className="table-scroll">
            <table className="monthly-team-table">
              <thead>
                <tr>
                  <th>Sales</th>
                  <th>原 Team</th>
                  <th>本月 Team</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schedule.members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.name}</strong>
                      <small>{member.code}</small>
                    </td>
                    <td>Team {member.team ?? "—"}</td>
                    <td>
                      {canEdit ? (
                        <select
                          aria-label={`${member.name} 本月Team`}
                          value={
                            monthlyTeams.get(member.id) ??
                            member.team ??
                            ""
                          }
                          onChange={(event) => {
                            if (!event.target.value) return;
                            run(
                              () =>
                                engine.setSalesMonthlyTeam(
                                  actor,
                                  member.id,
                                  month,
                                  event.target.value as "A" | "B" | "C",
                                ),
                              `${member.name} 本月Team已更新。`,
                            );
                          }}
                        >
                          <option value="">未設定</option>
                          {TEAMS.map((team) => (
                            <option key={team} value={team}>
                              Team {team}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge strong>
                          Team{" "}
                          {monthlyTeams.get(member.id) ?? member.team ?? "—"}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            run(
                              () =>
                                engine.applySalesMonthlyTeam(
                                  actor,
                                  member.id,
                                  month,
                                ),
                              `${member.name} 已套用月度Team至未排日期。`,
                            )
                          }
                        >
                          套用全月
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="list-panel roster-panel">
          <div className="roster-toolbar">
            <div>
              <strong>每日更表</strong>
              <p>
                A／B／C＝當日所屬Team；D＝放假；補＝公眾假期補假。
                <br />
                灰色＝早更 9-6；淺藍＝日常 10-7；下方為Team地點。
              </p>
            </div>
            <div className="roster-legend">
              {ASSIGNMENTS.map((assignment) => (
                <span key={assignment} data-assignment={assignment}>
                  {assignment === "D"
                    ? "D 放假"
                    : assignment === "PH"
                      ? "D 補假"
                      : assignment}
                </span>
              ))}
              <span data-work="early">早更</span>
              <span data-work="normal">日常</span>
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
                      <small>
                        Team {monthlyTeams.get(member.id) ?? member.team ?? "—"}
                      </small>
                    </th>
                    {days.map((day) => {
                      const row = shifts.get(`${member.id}|${day.date}`);
                      const assignment = row?.assignment;
                      const workShift = row?.workShift;
                      const color =
                        assignment === "D"
                          ? "assignment-d"
                          : assignment === "PH"
                            ? "assignment-ph"
                            : assignment
                              ? workShift === "early"
                                ? "work-early"
                                : "work-normal"
                              : "";
                      return (
                        <td
                          key={day.date}
                          className={`roster-cell ${color} ${
                            day.weekday === 0 || day.weekday === 6
                              ? "weekend"
                              : ""
                          }`}
                        >
                          {canEdit ? (
                            <div className="roster-editor">
                              <select
                                className="roster-assignment"
                                aria-label={`${member.name} ${day.date} 排班`}
                                value={assignment ?? ""}
                                onChange={(event) =>
                                  updateShift(
                                    member.id,
                                    day.date,
                                    event.target.value,
                                    workShift,
                                  )
                                }
                              >
                                <option value="">—</option>
                                {ASSIGNMENTS.map((code) => (
                                  <option key={code} value={code}>
                                    {code === "D"
                                      ? "D 放假"
                                      : code === "PH"
                                        ? "D 補假"
                                        : code}
                                  </option>
                                ))}
                              </select>
                              {assignment &&
                                assignment !== "D" &&
                                assignment !== "PH" && (
                                  <select
                                    className="roster-workshift"
                                    aria-label={`${member.name} ${day.date} 更份`}
                                    value={workShift ?? "normal"}
                                    onChange={(event) =>
                                      updateWorkShift(
                                        member.id,
                                        day.date,
                                        assignment,
                                        event.target.value as SalesWorkShift,
                                      )
                                    }
                                  >
                                    <option value="early">早</option>
                                    <option value="normal">日</option>
                                  </select>
                                )}
                            </div>
                          ) : (
                            <span className="roster-readonly">
                              {assignment === "PH"
                                ? "D"
                                : assignment ?? "—"}
                              {assignment &&
                                assignment !== "D" &&
                                assignment !== "PH" && (
                                  <small>
                                    {workShift === "early" ? "早" : "日"}
                                  </small>
                                )}
                            </span>
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
                      const assignment = shifts.get(
                        `${member.id}|${day.date}`,
                      )?.assignment;
                      return assignment === "A" || assignment === "B" || assignment === "C";
                    }).length;
                    return <td key={day.date}>{count || "—"}</td>;
                  })}
                </tr>
                {TEAMS.map((team) => (
                  <tr className="team-location-row" key={team}>
                    <th>Team {team} 地點</th>
                    {days.map((day) => {
                      const row = locationFor(team, day.date);
                      return (
                        <td key={day.date} title={row?.location}>
                          {row?.location ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="list-panel roster-location-panel">
          <div className="roster-section-head">
            <div>
              <strong>Team 地點安排</strong>
              <p>每個地點可設定開始及結束日期；空白代表當日全Team放假。</p>
            </div>
            {canEdit && (
              <Button onClick={() => openLocation()}>
                <Plus size={18} /> 新增地點
              </Button>
            )}
          </div>
          {schedule.locations.length === 0 ? (
            <p className="roster-empty">本月未設定Team地點。</p>
          ) : (
            <div className="roster-location-list">
              {schedule.locations.map((row) => (
                <div className="roster-location-item" key={row.id}>
                  <Badge strong>Team {row.team}</Badge>
                  <span>
                    {row.startDate} 至 {row.endDate}
                  </span>
                  <strong>{row.location}</strong>
                  {canEdit && (
                    <span className="roster-location-actions">
                      <Button
                        variant="ghost"
                        onClick={() => openLocation(row)}
                      >
                        修改
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`刪除 Team ${row.team} ${row.location}`}
                        onClick={() =>
                          run(
                            () =>
                              engine.removeSalesTeamLocation(actor, row.id),
                            "Team地點已刪除。",
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {location && (
        <Dialog
          title={location.id ? "修改Team地點" : "新增Team地點"}
          onClose={() => setLocation(null)}
        >
          <div className="form-grid two">
            <Field label="Team" required>
              <select
                value={location.team}
                disabled={actor.role === "supervisor"}
                onChange={(event) =>
                  setLocation({
                    ...location,
                    team: event.target.value as "A" | "B" | "C",
                  })
                }
              >
                {TEAMS.map((team) => (
                  <option key={team} value={team}>
                    Team {team}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="工作地點" required>
              <input
                value={location.location}
                onChange={(event) =>
                  setLocation({ ...location, location: event.target.value })
                }
                placeholder="例如：恒安"
              />
            </Field>
            <Field label="開始日期" required>
              <input
                type="date"
                min={`${month}-01`}
                max={`${month}-${String(days.length).padStart(2, "0")}`}
                value={location.startDate}
                onChange={(event) =>
                  setLocation({ ...location, startDate: event.target.value })
                }
              />
            </Field>
            <Field label="結束日期" required>
              <input
                type="date"
                min={`${month}-01`}
                max={`${month}-${String(days.length).padStart(2, "0")}`}
                value={location.endDate}
                onChange={(event) =>
                  setLocation({ ...location, endDate: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setLocation(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                let saved = false;
                run(() => {
                  engine.saveSalesTeamLocation(actor, {
                    id: location.id,
                    month,
                    team: location.team,
                    startDate: location.startDate,
                    endDate: location.endDate,
                    location: location.location,
                  });
                  saved = true;
                  return true;
                }, "Team地點已儲存。");
                if (saved) setLocation(null);
              }}
            >
              儲存地點
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

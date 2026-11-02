import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useApp } from "../context";
import { Badge, Button, Dialog, Field, PageHead } from "../components/ui";
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

function monthLabel(month: string) {
  return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
}

function fullDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日（星期${
    WEEKDAYS[parsed.getDay()]
  }）`;
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
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationDraft | null>(null);
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
  const locationFor = (team: "A" | "B" | "C", date: string) =>
    schedule.locations.find(
      (row) =>
        row.team === team && row.startDate <= date && row.endDate >= date,
    );
  const hasTeamLocations = (team: "A" | "B" | "C") =>
    schedule.locations.some((row) => row.team === team);
  const hasRosterData =
    schedule.shifts.length > 0 || schedule.locations.length > 0;
  const shiftAt = (actorId: string, date: string) =>
    shifts.get(`${actorId}|${date}`);

  const moveMonth = (delta: number) => {
    const date = new Date(`${month}-01T00:00:00`);
    date.setMonth(date.getMonth() + delta);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };

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

  const cells: Array<(typeof days)[number] | null> = [
    ...Array.from(
      { length: (new Date(`${month}-01T00:00:00`).getDay() + 6) % 7 },
      () => null,
    ),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<(typeof days)[number] | null>> = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  const editorDay = editorDate
    ? days.find((day) => day.date === editorDate)
    : undefined;

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
          <div className="schedule-month-nav">
            <Button
              variant="ghost"
              aria-label="上一個月"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={18} />
            </Button>
            <input
              aria-label="排班月份"
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(event.target.value || DEMO_TODAY.slice(0, 7))
              }
            />
            <Button
              variant="ghost"
              aria-label="下一個月"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        }
      />

      <div className="schedule-layout">
        <div className="schedule-main">
          <section className="list-panel schedule-calendar-panel">
            <div className="schedule-calendar-head">
              <div>
                <strong>{monthLabel(month)}</strong>
                <p>
                  {canEdit
                    ? "點擊日期可編排當日 Sales；每格顯示Team地點及上班人數。"
                    : "點擊日期查看當日安排。"}
                </p>
              </div>
              <div className="schedule-legend">
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
            <div className="schedule-weekdays">
              {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="schedule-grid">
              {weeks.map((week, weekIndex) => (
                <div className="schedule-week" key={`week-${weekIndex}`}>
                  {week.map((day, index) => {
                    if (!day)
                      return (
                        <div
                          className="schedule-day schedule-day-empty"
                          key={`empty-${weekIndex}-${index}`}
                        />
                      );
                    const weekend = day.weekday === 0 || day.weekday === 6;
                    const today = day.date === DEMO_TODAY;
                    const own = shiftAt(actor.id, day.date);
                    const offCount = schedule.members.filter(
                      (member) =>
                        shiftAt(member.id, day.date)?.assignment === "D",
                    ).length;
                    const phCount = schedule.members.filter(
                      (member) =>
                        shiftAt(member.id, day.date)?.assignment === "PH",
                    ).length;
                    return (
                      <button
                        type="button"
                        className={`schedule-day ${weekend ? "weekend" : ""} ${
                          today ? "today" : ""
                        } ${!hasRosterData ? "compact" : ""}`}
                        key={day.date}
                        aria-label={`${day.date} 排班`}
                        onClick={() => setEditorDate(day.date)}
                      >
                        <header>
                          <strong>{day.day}</strong>
                          <span>{WEEKDAYS[day.weekday]}</span>
                          {today && <em>今天</em>}
                        </header>
                        {canEdit ? (
                          <>
                            {hasRosterData ? (
                              <div className="schedule-team-lines">
                                {TEAMS.map((team) => {
                                  const place = locationFor(team, day.date);
                                  const people = schedule.members.filter(
                                    (member) =>
                                      shiftAt(member.id, day.date)
                                        ?.assignment === team,
                                  );
                                  const count = people.length;
                                  return (
                                    <div
                                      className={`schedule-team-line team-${team}`}
                                      key={team}
                                      title={people
                                        .map((person) => person.name)
                                        .join("、")}
                                    >
                                      <b>{team}</b>
                                      <span
                                        title={place?.location}
                                        className={
                                          !place && !hasTeamLocations(team)
                                            ? "unconfigured"
                                            : ""
                                        }
                                      >
                                        {place?.location ??
                                          (hasTeamLocations(team)
                                            ? "全Team放假"
                                            : "未設定地點")}
                                      </span>
                                      <small
                                        className={
                                          place && count === 0
                                            ? "empty-count"
                                            : ""
                                        }
                                      >
                                        {place ? `${count}人` : "—"}
                                      </small>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="schedule-day-hint">
                                未排更 · 點擊設定
                              </span>
                            )}
                            {(offCount > 0 || phCount > 0) && (
                              <footer>
                                {offCount > 0 && <span>D {offCount}</span>}
                                {phCount > 0 && <span>補 {phCount}</span>}
                              </footer>
                            )}
                          </>
                        ) : (
                          <div className="schedule-own">
                            <strong
                              className={
                                own?.assignment === "D"
                                  ? "day-off"
                                  : own?.assignment === "PH"
                                    ? "day-ph"
                                    : own?.workShift === "early"
                                      ? "day-early"
                                      : "day-normal"
                              }
                            >
                              {own?.assignment === "PH"
                                ? "D 補假"
                                : own?.assignment
                                  ? SALES_ASSIGNMENT_NAMES[own.assignment]
                                  : "未排"}
                            </strong>
                            {own?.assignment &&
                              own.assignment !== "D" &&
                              own.assignment !== "PH" && (
                                <small>
                                  {SALES_WORK_SHIFT_NAMES[own.workShift ?? "normal"]}
                                </small>
                              )}
                            <span>
                              {own?.assignment
                                ? locationFor(
                                    own.assignment as "A" | "B" | "C",
                                    day.date,
                                  )?.location ??
                                  (hasTeamLocations(
                                    own.assignment as "A" | "B" | "C",
                                  )
                                    ? "Team全體放假"
                                    : "未設定地點")
                                : ""}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="schedule-side">
          <section className="list-panel schedule-side-card">
            <div className="schedule-side-head">
              <div>
                <strong>月度 Team</strong>
                <p>每月重新設定，可套用到未排日期。</p>
              </div>
            </div>
            <div className="monthly-team-list">
              {schedule.members.map((member) => (
                <div className="monthly-team-row" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <small>原 Team {member.team ?? "—"}</small>
                  </div>
                  {canEdit ? (
                    <div className="monthly-team-actions">
                      <select
                        aria-label={`${member.name} 本月Team`}
                        value={
                          monthlyTeams.get(member.id) ?? member.team ?? ""
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
                        {TEAMS.map((team) => (
                          <option key={team} value={team}>
                            Team {team}
                          </option>
                        ))}
                      </select>
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
                        套用
                      </Button>
                    </div>
                  ) : (
                    <Badge strong>
                      Team {monthlyTeams.get(member.id) ?? member.team ?? "—"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="list-panel schedule-side-card">
            <div className="schedule-side-head">
              <div>
                <strong>Team 地點</strong>
                <p>空白代表當日全Team放假。</p>
              </div>
              {canEdit && (
                <Button variant="ghost" onClick={() => openLocation()}>
                  <Plus size={16} /> 新增
                </Button>
              )}
            </div>
            {schedule.locations.length === 0 ? (
              <p className="schedule-side-empty">本月未設定地點。</p>
            ) : (
              <div className="schedule-location-list">
                {schedule.locations.map((row) => (
                  <div className="schedule-location-item" key={row.id}>
                    <Badge strong>Team {row.team}</Badge>
                    <div>
                      <strong>{row.location}</strong>
                      <small>
                        {row.startDate.slice(5)} – {row.endDate.slice(5)}
                      </small>
                    </div>
                    {canEdit && (
                      <div className="schedule-location-actions">
                        <button
                          type="button"
                          onClick={() => openLocation(row)}
                        >
                          改
                        </button>
                        <button
                          type="button"
                          aria-label={`刪除 Team ${row.team} ${row.location}`}
                          onClick={() =>
                            run(
                              () =>
                                engine.removeSalesTeamLocation(actor, row.id),
                              "Team地點已刪除。",
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {editorDay && (
        <Dialog
          wide
          title={`${fullDateLabel(editorDay.date)} · 排班`}
          onClose={() => setEditorDate(null)}
        >
          <div className="day-editor-locations">
            {TEAMS.map((team) => {
              const place = locationFor(team, editorDay.date);
              return (
                <div key={team}>
                  <b>Team {team}</b>
                  <span>
                    {place?.location ??
                      (hasTeamLocations(team) ? "全Team放假" : "未設定地點")}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="table-scroll">
            <table className="day-editor-table">
              <thead>
                <tr>
                  <th>Sales</th>
                  <th>月度 Team</th>
                  <th>當日安排</th>
                  <th>更份</th>
                </tr>
              </thead>
              <tbody>
                {schedule.members.map((member) => {
                  const row = shiftAt(member.id, editorDay.date);
                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <small>{member.code}</small>
                      </td>
                      <td>
                        Team{" "}
                        {monthlyTeams.get(member.id) ?? member.team ?? "—"}
                      </td>
                      <td>
                        {canEdit ? (
                          <select
                            aria-label={`${member.name} ${editorDay.date} 排班`}
                            value={row?.assignment ?? ""}
                            onChange={(event) =>
                              updateShift(
                                member.id,
                                editorDay.date,
                                event.target.value,
                                row?.workShift,
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
                                    : `Team ${code}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge strong={row?.assignment === "PH"}>
                            {row?.assignment === "PH"
                              ? "D 補假"
                              : row?.assignment
                                ? SALES_ASSIGNMENT_NAMES[row.assignment]
                                : "未排"}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {canEdit &&
                        row?.assignment &&
                        row.assignment !== "D" &&
                        row.assignment !== "PH" ? (
                          <select
                            aria-label={`${member.name} ${editorDay.date} 更份`}
                            value={row.workShift ?? "normal"}
                            onChange={(event) =>
                              updateWorkShift(
                                member.id,
                                editorDay.date,
                                row.assignment!,
                                event.target.value as SalesWorkShift,
                              )
                            }
                          >
                            <option value="early">早更 9-6</option>
                            <option value="normal">日常 10-7</option>
                          </select>
                        ) : (
                          <span className="muted">
                            {row?.workShift
                              ? SALES_WORK_SHIFT_NAMES[row.workShift]
                              : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="schedule-day-note">
            D 放假不會計入上班人數；D 補假以深綠色顯示；Team 地點空白代表全Team放假。
          </p>
        </Dialog>
      )}

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

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useApp } from "../context";
import { Badge, Button, Dialog, Field, PageHead } from "../components/ui";
import {
  DEMO_TODAY,
  SALES_OFF_CODE,
  SALES_PH_CODE,
  SALES_WORK_SHIFT_NAMES,
  SalesAssignment,
  SalesRosterMember,
  SalesScheduleMember,
  SalesTeamLocation,
  SalesWorkShift,
} from "../domain/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const TEAM_COLORS = [
  { bg: "#f4e786", text: "#5b4d00" },
  { bg: "#9dc9f2", text: "#173f61" },
  { bg: "#d9b8e8", text: "#532d63" },
  { bg: "#f2b5b5", text: "#6a2020" },
  { bg: "#a8d8c4", text: "#174d39" },
  { bg: "#f3c78e", text: "#5d3a0b" },
  { bg: "#b9c7ef", text: "#283966" },
  { bg: "#d7d2a8", text: "#4f4a18" },
];
const OFF_COLOR = { bg: "#f2c0ab", text: "#6b2d18" };
const PH_COLOR = { bg: "#78986c", text: "#ffffff" };
const EARLY_COLOR = { bg: "#dcdcd8", text: "#3d4039" };

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
function colorForTeam(index: number) {
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

type LocationDraft = {
  id?: string;
  team: string;
  startDate: string;
  endDate: string;
  location: string;
};
type CellDraft = {
  member: SalesScheduleMember;
  date: string;
  assignment: string;
  workShift: SalesWorkShift;
};

export function SalesSchedule() {
  const { actor, engine, run } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const [cell, setCell] = useState<CellDraft | null>(null);
  const [addMember, setAddMember] = useState(false);
  const [teamEdit, setTeamEdit] = useState(false);
  const [salesEdit, setSalesEdit] = useState(false);
  const [newMember, setNewMember] = useState<{
    name: string;
    kind: "supervisor" | "sales";
    team: string;
  }>({ name: "", kind: "sales", team: "A" });
  const canEdit = actor.role === "head" || actor.role === "supervisor";
  const canAdd = actor.role === "head";
  const canEditTeam = (team: string) =>
    canAdd || (actor.role === "supervisor" && actor.team === team);
  const schedule = engine.getSalesSchedule(actor, month);
  const days = monthDays(month);
  const shifts = new Map(
    schedule.shifts.map((shift) => [
      `${shift.actorId}|${shift.date}`,
      shift,
    ]),
  );
  const teamByCode = new Map(
    schedule.teams.map((team) => [team.code, team]),
  );
  const locationFor = (team: string, date: string) =>
    schedule.locations.find(
      (row) =>
        row.team === team && row.startDate <= date && row.endDate >= date,
    );
  const supervisorMembers = schedule.members.filter(
    (member) => member.kind === "supervisor",
  );
  const salesTeams = schedule.teams.map((team) => ({
    ...team,
    members: schedule.members.filter(
      (member) => member.kind === "sales" && member.team === team.code,
    ),
  }));
  const moveMonth = (delta: number) => {
    const date = new Date(`${month}-01T00:00:00`);
    date.setMonth(date.getMonth() + delta);
    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const openLocation = (team: string, row?: SalesTeamLocation) => {
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
            team,
            startDate: `${month}-01`,
            endDate: `${month}-${String(days.length).padStart(2, "0")}`,
            location: "",
          },
    );
  };
  const openCell = (member: SalesScheduleMember, date: string) => {
    if (!canEdit) return;
    const row = shifts.get(`${member.id}|${date}`);
    const assignment =
      row?.assignment ??
      (member.kind === "sales" ? member.team : schedule.teams[0]?.code ?? "A");
    setCell({
      member,
      date,
      assignment,
      workShift: row?.workShift ?? "normal",
    });
  };
  const cellStyle = (assignment?: string, workShift?: SalesWorkShift) => {
    if (!assignment) return { background: "#fafbf7", color: "#a0a798" };
    if (assignment === SALES_OFF_CODE) return {
      background: OFF_COLOR.bg,
      color: OFF_COLOR.text,
    };
    if (assignment === SALES_PH_CODE) return {
      background: PH_COLOR.bg,
      color: PH_COLOR.text,
    };
    if (workShift === "early") return {
      background: EARLY_COLOR.bg,
      color: EARLY_COLOR.text,
    };
    const team = teamByCode.get(assignment);
    const color = colorForTeam(team?.colorIndex ?? 0);
    return { background: color.bg, color: color.text };
  };
  const cellText = (assignment?: string) => {
    if (!assignment) return "—";
    if (assignment === SALES_OFF_CODE || assignment === SALES_PH_CODE)
      return "D";
    return assignment;
  };
  const memberName = (member: SalesScheduleMember) => (
    <div className="sales-table-name">
      <strong>{member.name}</strong>
      {canAdd &&
        salesEdit &&
        member.kind === "sales" &&
        !member.sourceActorId && (
          <button
            type="button"
            className="sales-delete-link"
            aria-label={`刪除 ${member.name}`}
            onClick={() =>
              run(
                () =>
                  engine.deleteSalesRosterMember(actor, month, member.id),
                `${member.name} 已刪除。`,
              )
            }
          >
            刪除
          </button>
        )}
    </div>
  );
  return (
    <>
      <PageHead
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
      <div className="schedule-sheet-stack">
        <section className="list-panel sales-sheet-panel">
          <div className="sales-sheet-head">
            <strong>銷售地點</strong>
            {canAdd &&
              (teamEdit ? (
                <div className="sales-edit-actions">
                  <Button
                    onClick={() =>
                      run(
                        () => engine.addSalesRosterTeam(actor, month),
                        "已新增Team。",
                      )
                    }
                  >
                    <Plus size={18} /> Team
                  </Button>
                  <Button onClick={() => setTeamEdit(false)}>完成</Button>
                </div>
              ) : (
                <Button onClick={() => setTeamEdit(true)}>編輯</Button>
              ))}
          </div>
          <div className="table-scroll sales-sheet-scroll">
            <table className="sales-location-grid">
              <thead>
                <tr>
                  <th className="sales-table-name-head">地點</th>
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
                {schedule.teams.map((team) => {
                  const color = colorForTeam(team.colorIndex);
                  return (
                    <tr key={team.code}>
                      <th
                        className="sales-location-name"
                        style={{ background: color.bg, color: color.text }}
                      >
                        <span>{team.code}</span>
                        {canEditTeam(team.code) && (
                          <button
                            type="button"
                            onClick={() => openLocation(team.code)}
                          >
                            + 新增地方
                          </button>
                        )}
                        {canAdd &&
                          teamEdit &&
                          !["A", "B", "C"].includes(team.code) && (
                            <button
                              type="button"
                              className="sales-delete-link"
                              aria-label={`刪除 Team ${team.code}`}
                              onClick={() =>
                                run(
                                  () =>
                                    engine.deleteSalesRosterTeam(
                                      actor,
                                      month,
                                      team.code,
                                    ),
                                  `Team ${team.code} 已刪除。`,
                                )
                              }
                            >
                              刪除
                            </button>
                          )}
                      </th>
                      {days.map((day) => {
                        const place = locationFor(team.code, day.date);
                        return (
                          <td key={day.date}>
                            {place ? (
                              <button
                                type="button"
                                className="sales-location-cell"
                                onClick={() =>
                                  canEditTeam(team.code) &&
                                  openLocation(team.code, place)
                                }
                              >
                                {place.location}
                              </button>
                            ) : (
                              <span />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="list-panel sales-sheet-panel">
          <div className="sales-sheet-head">
            <strong>銷售 Sales</strong>
            {canAdd &&
              (salesEdit ? (
                <div className="sales-edit-actions">
                  <Button
                    onClick={() => {
                      setNewMember({
                        name: "",
                        kind: "sales",
                        team: schedule.teams[0]?.code ?? "A",
                      });
                      setAddMember(true);
                    }}
                  >
                    <Plus size={18} /> Sale
                  </Button>
                  <Button onClick={() => setSalesEdit(false)}>完成</Button>
                </div>
              ) : (
                <Button onClick={() => setSalesEdit(true)}>編輯</Button>
              ))}
          </div>
          <div className="table-scroll sales-sheet-scroll">
            <table className="sales-roster-grid">
              <thead>
                <tr>
                  <th className="sales-table-name-head">Sales</th>
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
                {supervisorMembers.length > 0 && (
                  <>
                    <tr className="sales-group-row">
                      <th colSpan={days.length + 1}>主管</th>
                    </tr>
                    {supervisorMembers.map((member) => (
                      <tr key={member.id} className="sales-member-row">
                        <th>{memberName(member)}</th>
                        {days.map((day) => {
                          const row = shifts.get(`${member.id}|${day.date}`);
                          return (
                            <td key={day.date}>
                              <button
                                type="button"
                                className="sales-shift-cell"
                                data-assignment={row?.assignment ?? ""}
                                data-shift={row?.workShift ?? ""}
                                aria-label={`${member.name} ${day.date} 更表`}
                                style={cellStyle(
                                  row?.assignment,
                                  row?.workShift,
                                )}
                                onClick={() => openCell(member, day.date)}
                              >
                                {cellText(row?.assignment)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}
                {salesTeams.map((team) => {
                  const color = colorForTeam(team.colorIndex);
                  return (
                    <React.Fragment key={team.code}>
                      <tr className="sales-group-row">
                        <th
                          colSpan={days.length + 1}
                          style={{ background: color.bg, color: color.text }}
                        >
                          Team {team.code}
                        </th>
                      </tr>
                      {team.members.map((member) => (
                        <tr key={member.id} className="sales-member-row">
                          <th>{memberName(member)}</th>
                          {days.map((day) => {
                            const row = shifts.get(`${member.id}|${day.date}`);
                            return (
                              <td key={day.date}>
                                <button
                                  type="button"
                                  className="sales-shift-cell"
                                  data-assignment={row?.assignment ?? ""}
                                  data-shift={row?.workShift ?? ""}
                                  aria-label={`${member.name} ${day.date} 更表`}
                                  style={cellStyle(
                                    row?.assignment,
                                    row?.workShift,
                                  )}
                                  onClick={() => openCell(member, day.date)}
                                >
                                  {cellText(row?.assignment)}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {addMember && (
        <Dialog title="新增Sales／主管" onClose={() => setAddMember(false)}>
          <div className="form-grid two">
            <Field label="名稱" required>
              <input
                aria-label="新成員名稱"
                value={newMember.name}
                onChange={(event) =>
                  setNewMember({ ...newMember, name: event.target.value })
                }
                placeholder="例如：Karen"
              />
            </Field>
            <Field label="類型" required>
              <select
                aria-label="新成員類型"
                value={newMember.kind}
                onChange={(event) =>
                  setNewMember({
                    ...newMember,
                    kind: event.target.value as "supervisor" | "sales",
                  })
                }
              >
                <option value="sales">Sale</option>
                <option value="supervisor">主管</option>
              </select>
            </Field>
            <Field label="Team" required>
              <select
                aria-label="新成員Team"
                value={newMember.team}
                onChange={(event) =>
                  setNewMember({ ...newMember, team: event.target.value })
                }
              >
                {schedule.teams.map((team) => (
                  <option key={team.code} value={team.code}>
                    Team {team.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="schedule-day-note">
            新增 Sale 後會自動安排：5日 D 放假、最少10日早更，其餘為日常更。
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setAddMember(false)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                let saved = false;
                run(() => {
                  engine.addSalesRosterMember(actor, month, newMember);
                  saved = true;
                  return true;
                }, "已新增成員並自動排班。");
                if (saved) setAddMember(false);
              }}
            >
              新增並自動排班
            </Button>
          </div>
        </Dialog>
      )}

      {cell && (
        <Dialog
          title={`${cell.member.name} · ${cell.date} 更表`}
          onClose={() => setCell(null)}
        >
          <div className="form-grid two">
            <Field label="安排" required>
              <select
                aria-label="更表安排"
                value={cell.assignment}
                onChange={(event) =>
                  setCell({ ...cell, assignment: event.target.value })
                }
              >
                {schedule.teams.map((team) => (
                  <option key={team.code} value={team.code}>
                    Team {team.code}
                  </option>
                ))}
                <option value={SALES_OFF_CODE}>D 放假</option>
                <option value={SALES_PH_CODE}>D 補假</option>
              </select>
            </Field>
            <Field label="更份">
              <select
                aria-label="更份"
                value={cell.workShift}
                disabled={
                  cell.assignment === SALES_OFF_CODE ||
                  cell.assignment === SALES_PH_CODE
                }
                onChange={(event) =>
                  setCell({
                    ...cell,
                    workShift: event.target.value as SalesWorkShift,
                  })
                }
              >
                <option value="early">早更 9-6</option>
                <option value="normal">日常 10-7</option>
              </select>
            </Field>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setCell(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                run(
                  () =>
                    engine.setSalesShift(
                      actor,
                      cell.member.id,
                      cell.date,
                      cell.assignment,
                      cell.workShift,
                    ),
                  "更表已更新。",
                );
                setCell(null);
              }}
            >
              儲存
            </Button>
          </div>
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
                aria-label="地點Team"
                value={location.team}
                disabled={actor.role === "supervisor"}
                onChange={(event) =>
                  setLocation({ ...location, team: event.target.value })
                }
              >
                {schedule.teams.map((team) => (
                  <option key={team.code} value={team.code}>
                    Team {team.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="工作地點" required>
              <input
                aria-label="工作地點"
                value={location.location}
                onChange={(event) =>
                  setLocation({ ...location, location: event.target.value })
                }
                placeholder="例如：恒安"
              />
            </Field>
            <Field label="開始日期" required>
              <input
                aria-label="開始日期"
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
                aria-label="結束日期"
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

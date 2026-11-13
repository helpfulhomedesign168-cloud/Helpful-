import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useApp } from "../context";
import { Badge, Button, Dialog, Field, PageHead } from "../components/ui";
import {
  DEMO_TODAY,
  SALES_OFF_CODE,
  SALES_PH_CODE,
  SalesAssignment,
  SalesRosterMember,
  SalesScheduleMember,
  SalesTeamLocation,
  SalesWorkShift,
  ROLE_NAMES,
} from "../domain/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const TEAM_COLORS = [
  { bg: "#FFD29A", text: "#5A2800" },
  { bg: "#C9B8FF", text: "#3B2160" },
  { bg: "#A8E6C3", text: "#0B4A2A" },
  { bg: "#88BAFF", text: "#0D1B40" },
  { bg: "#FFC4D6", text: "#60233A" },
  { bg: "#FFE59A", text: "#5A4300" },
];
const OFF_COLOR = { bg: "#EEF1F5", text: "#5B6573" };
const PH_COLOR = { bg: "#0D1B40", text: "#ffffff" };
const EARLY_COLOR = { bg: "#D9DEE8", text: "#3A4352" };

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
  team: string;
  mode: "early" | "normal" | "off" | "ph";
};

export function SalesSchedule() {
  const { actor, engine, run } = useApp();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [location, setLocation] = useState<LocationDraft | null>(null);
  const [cell, setCell] = useState<CellDraft | null>(null);
  const [teamEditor, setTeamEditor] = useState(false);
  const [salesEditor, setSalesEditor] = useState(false);
  const [newMember, setNewMember] = useState<{
    actorId: string;
    name: string;
    kind: "supervisor" | "sales";
    team: string;
  }>({ actorId: "", name: "", kind: "sales", team: "A" });
  const canEdit = actor.role === "head" || actor.role === "supervisor";
  const canAdd = actor.role === "head";
  const canEditTeam = (team: string) =>
    canAdd || (actor.role === "supervisor" && actor.team === team);
  const schedule = engine.getSalesSchedule(actor, month);
  const days = monthDays(month);
  const salesCandidates = engine
    .listActors()
    .filter(
      (candidate) =>
        candidate.active !== false &&
        ["sales", "supervisor", "head"].includes(candidate.role),
    );
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
  const locationSegments = (team: string) => {
    const segments: Array<{
      start: number;
      span: number;
      location: string;
      row?: SalesTeamLocation;
    }> = [];
    days.forEach((day, index) => {
      const row = locationFor(team, day.date);
      const location = row?.location ?? "";
      const last = segments.at(-1);
      if (last && last.location === location) last.span += 1;
      else segments.push({ start: index, span: 1, location, row });
    });
    return segments;
  };
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
    const occupied = new Set(
      days
        .filter((day) =>
          schedule.locations.some(
            (candidate) =>
              candidate.team === team &&
              candidate.id !== row?.id &&
              candidate.startDate <= day.date &&
              candidate.endDate >= day.date,
          ),
        )
        .map((day) => day.date),
    );
    const occupiedDates = days
      .filter((day) => occupied.has(day.date))
      .map((day) => day.date);
    const latestOccupied = occupiedDates.at(-1);
    const appendStart = latestOccupied
      ? (days.find((day) => day.date > latestOccupied)?.date ?? "")
      : (days.find((day) => !occupied.has(day.date))?.date ?? "");
    const available = days
      .filter(
        (day) =>
          !occupied.has(day.date) && (!appendStart || day.date >= appendStart),
      )
      .map((day) => day.date);
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
            startDate: appendStart,
            endDate: available.at(-1) ?? "",
            location: "",
          },
    );
  };
  const openCell = (member: SalesScheduleMember, date: string) => {
    if (!canEdit) return;
    const row = shifts.get(`${member.id}|${date}`);
    const mode =
      row?.assignment === SALES_OFF_CODE
        ? "off"
        : row?.assignment === SALES_PH_CODE
          ? "ph"
          : row?.workShift ?? "normal";
    setCell({
      member,
      date,
      team:
        row?.assignment &&
        row.assignment !== SALES_OFF_CODE &&
        row.assignment !== SALES_PH_CODE
          ? row.assignment
          : member.team,
      mode,
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
    if (assignment === SALES_OFF_CODE) return "Off";
    if (assignment === SALES_PH_CODE) return "補";
    return assignment;
  };
  const memberName = (member: SalesScheduleMember) => (
    <div className="sales-table-name">
      <strong>{member.name}</strong>
    </div>
  );
  const blockedLocationDates = new Set(
    location
      ? days
          .filter((day) =>
            schedule.locations.some(
              (row) =>
                row.team === location.team &&
                row.id !== location.id &&
                row.startDate <= day.date &&
                row.endDate >= day.date,
            ),
          )
          .map((day) => day.date)
      : [],
  );
  const dateOptionLabel = (date: string) => date.replaceAll("-", "/");
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
            {canAdd && (
              <Button onClick={() => setTeamEditor(true)}>編輯</Button>
            )}
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
                        <div className="sales-location-name-row">
                          <span>{team.code}</span>
                          {canEditTeam(team.code) && (
                            <button
                              type="button"
                              onClick={() => openLocation(team.code)}
                            >
                              + 新增地方
                            </button>
                          )}
                        </div>
                      </th>
                      {locationSegments(team.code).map((segment, index) =>
                        segment.location ? (
                          <td
                            key={`${team.code}-${segment.start}`}
                            colSpan={segment.span}
                            className="sales-location-span"
                          >
                            <button
                              type="button"
                              className="sales-location-cell"
                              onClick={() =>
                                canEditTeam(team.code) &&
                                segment.row &&
                                openLocation(team.code, segment.row)
                              }
                            >
                              {segment.location}
                            </button>
                          </td>
                        ) : (
                          <td
                            key={`${team.code}-empty-${segment.start}-${index}`}
                            colSpan={segment.span}
                            className="sales-location-span location-gap"
                          />
                        ),
                      )}
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
            {canAdd && (
              <Button onClick={() => setSalesEditor(true)}>編輯</Button>
            )}
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

      {teamEditor && (
        <Dialog title="編輯Team" onClose={() => setTeamEditor(false)}>
          <div className="roster-editor-list">
            {schedule.teams.map((team) => {
              const color = colorForTeam(team.colorIndex);
              return (
                <div className="roster-editor-row" key={team.code}>
                  <span
                    className="roster-editor-code"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {team.code}
                  </span>
                  <strong>Team {team.code}</strong>
                  {!["A", "B", "C"].includes(team.code) && (
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
                </div>
              );
            })}
          </div>
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
          <div className="dialog-actions">
            <Button variant="primary" onClick={() => setTeamEditor(false)}>
              完成
            </Button>
          </div>
        </Dialog>
      )}

      {salesEditor && (
        <Dialog title="編輯Sales" onClose={() => setSalesEditor(false)}>
          {schedule.members.filter((member) => !member.sourceActorId).length >
            0 && (
            <div className="sales-editor-section">
              <strong>已加入成員</strong>
              <div className="roster-editor-list">
                {schedule.members
                  .filter((member) => !member.sourceActorId)
                  .map((member) => (
                    <div className="roster-editor-row" key={member.id}>
                      <strong>{member.name}</strong>
                      <span>
                        {member.kind === "supervisor" ? "主管" : "Sale"} · Team{" "}
                        {member.team}
                      </span>
                      <button
                        type="button"
                        className="sales-delete-link"
                        aria-label={`刪除 ${member.name}`}
                        onClick={() =>
                          run(
                            () =>
                              engine.deleteSalesRosterMember(
                                actor,
                                month,
                                member.id,
                              ),
                            `${member.name} 已刪除。`,
                          )
                        }
                      >
                        刪除
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
          <div className="roster-editor-add">
            <strong>新增成員</strong>
            <div className="form-grid two">
              <Field label="名稱" required>
                <select
                  aria-label="新成員名稱"
                  value={newMember.actorId}
                  onChange={(event) => {
                    const candidate = salesCandidates.find(
                      (item) => item.id === event.target.value,
                    );
                    setNewMember({
                      ...newMember,
                      actorId: event.target.value,
                      name: candidate?.name ?? "",
                      kind:
                        candidate?.role === "supervisor" ||
                        candidate?.role === "head"
                          ? "supervisor"
                          : "sales",
                    });
                  }}
                >
                  <option value="">選擇 Sales</option>
                  {salesCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {ROLE_NAMES[candidate.role]}
                    </option>
                  ))}
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
            <Button
              variant="primary"
              disabled={!newMember.actorId}
              onClick={() => {
                const saved = run(
                  () =>
                    engine.addSalesRosterMember(actor, month, newMember),
                  "已新增成員並自動排班。",
                );
                if (saved) {
                  setNewMember({ ...newMember, actorId: "", name: "" });
                }
              }}
            >
              新增並自動排班
            </Button>
          </div>
          <div className="dialog-actions">
            <Button variant="primary" onClick={() => setSalesEditor(false)}>
              完成
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
                value={cell.team}
                disabled={cell.mode === "off" || cell.mode === "ph"}
                onChange={(event) =>
                  setCell({ ...cell, team: event.target.value })
                }
              >
                {schedule.teams.map((team) => (
                  <option key={team.code} value={team.code}>
                    Team {team.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="更份" required>
              <select
                aria-label="更份"
                value={cell.mode}
                onChange={(event) =>
                  setCell({
                    ...cell,
                    mode: event.target.value as CellDraft["mode"],
                  })
                }
              >
                <option value="early">早更 9-6</option>
                <option value="normal">日常 10-7</option>
                <option value="off">Off 放假</option>
                <option value="ph">補假</option>
              </select>
            </Field>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setCell(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const assignment =
                  cell.mode === "off"
                    ? SALES_OFF_CODE
                    : cell.mode === "ph"
                      ? SALES_PH_CODE
                      : cell.team;
                run(
                  () =>
                    engine.setSalesShift(
                      actor,
                      cell.member.id,
                      cell.date,
                      assignment,
                      cell.mode === "early" || cell.mode === "normal"
                        ? cell.mode
                        : undefined,
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
          title={`${location.id ? "修改" : "新增"} Team ${location.team} 地點`}
          onClose={() => setLocation(null)}
        >
          <div className="form-grid two">
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
              <select
                aria-label="開始日期"
                value={location.startDate}
                onChange={(event) => {
                  const startDate = event.target.value;
                  setLocation({
                    ...location,
                    startDate,
                    endDate:
                      location.endDate >= startDate
                        ? location.endDate
                        : (days.find(
                            (day) =>
                              day.date >= startDate &&
                              !blockedLocationDates.has(day.date),
                          )?.date ?? startDate),
                  });
                }}
              >
                {days.map((day) => (
                  <option
                    key={day.date}
                    value={day.date}
                    disabled={blockedLocationDates.has(day.date)}
                  >
                    {dateOptionLabel(day.date)}
                    {blockedLocationDates.has(day.date)
                      ? "（已安排）"
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="結束日期" required>
              <select
                aria-label="結束日期"
                value={location.endDate}
                onChange={(event) =>
                  setLocation({ ...location, endDate: event.target.value })
                }
              >
                {days.map((day) => (
                  <option
                    key={day.date}
                    value={day.date}
                    disabled={
                      blockedLocationDates.has(day.date) ||
                      (!location.startDate
                        ? false
                        : day.date < location.startDate)
                    }
                  >
                    {dateOptionLabel(day.date)}
                    {blockedLocationDates.has(day.date)
                      ? "（已安排）"
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="sales-location-note">
            已安排地點的日期會停用；新增地點會由第一個未安排日期開始。
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setLocation(null)}>返回</Button>
            <Button
              variant="danger"
              disabled={!location.id}
              onClick={() => {
                if (!location.id) return;
                run(
                  () =>
                    engine.removeSalesTeamLocation(actor, location.id!),
                  "Team地點已取消。",
                );
                setLocation(null);
              }}
            >
              取消地點
            </Button>
            <Button
              variant="primary"
              disabled={
                !location.startDate ||
                !location.endDate ||
                !location.location.trim()
              }
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

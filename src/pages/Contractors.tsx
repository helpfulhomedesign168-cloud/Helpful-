import React, { useState } from "react";
import { Check, PenLine, Plus, Trash2 } from "lucide-react";
import { useApp } from "../context";
import {
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  Pagination,
  usePagination,
} from "../components/ui";
import { Resource, ResourceFeeMode, ResourceKind } from "../domain/types";

const FOREMAN_WORKS = [
  "判頭",
  "打拆",
  "清泥頭",
  "水喉",
  "電力",
  "泥水",
  "油漆",
  "潔具",
  "搭棚",
  "煤氣",
  "其他",
];
const WORKER_WORKS = [
  "油漆",
  "傢俬安裝",
  "雜工",
  "水電",
  "潔具",
  "搭棚",
  "煤氣",
  "其他",
];
const FEE_LABELS: Record<ResourceFeeMode, string> = {
  project60: "項目6成",
  daily: "日薪",
  fixed: "固定價",
};

function specialtyFor(kind: ResourceKind, work: string) {
  if (kind === "foreman") {
    if (work === "判頭") return "工程判頭";
    if (work === "打拆" || work === "清泥頭") return "打拆判頭";
    return `${work}判頭`;
  }
  if (work === "傢俬安裝") return "傢俬師傅";
  if (work === "雜工") return "雜工師傅";
  if (work === "水電") return "水電師傅";
  return `${work}師傅`;
}

function tradesFor(kind: ResourceKind, work: string): string[] {
  if (kind === "foreman" && work === "判頭")
    return ["打拆", "水喉", "電力", "泥水", "油漆"];
  if (work === "打拆" || work === "清泥頭") return ["打拆"];
  if (work === "水電") return ["水喉", "電力"];
  if (work === "潔具") return ["其他", "裝門"];
  if (work === "傢俬安裝") return ["傢俬"];
  if (["水喉", "電力", "泥水", "油漆"].includes(work)) return [work];
  return ["其他"];
}

function newResource(kind: ResourceKind = "foreman"): Resource {
  const work = kind === "foreman" ? "判頭" : "油漆";
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    type: kind === "foreman" ? "contractor" : "staff",
    trades: tradesFor(kind, work),
    active: true,
    kind,
    mainWork: work,
    specialty: specialtyFor(kind, work),
    scope: work,
    details: "",
    feeMode: "project60",
    feeAmount: 0,
    createdAt: new Date().toISOString(),
  };
}

export function Contractors() {
  const { actor, engine, run } = useApp();
  const [tab, setTab] = useState<"all" | ResourceKind>("all");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const canEdit =
    actor.role === "cs_supervisor" || actor.role === "admin";
  const allResources = engine
    .listResources(actor)
    .filter((resource) => resource.active && resource.kind)
    .sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    );
  const filtered = allResources.filter(
    (resource) => tab === "all" || resource.kind === tab,
  );
  const pager = usePagination(filtered, tab);
  const isExisting = Boolean(
    editing && allResources.some((resource) => resource.id === editing.id),
  );
  const set = (values: Partial<Resource>) =>
    setEditing((current) => (current ? { ...current, ...values } : null));
  const setKind = (kind: ResourceKind) => {
    const work = kind === "foreman" ? "判頭" : "油漆";
    set({
      kind,
      type: kind === "foreman" ? "contractor" : "staff",
      mainWork: work,
      specialty: specialtyFor(kind, work),
      scope: work,
      trades: tradesFor(kind, work),
    });
  };
  const setWork = (work: string) => {
    if (!editing?.kind) return;
    set({
      mainWork: work,
      specialty: specialtyFor(editing.kind, work),
      scope: work,
      trades: tradesFor(editing.kind, work),
    });
  };
  const works =
    editing?.kind === "worker" ? WORKER_WORKS : FOREMAN_WORKS;
  return (
    <>
      <PageHead title="工程師傅" />
      <div className="list-panel contractor-catalog">
        <div className="contractor-toolbar">
          <div className="service-tabs" role="tablist" aria-label="師傅性質">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={tab === "all" ? "active" : ""}
              onClick={() => setTab("all")}
            >
              全部
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "foreman"}
              className={tab === "foreman" ? "active" : ""}
              onClick={() => setTab("foreman")}
            >
              工程判頭
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "worker"}
              className={tab === "worker" ? "active" : ""}
              onClick={() => setTab("worker")}
            >
              師傅
            </button>
          </div>
          {canEdit && (
            <Button variant="primary" onClick={() => setEditing(newResource())}>
              <Plus size={20} />
              新增
            </Button>
          )}
        </div>
        {filtered.length === 0 ? (
          <Empty
            title="此分類未有師傅"
            description="可按右上角新增師傅。"
          />
        ) : (
          <div className="table-scroll">
            <table className="contractor-table">
              <thead>
                <tr>
                  <th>師傅稱呼</th>
                  <th>聯絡電話</th>
                  <th>收費</th>
                  <th>工程範圍</th>
                  {canEdit && <th>編輯</th>}
                </tr>
              </thead>
              <tbody>
                {pager.items.map((resource) => (
                  <tr key={resource.id}>
                    <td>
                      <strong>{resource.name}</strong>
                      <small>{resource.specialty}</small>
                    </td>
                    <td>{resource.phone}</td>
                    <td>
                      {resource.feeMode ? FEE_LABELS[resource.feeMode] : "—"}
                    </td>
                    <td>{resource.scope || "—"}</td>
                    {canEdit && (
                      <td>
                        <div className="service-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`修改${resource.name}`}
                            onClick={() => setEditing(structuredClone(resource))}
                          >
                            <PenLine size={20} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`刪除${resource.name}`}
                            onClick={() => setDeleting(resource)}
                          >
                            <Trash2 size={19} />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={pager.page}
          pages={pager.pages}
          total={pager.total}
          onChange={pager.setPage}
        />
      </div>
      {editing && (
        <Dialog
          wide
          title={isExisting ? "修改師傅" : "新增師傅"}
          onClose={() => setEditing(null)}
        >
          <div className="contractor-nature">
            <span className="field-label">師傅性質</span>
            <div className="measure-options">
              <label className="measure-option">
                <input
                  type="radio"
                  name="resource-kind"
                  checked={editing.kind === "foreman"}
                  onChange={() => setKind("foreman")}
                />
                判頭
              </label>
              <label className="measure-option">
                <input
                  type="radio"
                  name="resource-kind"
                  checked={editing.kind === "worker"}
                  onChange={() => setKind("worker")}
                />
                師傅
              </label>
            </div>
          </div>
          <div className="service-form-top">
            <Field label="師傅名稱" required>
              <input
                value={editing.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            <Field label="聯絡電話" required>
              <input
                value={editing.phone}
                onChange={(event) => set({ phone: event.target.value })}
              />
            </Field>
            <Field label="主項工程">
              <select
                value={editing.mainWork ?? ""}
                onChange={(event) => setWork(event.target.value)}
              >
                {works.map((work) => (
                  <option key={work}>{work}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="工程詳細">
            <textarea
              className="service-details-input"
              value={editing.details ?? ""}
              onChange={(event) => set({ details: event.target.value })}
            />
          </Field>
          <div className="contractor-fee">
            <div className="measure-head">
              <strong>收費方式</strong>
              <span>*決定好計算方式後，日後並不能更改。</span>
            </div>
            <div className="measure-options">
              {(
                [
                  ["project60", "項目6成"],
                  ["daily", "日薪"],
                  ["fixed", "固定價"],
                ] as Array<[ResourceFeeMode, string]>
              ).map(([value, label]) => (
                <label
                  className={`measure-option ${isExisting ? "locked" : ""}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="fee-mode"
                    checked={editing.feeMode === value}
                    disabled={isExisting}
                    onChange={() => set({ feeMode: value, feeAmount: 0 })}
                  />
                  {label}
                </label>
              ))}
            </div>
            {editing.feeMode === "project60" ? (
              <p className="contractor-fee-note">
                以公司所有工程項目零售價的6成價錢收費。
              </p>
            ) : (
              <div className="contractor-fee-input">
                <Field
                  label={editing.feeMode === "daily" ? "日工價錢" : "每項工程"}
                >
                  <input
                    type="number"
                    min="0"
                    value={editing.feeAmount || ""}
                    onChange={(event) =>
                      set({ feeAmount: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
            )}
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.saveContractor(actor, editing);
                  return true;
                }, "師傅資料已保存。");
                if (ok) setEditing(null);
              }}
            >
              <Check size={20} />
              儲存
            </Button>
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="刪除師傅" onClose={() => setDeleting(null)}>
          <p>確定刪除「{deleting.name}」？</p>
          <div className="dialog-actions">
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.deleteContractor(actor, deleting.id);
                  return true;
                }, "師傅已刪除。");
                if (ok) setDeleting(null);
              }}
            >
              刪除
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

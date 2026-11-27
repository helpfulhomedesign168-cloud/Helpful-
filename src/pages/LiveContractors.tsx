import React, { useEffect, useState } from "react";
import { Check, PenLine, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Button, Dialog, Empty, Field, PageHead, Pagination, usePagination } from "../components/ui";

type Kind = "foreman" | "worker";
type FeeMode = "project60" | "daily" | "fixed";
type Contractor = {
  id: string;
  name: string;
  phone: string | null;
  type: "contractor" | "staff";
  kind: Kind | null;
  specialty: string | null;
  mainWork: string | null;
  scope: string | null;
  details: string | null;
  trades: string[];
  feeMode: FeeMode | null;
  feeAmount: number;
  active: boolean;
};
const FOREMAN_WORKS = ["判頭","打拆","清泥頭","水喉","電力","泥水","油漆","潔具","搭棚","煤氣","其他"];
const WORKER_WORKS = ["油漆","傢俬安裝","雜工","水電","潔具","搭棚","煤氣","其他"];
const FEE_LABELS: Record<FeeMode, string> = { project60: "項目6成", daily: "日薪", fixed: "固定價" };
const specialtyFor = (kind: Kind, work: string) =>
  kind === "foreman"
    ? work === "判頭" ? "工程判頭" : work === "打拆" || work === "清泥頭" ? "打拆判頭" : `${work}判頭`
    : work === "傢俬安裝" ? "傢俬師傅" : work === "雜工" ? "雜工師傅" : work === "水電" ? "水電師傅" : `${work}師傅`;
const tradesFor = (kind: Kind, work: string) =>
  kind === "foreman" && work === "判頭" ? ["打拆","水喉","電力","泥水","油漆"]
  : work === "打拆" || work === "清泥頭" ? ["打拆"]
  : work === "水電" ? ["水喉","電力"]
  : work === "潔具" ? ["其他","裝門"]
  : work === "傢俬安裝" ? ["傢俬"]
  : ["水喉","電力","泥水","油漆"].includes(work) ? [work] : ["其他"];
function newResource(kind: Kind = "foreman"): Contractor {
  const work = kind === "foreman" ? "判頭" : "油漆";
  return { id: "", name: "", phone: "", type: kind === "foreman" ? "contractor" : "staff", kind, specialty: specialtyFor(kind, work), mainWork: work, scope: work, details: "", trades: tradesFor(kind, work), feeMode: "project60", feeAmount: 0, active: true };
}

export function LiveContractors() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<Contractor[]>([]);
  const [tab, setTab] = useState<"all" | Kind>("all");
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [deleting, setDeleting] = useState<Contractor | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = ["cs_supervisor", "admin", "admin_staff"].includes(user?.role ?? "");

  async function load() {
    try { setRows(await apiRequest<Contractor[]>("/contractors", accessToken)); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取師傅。"); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  const filtered = rows.filter((row) => row.active && row.kind && (tab === "all" || row.kind === tab)).sort((a, b) => (b.id || "").localeCompare(a.id || ""));
  const pager = usePagination(filtered, tab);
  const works = editing?.kind === "worker" ? WORKER_WORKS : FOREMAN_WORKS;
  const set = (values: Partial<Contractor>) => setEditing((current) => current ? { ...current, ...values } : null);
  const setKind = (kind: Kind) => {
    const work = kind === "foreman" ? "判頭" : "油漆";
    set({ kind, type: kind === "foreman" ? "contractor" : "staff", mainWork: work, specialty: specialtyFor(kind, work), scope: work, trades: tradesFor(kind, work) });
  };
  const setWork = (work: string) => {
    if (!editing?.kind) return;
    set({ mainWork: work, specialty: specialtyFor(editing.kind, work), scope: work, trades: tradesFor(editing.kind, work) });
  };
  async function save() {
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const body = JSON.stringify({ name: editing.name, phone: editing.phone, type: editing.type, kind: editing.kind, specialty: editing.specialty, mainWork: editing.mainWork, scope: editing.scope, details: editing.details, trades: editing.trades, feeMode: editing.feeMode, feeAmount: editing.feeAmount });
      if (editing.id) await apiRequest(`/contractors/${editing.id}`, accessToken, { method: "PATCH", body });
      else await apiRequest("/contractors", accessToken, { method: "POST", body });
      setEditing(null); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能儲存師傅。"); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting) return;
    try { await apiRequest(`/contractors/${deleting.id}`, accessToken, { method: "DELETE" }); setDeleting(null); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能刪除師傅。"); }
  }

  return (
    <>
      <PageHead title="工程師傅" />
      <div className="list-panel contractor-catalog">
        <div className="contractor-toolbar">
          <div className="service-tabs" role="tablist" aria-label="師傅性質">
            {([["all","全部"],["foreman","工程判頭"],["worker","師傅"]] as const).map(([key,label]) => <button type="button" role="tab" key={key} aria-selected={tab===key} className={tab===key?"active":""} onClick={() => setTab(key)}>{label}</button>)}
          </div>
          {canEdit && <Button variant="primary" onClick={() => setEditing(newResource())}><Plus size={20} /> 新增</Button>}
        </div>
        {error ? <Empty title="未能讀取師傅" description={error} /> : filtered.length === 0 ? <Empty title="此分類未有師傅" description="可按右上角新增師傅。" /> : (
          <div className="table-scroll"><table className="contractor-table"><thead><tr><th>師傅稱呼</th><th>聯絡電話</th><th>收費</th><th>工程範圍</th>{canEdit && <th>編輯</th>}</tr></thead><tbody>{pager.items.map((resource) => <tr key={resource.id}><td><strong>{resource.name}</strong><small>{resource.specialty}</small></td><td>{resource.phone || "—"}</td><td>{resource.feeMode ? FEE_LABELS[resource.feeMode] : "—"}</td><td>{resource.scope || "—"}</td>{canEdit && <td><div className="service-row-actions"><Button variant="ghost" aria-label={`修改${resource.name}`} onClick={() => setEditing(structuredClone(resource))}><PenLine size={20} /></Button><Button variant="ghost" aria-label={`刪除${resource.name}`} onClick={() => setDeleting(resource)}><Trash2 size={19} /></Button></div></td>}</tr>)}</tbody></table></div>
        )}
        <Pagination page={pager.page} pages={pager.pages} total={pager.total} onChange={pager.setPage} />
      </div>
      {editing && <Dialog wide title={editing.id ? "修改師傅" : "新增師傅"} onClose={() => setEditing(null)}>
        <div className="contractor-nature"><span className="field-label">師傅性質</span><div className="measure-options"><label className="measure-option"><input type="radio" name="resource-kind" checked={editing.kind==="foreman"} onChange={() => setKind("foreman")} />判頭</label><label className="measure-option"><input type="radio" name="resource-kind" checked={editing.kind==="worker"} onChange={() => setKind("worker")} />師傅</label></div></div>
        <div className="service-form-top"><Field label="師傅名稱" required><input value={editing.name} onChange={(e) => set({name:e.target.value})} /></Field><Field label="聯絡電話" required><input value={editing.phone ?? ""} onChange={(e) => set({phone:e.target.value})} /></Field><Field label="主項工程"><select value={editing.mainWork ?? ""} onChange={(e) => setWork(e.target.value)}>{works.map((work) => <option key={work}>{work}</option>)}</select></Field></div>
        <Field label="工程詳細"><textarea className="service-details-input" value={editing.details ?? ""} onChange={(e) => set({details:e.target.value})} /></Field>
        <div className="contractor-fee"><div className="measure-head"><strong>收費方式</strong><span>*決定好計算方式後，日後並不能更改。</span></div><div className="measure-options">{([["project60","項目6成"],["daily","日薪"],["fixed","固定價"]] as Array<[FeeMode,string]>).map(([value,label]) => <label className={`measure-option ${editing.id ? "locked" : ""}`} key={value}><input type="radio" name="fee-mode" checked={editing.feeMode===value} disabled={Boolean(editing.id)} onChange={() => set({feeMode:value, feeAmount:0})} />{label}</label>)}</div>{editing.feeMode === "project60" ? <p className="contractor-fee-note">以公司所有工程項目零售價的6成價錢收費。</p> : <div className="contractor-fee-input"><Field label={editing.feeMode === "daily" ? "日工價錢" : "每項工程"}><input type="number" min="0" value={editing.feeAmount / 100} onChange={(e) => set({feeAmount: Math.round((Number(e.target.value)||0)*100)})} /></Field></div>}</div>
        {error && <p className="auth-error">{error}</p>}
        <div className="dialog-actions"><Button onClick={() => setEditing(null)}>取消</Button><Button variant="primary" disabled={saving} onClick={() => void save()}><Check size={18} /> {saving ? "儲存中…" : "儲存"}</Button></div>
      </Dialog>}
      {deleting && <Dialog title="刪除師傅" onClose={() => setDeleting(null)}><p>確定刪除 <strong>{deleting.name}</strong>？已使用此師傅的工程紀錄不會被刪除。</p><div className="dialog-actions"><Button onClick={() => setDeleting(null)}>取消</Button><Button variant="danger" onClick={() => void remove()}>刪除</Button></div></Dialog>}
    </>
  );
}

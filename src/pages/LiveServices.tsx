import React, { useEffect, useState } from "react";
import { Check, PenLine, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, ApiError } from "../api/client";
import { Button, Dialog, Empty, Field, PageHead, Pagination, Search, usePagination } from "../components/ui";

type ServiceRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  priceCents: number;
  measure: "area" | "length" | "quantity" | "fixed";
  published: boolean;
  metadata: {
    scope?: string;
    details?: string;
    needsProductStyle?: boolean;
    minQty?: number;
    minAmount?: number;
    increment?: number;
    minScope?: "service" | "line";
    linkedServiceIds?: string[];
  } | null;
};
const SCOPES = ["廚房", "廁所", "全屋", "廳房", "露台", "花園", "其他"];
const MEASURES: Array<[ServiceRow["measure"], string]> = [["area", "面積(長X闊)"], ["length", "直呎"], ["fixed", "固定價"], ["quantity", "件數／套數"]];
const money = (cents: number) => `HK$${(cents / 100).toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function LiveServices() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tagEditor, setTagEditor] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagsToDelete, setTagsToDelete] = useState<string[]>([]);
  const [confirmTagDelete, setConfirmTagDelete] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState<ServiceRow | null>(null);
  const [linkPicker, setLinkPicker] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");
  async function load() {
    try {
      const [services, cats] = await Promise.all([
        apiRequest<ServiceRow[]>("/services", accessToken),
        apiRequest<Array<{ name: string }>>("/service-categories", accessToken),
      ]);
      setRows(services);
      setCategories(cats.map((item) => item.name));
      setError("");
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能讀取工程價目。"); }
  }
  useEffect(() => { void load(); }, [accessToken]);

  const visible = rows.filter((row) => (activeCategory === "全部" || row.category === activeCategory) && `${row.name}${row.code}${row.category}${row.metadata?.scope ?? ""}${row.metadata?.details ?? ""}`.includes(search));
  const pager = usePagination(visible, `${activeCategory}|${search}`);
  const set = (values: Partial<ServiceRow>) => setEditing((current) => current ? { ...current, ...values } : null);
  const setMeta = (values: Partial<NonNullable<ServiceRow["metadata"]>>) => setEditing((current) => current ? { ...current, metadata: { ...(current.metadata ?? {}), ...values } } : null);
  function newItem() {
    const category = activeCategory === "全部" ? categories[0] ?? "其他" : activeCategory;
    setEditing({ id: "", code: `S-${String(rows.length + 1).padStart(3, "0")}`, name: "", category, unit: "平方呎", priceCents: 0, measure: "area", published: true, metadata: { scope: "廚房", details: "", needsProductStyle: true, minQty: 0, minAmount: 0, increment: 0.5, minScope: "service", linkedServiceIds: [] } });
  }
  async function save() {
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const body = JSON.stringify({ code: editing.code, name: editing.name, category: editing.category, unit: editing.unit, priceCents: editing.priceCents, measure: editing.measure, published: true, metadata: editing.metadata ?? {} });
      if (editing.id) await apiRequest(`/services/${editing.id}`, accessToken, { method: "PATCH", body });
      else await apiRequest("/services", accessToken, { method: "POST", body });
      setEditing(null); await load();
    } catch (e) { setError(e instanceof ApiError ? e.message : "未能儲存工程項目。"); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting) return;
    try { await apiRequest(`/services/${deleting.id}`, accessToken, { method: "DELETE" }); setDeleting(null); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "未能刪除工程項目。"); }
  }
  const linked = (editing?.metadata?.linkedServiceIds ?? []).map((id) => rows.find((row) => row.id === id)).filter((row): row is ServiceRow => Boolean(row));
  const retailLabel = editing?.measure === "area" ? "零售價（HKD／平方呎）" : editing?.measure === "length" ? "零售價（HKD／直呎）" : editing?.measure === "quantity" ? "零售價／件" : "零售價";

  return (
    <>
      <PageHead title="工程價目" />
      <div className="list-panel service-catalog">
        <div className="service-tabs" role="tablist" aria-label="工程分類">
          <button type="button" role="tab" aria-selected={activeCategory === "全部"} className={activeCategory === "全部" ? "active" : ""} onClick={() => setActiveCategory("全部")}>全部</button>
          {categories.map((category) => <button type="button" role="tab" key={category} aria-selected={activeCategory === category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}項目</button>)}
          {canEdit && <button type="button" className="service-tags-edit" onClick={() => { setTagDraft(""); setTagsToDelete([]); setTagEditor(true); }}>編輯</button>}
        </div>
        <div className="service-toolbar"><Search value={search} onChange={setSearch} placeholder="搜尋工程名稱或代號" />{canEdit && <Button variant="primary" aria-label="新增工程項目" onClick={newItem}><Plus size={20} /> 新增項目</Button>}</div>
        {error ? <Empty title="未能讀取工程價目" description={error} /> : visible.length === 0 ? <Empty title="此分類未有工程項目" description="可按右上角「新增項目」加入，或切換其他分類。" /> : (
          <div className="table-scroll"><table className="service-table"><thead><tr><th>工程名稱</th><th>價格</th><th>低銷</th><th>工程範圍</th><th>編輯</th></tr></thead><tbody>{pager.items.map((row) => <tr key={row.id}><td><strong>{row.name}</strong>{row.metadata?.details && <small>{row.metadata.details}</small>}</td><td><strong>{money(row.priceCents)}</strong><small>每{row.unit}</small></td><td>{(row.metadata?.minQty ?? 0) > 0 ? `${row.metadata?.minQty}${row.unit}` : (row.metadata?.minAmount ?? 0) > 0 ? money(row.metadata!.minAmount! * 100) : "無"}</td><td>{row.metadata?.scope || "—"}</td><td>{canEdit && <div className="service-row-actions"><Button variant="ghost" onClick={() => { setEditing(structuredClone(row)); setLinkPicker(false); }} aria-label={`修改${row.name}`}><PenLine size={20} /></Button><Button variant="ghost" onClick={() => setDeleting(row)} aria-label={`刪除${row.name}`}><Trash2 size={19} /></Button></div>}</td></tr>)}</tbody></table></div>
        )}
        <Pagination page={pager.page} pages={pager.pages} total={pager.total} onChange={pager.setPage} />
      </div>
      {editing && <Dialog wide title={editing.id ? "修改工程項目" : "新增工程項目"} onClose={() => setEditing(null)}>
        <div className="service-form-top"><Field label="工程名稱" required><input value={editing.name} onChange={(e) => set({ name: e.target.value })} /></Field><Field label="工程分類" required><select value={editing.category} onChange={(e) => set({ category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></Field><Field label="工程範圍" required><select value={editing.metadata?.scope ?? ""} onChange={(e) => setMeta({ scope: e.target.value })}>{SCOPES.map((scope) => <option key={scope}>{scope}</option>)}</select></Field></div>
        <Field label="工程詳細"><textarea className="service-details-input" value={editing.metadata?.details ?? ""} onChange={(e) => setMeta({ details: e.target.value })} /></Field>
        <label className="checkbox-label service-style-option"><input type="checkbox" checked={editing.metadata?.needsProductStyle !== false} onChange={(e) => setMeta({ needsProductStyle: e.target.checked })} />需要選擇產品款式</label>
        <div className="measure-section"><div className="measure-head"><strong>計算方式</strong><span>*決定好計算方式後，日後並不能更改。</span></div><div className="measure-options">{MEASURES.map(([value, label]) => <label className={`measure-option ${editing.id ? "locked" : ""}`} key={value}><input type="radio" name="measure" checked={editing.measure === value} disabled={Boolean(editing.id)} onChange={() => set({ measure: value, unit: value === "area" ? "平方呎" : value === "length" ? "直呎" : value === "quantity" ? "件" : "項", metadata: { ...(editing.metadata ?? {}), minQty: value === "area" || value === "length" ? editing.metadata?.minQty ?? 0 : 0 } })} />{label}</label>)}</div></div>
        <div className="service-price-grid"><Field label={retailLabel} required><input type="number" min=".01" value={editing.priceCents / 100 || ""} onChange={(e) => set({ priceCents: Math.round((Number(e.target.value) || 0) * 100) })} /></Field>{(editing.measure === "area" || editing.measure === "length") && <Field label={editing.measure === "length" ? "低銷價（直呎）" : "低銷價（平方呎）"}><input type="number" min="0" value={editing.metadata?.minQty || ""} onChange={(e) => setMeta({ minQty: Number(e.target.value) })} /></Field>}<Field label="合併低銷價"><select value={editing.metadata?.minScope === "service" ? "可以" : "不可以"} onChange={(e) => setMeta({ minScope: e.target.value === "可以" ? "service" : "line" })}><option>可以</option><option>不可以</option></select></Field></div>
        <div className="linked-services"><strong>連貫工程</strong>{linked.map((service) => <div className="linked-row" key={service.id}><span><strong>{service.name}</strong><small>{service.metadata?.details}</small></span><button type="button" aria-label={`移除連貫工程${service.name}`} onClick={() => setMeta({ linkedServiceIds: (editing.metadata?.linkedServiceIds ?? []).filter((id) => id !== service.id) })}><X size={17} /></button></div>)}<button type="button" className="linked-add" onClick={() => setLinkPicker(true)}><Plus size={19} />新增連貫工程</button></div>
        {error && <p className="auth-error">{error}</p>}
        <div className="dialog-actions"><Button onClick={() => setEditing(null)}>取消</Button><Button variant="primary" disabled={saving} onClick={() => void save()}><Check size={20} /> {saving ? "儲存中…" : "儲存工程項目"}</Button></div>
      </Dialog>}
      {editing && linkPicker && <Dialog title="新增連貫工程" onClose={() => setLinkPicker(false)}><p className="dialog-intro">選擇要連貫的工程項目。只顯示分類、名稱及工程詳細。</p><div className="linked-picker">{categories.map((category) => { const items = rows.filter((row) => row.category === category && row.id !== editing.id); if (!items.length) return null; return <div className="linked-picker-group" key={category}><h4>{category}項目</h4>{items.map((service) => <label className="linked-option" key={service.id}><input type="checkbox" checked={(editing.metadata?.linkedServiceIds ?? []).includes(service.id)} onChange={(e) => setMeta({ linkedServiceIds: e.target.checked ? [...(editing.metadata?.linkedServiceIds ?? []), service.id] : (editing.metadata?.linkedServiceIds ?? []).filter((id) => id !== service.id) })} /><span><strong>{service.name}</strong>{service.metadata?.details && <small>{service.metadata.details}</small>}</span></label>)}</div>; })}</div><div className="dialog-actions"><Button variant="primary" onClick={() => setLinkPicker(false)}>完成</Button></div></Dialog>}
      {tagEditor && <Dialog title="編輯工程分類" onClose={() => setTagEditor(false)}>
        <div className="tag-editor-add"><label className="field-label">新增項目</label><div className="tag-add-row"><input aria-label="新增分類名稱" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="輸入新分類名稱" /><Button variant="primary" disabled={!tagDraft.trim()} onClick={async () => {
          try {
            await apiRequest("/service-categories", accessToken, { method: "POST", body: JSON.stringify({ name: tagDraft.trim() }) });
            setTagDraft(""); setActiveCategory(tagDraft.trim()); await load();
          } catch (e) { setError(e instanceof ApiError ? e.message : "未能新增分類。"); }
        }}>新增</Button></div></div>
        <div className="tag-editor-delete"><h4>刪除項目</h4>{categories.map((category) => <label className="tag-delete-row" key={category}><span>{category}項目</span><input type="checkbox" checked={tagsToDelete.includes(category)} onChange={(e) => setTagsToDelete(e.target.checked ? [...tagsToDelete, category] : tagsToDelete.filter((item) => item !== category))} /></label>)}</div>
        <div className="dialog-actions"><Button disabled={!tagsToDelete.length} onClick={() => setConfirmTagDelete(true)}>刪除</Button><Button onClick={() => setTagEditor(false)}>取消</Button></div>
      </Dialog>}
      {confirmTagDelete && <Dialog title="確認刪除" onClose={() => setConfirmTagDelete(false)}><p>是否確定真的要刪除{tagsToDelete.map((category) => `${category}項目`).join("、")}？一旦刪除，工程項目入面的工程全部都會一齊刪除掉。</p><div className="dialog-actions"><Button onClick={() => setConfirmTagDelete(false)}>取消</Button><Button variant="primary" onClick={async () => {
        try {
          await apiRequest("/service-categories/delete", accessToken, { method: "POST", body: JSON.stringify({ names: tagsToDelete }) });
          if (tagsToDelete.includes(activeCategory)) setActiveCategory("全部");
          setTagsToDelete([]); setConfirmTagDelete(false); setTagEditor(false); await load();
        } catch (e) { setError(e instanceof ApiError ? e.message : "未能刪除分類。"); }
      }}>刪除</Button></div></Dialog>}
      {deleting && <Dialog title="刪除工程項目" onClose={() => setDeleting(null)}><p>確定刪除 <strong>{deleting.name}</strong>？</p><div className="dialog-actions"><Button onClick={() => setDeleting(null)}>取消</Button><Button variant="danger" onClick={() => void remove()}>刪除</Button></div></Dialog>}
    </>
  );
}

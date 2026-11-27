import React, { useEffect, useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Badge, Button, Dialog, Empty, Field, PageHead, Search } from "../components/ui";
import { SUPPLIER_CATEGORIES } from "../domain/types";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  contact: string | null;
  contact2: string | null;
  phone2: string | null;
  address: string | null;
  categories: string[];
  hasProductStyles: boolean;
  logoUrl: string | null;
  active: boolean;
};

const emptyForm = {
  name: "",
  phone: "",
  contact: "",
  contact2: "",
  phone2: "",
  address: "",
  categories: [] as string[],
  hasProductStyles: true,
};

export function LiveSuppliers() {
  const { accessToken, user } = useAuth();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");

  async function load() {
    setLoading(true);
    try {
      setRows(await apiRequest<Supplier[]>("/suppliers", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取供應商。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [accessToken]);
  useEffect(() => () => { if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setLogoFile(null);
    setLogoPreview("");
    setError("");
    setOpen(true);
  }
  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      contact: supplier.contact ?? "",
      contact2: supplier.contact2 ?? "",
      phone2: supplier.phone2 ?? "",
      address: supplier.address ?? "",
      categories: supplier.categories ?? [],
      hasProductStyles: supplier.hasProductStyles,
    });
    setLogoFile(null);
    setLogoPreview(supplier.logoUrl ?? "");
    setError("");
    setOpen(true);
  }
  function toggleCategory(category: string) {
    setForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify({
        name: form.name,
        phone: form.phone || undefined,
        contact: form.contact || undefined,
        contact2: form.contact2 || undefined,
        phone2: form.phone2 || undefined,
        address: form.address || undefined,
        categories: form.categories,
        hasProductStyles: form.hasProductStyles,
      });
      let supplierId = editing?.id;
      if (editing) {
        await apiRequest(`/suppliers/${editing.id}`, accessToken, { method: "PATCH", body });
      } else {
        const created = await apiRequest<Supplier>("/suppliers", accessToken, { method: "POST", body });
        supplierId = created.id;
      }
      if (logoFile && supplierId) {
        const data = new FormData();
        data.append("file", logoFile);
        await apiUpload(`/suppliers/${supplierId}/logo`, accessToken, data);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能儲存供應商。");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(supplier: Supplier) {
    await apiRequest(`/suppliers/${supplier.id}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ active: !supplier.active }),
    });
    await load();
  }

  const visible = rows.filter((row) =>
    `${row.name} ${row.contact ?? ""} ${row.phone ?? ""} ${(row.categories ?? []).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead title="供應商" />
      <div className="list-panel">
        <div className="submission-toolbar">
          <Search value={search} onChange={setSearch} placeholder="搜尋供應商／聯絡人／供應項目" />
          {canEdit && <Button variant="primary" onClick={openCreate}><Plus size={18} /> 新增供應商</Button>}
        </div>
        {loading ? <p className="muted">正在讀取供應商…</p> : error ? <Empty title="未能讀取供應商" description={error} /> : visible.length === 0 ? <Empty title="暫無供應商" /> : (
          <div className="table-scroll"><table className="contractor-table supplier-table"><thead><tr><th>供應商</th><th>聯絡人</th><th>聯絡電話</th><th>供應項目</th><th>狀態</th>{canEdit && <th />}</tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><div className="supplier-name-cell">{row.logoUrl ? <img src={row.logoUrl} alt="" /> : <span className="supplier-logo-placeholder" />}<strong>{row.name}</strong></div>{row.address && <small>{row.address}</small>}</td><td>{row.contact || "—"}{row.contact2 && <small>{row.contact2}</small>}</td><td>{row.phone || "—"}{row.phone2 && <small>{row.phone2}</small>}</td><td>{(row.categories ?? []).length ? row.categories.join("、") : "—"}</td><td><Badge strong={row.active}>{row.active ? "啟用" : "停用"}</Badge></td>{canEdit && <td><Button variant="secondary" onClick={() => openEdit(row)}>修改</Button><Button variant="ghost" onClick={() => void toggle(row)}>{row.active ? "停用" : "啟用"}</Button></td>}</tr>)}</tbody></table></div>
        )}
      </div>
      {open && (
        <Dialog wide title={editing ? "修改供應商" : "新增供應商"} onClose={() => setOpen(false)}>
          <form onSubmit={save}>
            <div className="supplier-form-grid">
              <div className="supplier-logo-column">
                <span className="field-label">供應商Logo</span>
                <div className="supplier-logo-upload-wrap">
                  <button type="button" className="supplier-logo-upload" onClick={() => inputRef.current?.click()} disabled={saving}>
                    {logoPreview ? <img src={logoPreview} alt="供應商Logo" /> : <span>上載公司Logo</span>}
                  </button>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }} />
                </div>
              </div>
              <div className="supplier-main-fields">
                <Field label="供應商名稱" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
                <Field label="供應商地址"><textarea rows={5} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              </div>
            </div>
            <div className="form-grid two supplier-contact-grid">
              <Field label="聯絡人-1" required><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required /></Field>
              <Field label="聯絡電話-1" required><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Field>
              <Field label="聯絡人-2"><input value={form.contact2} onChange={(e) => setForm({ ...form, contact2: e.target.value })} /></Field>
              <Field label="聯絡電話-2"><input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} /></Field>
            </div>
            <div className="supplier-detail-block">
              <span className="field-label">供應項目</span>
              <div className="supplier-checkboxes">{SUPPLIER_CATEGORIES.map((category) => <label className="supplier-check" key={category}><input type="checkbox" checked={form.categories.includes(category)} onChange={() => toggleCategory(category)} />{category}</label>)}</div>
            </div>
            <div className="supplier-product-styles">
              <span className="field-label">產品款式</span>
              <div className="measure-options"><label className="measure-option"><input type="radio" name="supplier-product-styles" checked={form.hasProductStyles} onChange={() => setForm({ ...form, hasProductStyles: true })} />有</label><label className="measure-option"><input type="radio" name="supplier-product-styles" checked={!form.hasProductStyles} onChange={() => setForm({ ...form, hasProductStyles: false })} />沒有</label></div>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="dialog-actions"><Button type="button" onClick={() => setOpen(false)}>取消</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "儲存中…" : editing ? "儲存修改" : "建立供應商"}</Button></div>
          </form>
        </Dialog>
      )}
    </>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Button, Dialog, Empty, Field, PageHead } from "../components/ui";
import { SUPPLIER_CATEGORIES } from "../domain/types";

type Supplier = {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
  phone: string | null;
  contact2: string | null;
  phone2: string | null;
  categories: string[];
  logoUrl: string | null;
};
type StyleImage = { id: string; filename: string; url: string | null };
type Series = { id: string; name: string; images: StyleImage[] };

export function LiveProductStyles() {
  const { accessToken, user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");
  const selected = suppliers.find((supplier) => supplier.id === selectedId);

  async function loadSuppliers() {
    setLoading(true);
    try {
      setSuppliers(await apiRequest<Supplier[]>("/product-styles/suppliers", accessToken));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取供應商。");
    } finally {
      setLoading(false);
    }
  }
  async function loadSeries(id: string) {
    if (!id) { setSeries([]); return; }
    try {
      setSeries(await apiRequest<Series[]>(`/product-styles/suppliers/${id}/series`, accessToken));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取產品款式。");
    }
  }
  useEffect(() => { void loadSuppliers(); }, [accessToken]);
  useEffect(() => { void loadSeries(selectedId); }, [accessToken, selectedId]);

  async function createSeries(event: React.FormEvent) {
    event.preventDefault();
    if (!seriesName.trim() || !selectedId) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/product-styles/suppliers/${selectedId}/series`, accessToken, {
        method: "POST",
        body: JSON.stringify({ name: seriesName.trim() }),
      });
      setCreatingSeries(false);
      setSeriesName("");
      await loadSeries(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能新增系列。");
    } finally {
      setSaving(false);
    }
  }
  async function uploadImage(seriesId: string, file: File) {
    setUploading(seriesId);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      await apiUpload(`/product-styles/series/${seriesId}/images`, accessToken, data);
      await loadSeries(selectedId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "圖片上載失敗。");
    } finally {
      setUploading("");
    }
  }

  const filtered = suppliers.filter(
    (supplier) => category === "all" || supplier.categories.includes(category),
  );

  return (
    <>
      <PageHead title="產品款式" />
      {!selected ? (
        <div className="list-panel product-styles-panel">
          <div className="service-tabs" role="tablist" aria-label="產品分類">
            <button type="button" role="tab" aria-selected={category === "all"} className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>全部</button>
            {SUPPLIER_CATEGORIES.map((item) => <button type="button" role="tab" key={item} aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          {loading ? <p className="muted">正在讀取供應商…</p> : error ? <Empty title="未能讀取產品款式" description={error} /> : filtered.length === 0 ? <Empty title="此分類未有產品款式供應商" description="請先在供應商設定產品款式為「有」，並選擇相關供應項目。" /> : (
            <div className="product-style-suppliers">
              {filtered.map((supplier) => (
                <button type="button" className="product-supplier-card" key={supplier.id} onClick={() => setSelectedId(supplier.id)}>
                  {supplier.logoUrl ? <img className="product-style-logo" src={supplier.logoUrl} alt={supplier.name} /> : <span className="product-style-logo-placeholder">H</span>}
                  <strong>{supplier.name}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="product-styles-detail">
          <button type="button" className="text-button product-styles-back" onClick={() => setSelectedId("")}><ArrowLeft size={18} /> 返回供應商</button>
          <div className="product-styles-layout">
            <aside className="product-style-supplier">
              {selected.logoUrl ? <img className="product-style-logo" src={selected.logoUrl} alt={selected.name} /> : <span className="product-style-logo-placeholder">H</span>}
              <h2>{selected.name}</h2>
              <p>{selected.address || "地址待補"}</p>
              <span>聯絡人-1</span><strong>{selected.contact || "—"}</strong>
              <span>聯絡電話-1</span><strong>{selected.phone || "—"}</strong>
              {selected.contact2 && <><span>聯絡人-2</span><strong>{selected.contact2}</strong></>}
              {selected.phone2 && <><span>聯絡電話-2</span><strong>{selected.phone2}</strong></>}
            </aside>
            <section className="product-style-content">
              <div className="product-style-toolbar"><h2>顏色系列</h2>{canEdit && <Button variant="primary" onClick={() => { setSeriesName(""); setCreatingSeries(true); }}><Plus size={19} /> 新增</Button>}</div>
              {series.length === 0 ? <div className="product-style-empty"><p>尚未新增產品款式系列。</p>{canEdit && <button type="button" className="style-upload-tile" onClick={() => setCreatingSeries(true)}>新增系列</button>}</div> : (
                <div className="product-style-series-list">
                  {series.map((item) => (
                    <div className="product-style-series" key={item.id}>
                      <h3>{item.name}</h3>
                      <div className="product-style-images">
                        {item.images.map((image) => <figure className="product-style-photo" key={image.id}>{image.url ? <img src={image.url} alt={image.filename} loading="lazy" /> : <div className="product-style-missing">圖片未能載入</div>}<figcaption>{image.filename}</figcaption></figure>)}
                        {canEdit && <button type="button" className="style-upload-tile" disabled={uploading === item.id} onClick={() => uploadRefs.current[item.id]?.click()}>{uploading === item.id ? "上載中…" : <><Upload size={16} /> 上載圖片</>}</button>}
                        <input ref={(element) => { uploadRefs.current[item.id] = element; }} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(item.id, file); event.target.value = ""; }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {creatingSeries && (
        <Dialog title="新增產品款式" onClose={() => setCreatingSeries(false)}>
          <form onSubmit={createSeries}>
            <Field label="款式名稱" required><input value={seriesName} onChange={(event) => setSeriesName(event.target.value)} placeholder="例如：顏色系列" required /></Field>
            {error && <p className="auth-error">{error}</p>}
            <div className="dialog-actions"><Button type="button" onClick={() => setCreatingSeries(false)}>取消</Button><Button type="submit" variant="primary" disabled={saving || !seriesName.trim()}>{saving ? "儲存中…" : "儲存"}</Button></div>
          </form>
        </Dialog>
      )}
    </>
  );
}

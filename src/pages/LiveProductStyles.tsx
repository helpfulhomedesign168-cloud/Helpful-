import React, { useEffect, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { useAuth } from "../auth";
import { apiRequest, apiUpload, ApiError } from "../api/client";
import { Button, Empty, PageHead } from "../components/ui";

type Supplier = { id: string; name: string; active: boolean };
type StyleImage = { id: string; filename: string; url: string | null };
type Series = { id: string; name: string; images: StyleImage[] };

export function LiveProductStyles() {
  const { accessToken, user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [newSeries, setNewSeries] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = ["admin", "admin_staff"].includes(user?.role ?? "");

  async function loadSuppliers() {
    try {
      const rows = await apiRequest<Supplier[]>("/product-styles/suppliers", accessToken);
      setSuppliers(rows);
      setSupplierId((current) => current || rows[0]?.id || "");
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
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "未能讀取產品款式。");
    }
  }
  useEffect(() => { void loadSuppliers(); }, [accessToken]);
  useEffect(() => { void loadSeries(supplierId); }, [accessToken, supplierId]);

  async function createSeries(event: React.FormEvent) {
    event.preventDefault();
    if (!newSeries.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/product-styles/suppliers/${supplierId}/series`, accessToken, {
        method: "POST",
        body: JSON.stringify({ name: newSeries.trim() }),
      });
      setNewSeries("");
      await loadSeries(supplierId);
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
      const form = new FormData();
      form.append("file", file);
      await apiUpload(`/product-styles/series/${seriesId}/images`, accessToken, form);
      await loadSeries(supplierId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "圖片上載失敗。");
    } finally {
      setUploading("");
    }
  }

  return (
    <>
      <PageHead title="產品款式" />
      <div className="list-panel product-styles-panel">
        {loading ? <p className="muted">正在讀取供應商…</p> : error ? <Empty title="未能讀取產品款式" description={error} /> : suppliers.length === 0 ? <Empty title="暫無供應商" description="請先在供應商頁新增供應商。" /> : (
          <>
            <div className="submission-toolbar">
              <select aria-label="供應商" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.active ? "" : "（停用）"}</option>)}
              </select>
            </div>
            {canEdit && (
              <form className="submission-toolbar" onSubmit={createSeries}>
                <input value={newSeries} onChange={(e) => setNewSeries(e.target.value)} placeholder="新系列名稱，例如：北歐白橡" />
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "新增中…" : "新增系列"}</Button>
              </form>
            )}
            {series.length === 0 ? <p className="muted">此供應商未有產品系列。</p> : series.map((group) => (
              <section key={group.id} className="product-style-series">
                <div className="submission-toolbar"><h2>{group.name}</h2>
                  {canEdit && <label className="button button-secondary file-button"><Upload size={16} /> {uploading === group.id ? "上載中…" : "上載圖片"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(group.id, file); e.target.value = ""; }} /></label>}
                </div>
                {group.images.length === 0 ? <p className="muted">未有圖片。</p> : <div className="product-style-grid">{group.images.map((image) => <figure key={image.id}>{image.url ? <img src={image.url} alt={image.filename} loading="lazy" /> : <div className="product-style-missing">圖片未能載入</div>}<figcaption>{image.filename}</figcaption></figure>)}</div>}
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

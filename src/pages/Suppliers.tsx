import React, { useEffect, useState } from "react";
import { Check, PenLine, Plus, Trash2 } from "lucide-react";
import { getAttachmentBlob, useApp } from "../context";
import {
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  Pagination,
  UploadField,
  usePagination,
} from "../components/ui";
import { Attachment, SUPPLIER_CATEGORIES, Supplier } from "../domain/types";

function SupplierLogo({ attachment }: { attachment?: Attachment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setUrl(undefined);
    if (!attachment) return;
    getAttachmentBlob(attachment).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment?.id]);
  if (!attachment || !url) return null;
  return <img className="supplier-logo" src={url} alt={`${attachment.name} logo`} />;
}

function newSupplier(): Supplier {
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    contact: "",
    address: "",
    categories: [],
    hasProductStyles: true,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function Suppliers() {
  const { actor, engine, run } = useApp();
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const canEdit =
    actor.role === "cs_supervisor" || actor.role === "admin";
  const all = engine.listSuppliers(actor);
  const filtered = all.filter(
    (supplier) => tab === "all" || supplier.categories.includes(tab),
  );
  const pager = usePagination(filtered, tab);
  const isExisting = Boolean(
    editing && all.some((supplier) => supplier.id === editing.id),
  );
  const set = (values: Partial<Supplier>) =>
    setEditing((current) => (current ? { ...current, ...values } : null));
  const toggleCategory = (category: string) => {
    if (!editing) return;
    set({
      categories: editing.categories.includes(category)
        ? editing.categories.filter((item) => item !== category)
        : [...editing.categories, category],
    });
  };
  return (
    <>
      <PageHead title="供應商" />
      <div className="list-panel contractor-catalog">
        <div className="contractor-toolbar">
          <div className="service-tabs" role="tablist" aria-label="供應分類">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={tab === "all" ? "active" : ""}
              onClick={() => setTab("all")}
            >
              全部
            </button>
            {SUPPLIER_CATEGORIES.map((category) => (
              <button
                type="button"
                role="tab"
                key={category}
                aria-selected={tab === category}
                className={tab === category ? "active" : ""}
                onClick={() => setTab(category)}
              >
                {category}
              </button>
            ))}
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => setEditing(newSupplier())}
            >
              <Plus size={20} />
              新增
            </Button>
          )}
        </div>
        {filtered.length === 0 ? (
          <Empty
            title="此分類未有供應商"
            description="可按右上角新增供應商。"
          />
        ) : (
          <div className="table-scroll">
            <table className="contractor-table supplier-table">
              <thead>
                <tr>
                  <th>供應商</th>
                  <th>聯絡電話</th>
                  <th>聯絡人</th>
                  <th>主理供應</th>
                  {canEdit && <th>編輯</th>}
                </tr>
              </thead>
              <tbody>
                {pager.items.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="supplier-name-cell">
                        <SupplierLogo attachment={supplier.logo} />
                        <strong>{supplier.name}</strong>
                      </div>
                    </td>
                    <td>{supplier.phone}</td>
                    <td>{supplier.contact}</td>
                    <td>
                      {supplier.supply ||
                        supplier.categories.join(", ")}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="service-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`修改${supplier.name}`}
                            onClick={() =>
                              setEditing(structuredClone(supplier))
                            }
                          >
                            <PenLine size={20} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`刪除${supplier.name}`}
                            onClick={() => setDeleting(supplier)}
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
          title={isExisting ? "修改供應商" : "新增供應商"}
          onClose={() => setEditing(null)}
        >
          <div className="service-form-top">
            <Field label="供應商名稱" required>
              <input
                value={editing.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            <Field label="聯絡人" required>
              <input
                value={editing.contact}
                onChange={(event) => set({ contact: event.target.value })}
              />
            </Field>
            <Field label="聯絡電話" required>
              <input
                value={editing.phone}
                onChange={(event) => set({ phone: event.target.value })}
              />
            </Field>
          </div>
          <div className="form-grid two supplier-address-logo">
            <Field label="公司地址">
              <input
                value={editing.address ?? ""}
                onChange={(event) => set({ address: event.target.value })}
              />
            </Field>
            <Field label="公司 Logo">
              <UploadField
                label="上載公司 Logo"
                attachment={editing.logo}
                onSave={(logo) => set({ logo })}
              />
            </Field>
          </div>
          <div className="supplier-detail-block">
            <span className="field-label">工程詳細</span>
            <div className="supplier-checkboxes">
              {SUPPLIER_CATEGORIES.map((category) => (
                <label className="supplier-check" key={category}>
                  <input
                    type="checkbox"
                    checked={editing.categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                  />
                  {category}
                </label>
              ))}
            </div>
          </div>
          <div className="supplier-product-styles">
            <span className="field-label">產品款式</span>
            <div className="measure-options">
              <label className="measure-option">
                <input
                  type="radio"
                  name="supplier-product-styles"
                  checked={editing.hasProductStyles}
                  onChange={() => set({ hasProductStyles: true })}
                />
                有
              </label>
              <label className="measure-option">
                <input
                  type="radio"
                  name="supplier-product-styles"
                  checked={!editing.hasProductStyles}
                  onChange={() => set({ hasProductStyles: false })}
                />
                沒有
              </label>
            </div>
          </div>
          <div className="dialog-actions">
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.saveSupplier(actor, editing);
                  return true;
                }, "供應商資料已保存。");
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
        <Dialog title="刪除供應商" onClose={() => setDeleting(null)}>
          <p>確定刪除「{deleting.name}」？</p>
          <div className="dialog-actions">
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              variant="primary"
              onClick={() => {
                const ok = run(() => {
                  engine.deleteSupplier(actor, deleting.id);
                  return true;
                }, "供應商已刪除。");
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

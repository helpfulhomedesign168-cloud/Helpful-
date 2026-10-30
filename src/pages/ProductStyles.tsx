import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { getAttachmentBlob, useApp } from "../context";
import {
  Button,
  Dialog,
  Empty,
  Field,
  PageHead,
  UploadField,
} from "../components/ui";
import {
  Attachment,
  ProductStyleImage,
  ProductStyleSeries,
  ProductStyleSupplier,
  SUPPLIER_CATEGORIES,
  Supplier,
} from "../domain/types";

function Logo({
  attachment,
  large = false,
}: {
  attachment?: Attachment;
  large?: boolean;
}) {
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
  if (!url)
    return (
      <div
        className={`product-style-logo-placeholder ${large ? "large" : ""}`}
      >
        {large ? "LOGO" : "H"}
      </div>
    );
  return (
    <img
      className={`product-style-logo ${large ? "large" : ""}`}
      src={url}
      alt="供應商Logo"
    />
  );
}

function StylePhoto({ image }: { image: ProductStyleImage }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    getAttachmentBlob(image.attachment).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.attachment.id]);
  return (
    <figure className="product-style-photo">
      <div className="product-style-photo-frame">
        {url ? <img src={url} alt={image.productCode} /> : <span>圖片</span>}
      </div>
      <figcaption>{image.productCode}</figcaption>
    </figure>
  );
}

function AdminProductStyles() {
  const { actor, engine, run } = useApp();
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [catalogueName, setCatalogueName] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [imageSeries, setImageSeries] = useState<ProductStyleSeries | null>(null);
  const [imageAttachment, setImageAttachment] = useState<Attachment>();
  const [productCode, setProductCode] = useState("");
  const suppliers = engine.listSuppliers(actor).filter(
    (supplier) => supplier.hasProductStyles,
  );
  const selected = suppliers.find((supplier) => supplier.id === selectedId);
  const filtered = suppliers.filter(
    (supplier) =>
      category === "all" || supplier.categories.includes(category),
  );
  const series = selected
    ? engine.listProductStyles(actor, selected.id)
    : [];
  useEffect(() => {
    setCatalogueName(selected?.catalogueName ?? "");
  }, [selected?.id, selected?.catalogueName]);
  const saveCatalogueName = () => {
    if (!selected || catalogueName === (selected.catalogueName ?? "")) return;
    run(
      () => engine.saveSupplier(actor, { ...selected, catalogueName }),
      "小冊子名稱已保存。",
    );
  };
  const closeImage = () => {
    setImageSeries(null);
    setImageAttachment(undefined);
    setProductCode("");
  };
  return (
    <>
      <PageHead title="產品款式" />
      {!selected ? (
        <div className="list-panel product-styles-panel">
          <div className="service-tabs" role="tablist" aria-label="產品分類">
            <button
              type="button"
              role="tab"
              aria-selected={category === "all"}
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              全部
            </button>
            {SUPPLIER_CATEGORIES.map((item) => (
              <button
                type="button"
                role="tab"
                key={item}
                aria-selected={category === item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <Empty
              title="此分類未有產品款式供應商"
              description="請先在供應商設定產品款式為「有」，並選擇相關供應項目。"
            />
          ) : (
            <div className="product-style-suppliers">
              {filtered.map((supplier) => (
                <button
                  type="button"
                  className="product-supplier-card"
                  key={supplier.id}
                  onClick={() => setSelectedId(supplier.id)}
                >
                  <Logo attachment={supplier.logo} />
                  <strong>{supplier.name}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="product-styles-detail">
          <button
            type="button"
            className="text-button product-styles-back"
            onClick={() => setSelectedId("")}
          >
            <ArrowLeft size={18} /> 返回供應商
          </button>
          <div className="product-styles-layout">
            <aside className="product-style-supplier">
              <Logo attachment={selected.logo} large />
              <h2>{selected.name}</h2>
              <p>{selected.address || "地址待補"}</p>
              <span>聯絡人-1</span>
              <strong>{selected.contact || "—"}</strong>
              <span>聯絡電話-1</span>
              <strong>{selected.phone || "—"}</strong>
              {selected.contact2 && (
                <>
                  <span>聯絡人-2</span>
                  <strong>{selected.contact2}</strong>
                </>
              )}
              {selected.phone2 && (
                <>
                  <span>聯絡電話-2</span>
                  <strong>{selected.phone2}</strong>
                </>
              )}
              <label className="product-catalogue-name">
                <span>小冊子顯示為</span>
                <input
                  value={catalogueName}
                  onChange={(event) => setCatalogueName(event.target.value)}
                  onBlur={saveCatalogueName}
                />
              </label>
            </aside>
            <section className="product-style-content">
              <div className="product-style-toolbar">
                <h2>顏色系列</h2>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSeriesName("");
                    setCreatingSeries(true);
                  }}
                >
                  <Plus size={19} /> 新增
                </Button>
              </div>
              {series.length === 0 ? (
                <div className="product-style-empty">
                  <p>尚未新增產品款式系列。</p>
                  <button
                    type="button"
                    className="style-upload-tile"
                    onClick={() => {
                      setSeriesName("");
                      setCreatingSeries(true);
                    }}
                  >
                    新增系列
                  </button>
                </div>
              ) : (
                <div className="product-style-series-list">
                  {series.map((item) => (
                    <div className="product-style-series" key={item.id}>
                      <h3>{item.name}</h3>
                      <div className="product-style-images">
                        {item.images.map((image) => (
                          <StylePhoto image={image} key={image.id} />
                        ))}
                        <button
                          type="button"
                          className="style-upload-tile"
                          onClick={() => {
                            setImageSeries(item);
                            setImageAttachment(undefined);
                            setProductCode("");
                          }}
                        >
                          上載圖片
                        </button>
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
        <Dialog
          title="新增產品款式"
          onClose={() => setCreatingSeries(false)}
        >
          <Field label="款式名稱" required>
            <input
              value={seriesName}
              onChange={(event) => setSeriesName(event.target.value)}
              placeholder="例如：顏色系列"
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setCreatingSeries(false)}>取消</Button>
            <Button
              variant="primary"
              disabled={!seriesName.trim() || !selected}
              onClick={() => {
                if (!selected) return;
                const result = run(
                  () =>
                    engine.addProductStyleSeries(
                      actor,
                      selected.id,
                      seriesName,
                    ),
                  "產品款式已新增。",
                );
                if (result) setCreatingSeries(false);
              }}
            >
              <Check size={20} /> 儲存
            </Button>
          </div>
        </Dialog>
      )}
      {imageSeries && (
        <Dialog title="上載圖片" onClose={closeImage}>
          <div className="style-upload-area">
            <UploadField
              label="上載產品圖片"
              attachment={imageAttachment}
              onSave={setImageAttachment}
              onClear={() => setImageAttachment(undefined)}
            />
          </div>
          <Field label="產品編號" required>
            <input
              value={productCode}
              onChange={(event) => setProductCode(event.target.value)}
            />
          </Field>
          <div className="dialog-actions">
            <Button onClick={closeImage}>取消</Button>
            <Button
              variant="primary"
              disabled={!imageAttachment || !productCode.trim()}
              onClick={() => {
                if (!imageAttachment) return;
                const result = run(
                  () =>
                    engine.addProductStyleImage(
                      actor,
                      imageSeries.id,
                      imageAttachment,
                      productCode,
                    ),
                  "產品圖片已新增。",
                );
                if (result) closeImage();
              }}
            >
              <Check size={20} /> 儲存
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}


export function ProductStyles() {
  const { actor } = useApp();
  return actor.role === "admin" ? (
    <AdminProductStyles />
  ) : (
    <SalesProductStyles />
  );
}

function SalesProductStyles() {
  const { actor, engine } = useApp();
  const [category, setCategory] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const suppliers = engine.listProductStyleSuppliers(actor);
  const filtered = suppliers.filter(
    (supplier) =>
      category === "all" || supplier.categories.includes(category),
  );
  const selected = suppliers.find((supplier) => supplier.id === selectedId);
  const series = selected
    ? engine.listProductStyles(actor, selected.id)
    : [];
  return (
    <>
      <PageHead title="產品款式" />
      {!selected ? (
        <div className="list-panel product-styles-panel">
          <div className="service-tabs" role="tablist" aria-label="產品分類">
            <button
              type="button"
              role="tab"
              aria-selected={category === "all"}
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              全部
            </button>
            {SUPPLIER_CATEGORIES.map((item) => (
              <button
                type="button"
                role="tab"
                key={item}
                aria-selected={category === item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <Empty
              title="此分類未有產品款式"
              description="產品款式由Super Admin建立後會在這裏顯示。"
            />
          ) : (
            <div className="sales-product-suppliers">
              {filtered.map((supplier) => (
                <button
                  type="button"
                  className="sales-style-factory"
                  key={supplier.id}
                  onClick={() => setSelectedId(supplier.id)}
                >
                  {supplier.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="product-styles-detail">
          <button
            type="button"
            className="text-button product-styles-back"
            onClick={() => setSelectedId("")}
          >
            <ArrowLeft size={18} /> 返回產品款式
          </button>
          <div className="sales-product-style-layout">
            <aside className="sales-style-factory-card">
              {selected.name}
            </aside>
            <section className="product-style-content sales-style-content">
              <div className="product-style-toolbar">
                <h2>顏色系列</h2>
              </div>
              {series.length === 0 ? (
                <div className="product-style-empty">
                  <p>尚未新增產品款式。</p>
                </div>
              ) : (
                <div className="product-style-series-list">
                  {series.map((item) => (
                    <div className="product-style-series" key={item.id}>
                      <h3>{item.name}</h3>
                      <div className="product-style-images">
                        {item.images.map((image) => (
                          <StylePhoto image={image} key={image.id} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

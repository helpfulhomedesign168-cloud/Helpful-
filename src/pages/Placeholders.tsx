import React from "react";
import { Empty, PageHead } from "../components/ui";

function ModulePlaceholder({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <>
      <PageHead eyebrow={eyebrow} title={title} />
      <div className="list-panel">
        <Empty
          title="此模組尚未建立"
          description="這個入口已預留，稍後會在這裏逐步加入相關功能。"
        />
      </div>
    </>
  );
}

export function Suppliers() {
  return <ModulePlaceholder eyebrow="工程營運" title="供應商" />;
}

export function ProductStyles() {
  return <ModulePlaceholder eyebrow="工程營運" title="產品款式" />;
}

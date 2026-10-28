import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  AlertCircle,
  FileText,
  Upload,
  ChevronRight,
} from "lucide-react";
import {
  Attachment,
  Eligibility,
  Quote,
  currentVersion,
} from "../domain/types";
import {
  sampleAttachment,
  saveAttachment,
  showAttachment,
  useApp,
} from "../context";
export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button {...props} className={`btn btn-${variant} ${className}`}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <span className={`badge ${strong ? "badge-strong" : ""}`}>{children}</span>
  );
}
export function Field({
  label,
  required = false,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && (
          <span aria-hidden="true" className="required">
            ＊
          </span>
        )}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
export function Section({
  number,
  title,
  action,
  children,
  className = "",
}: {
  number?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`section ${className}`}>
      <div className="section-head">
        <h2>
          {number && <span className="section-number">{number}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={36} strokeWidth={1.3} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab") {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
    // Intentionally only on mount; onClose is kept current through onCloseRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`dialog ${wide ? "dialog-wide" : ""}`}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="關閉對話框">
            <X size={22} />
          </Button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
export const LIST_PAGE_SIZE = 12;

export function usePagination<T>(items: T[], resetKey?: string) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    total: items.length,
    items: items.slice((current - 1) * LIST_PAGE_SIZE, current * LIST_PAGE_SIZE),
    setPage,
  };
}

export function Pagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span>共 {total} 項</span>
      <button
        type="button"
        className="pagination-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一頁
      </button>
      <span>
        第 {page} / {pages} 頁
      </span>
      <button
        type="button"
        className="pagination-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        下一頁
      </button>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function Notice() {
  const { notice, dismiss } = useApp();
  if (!notice) return null;
  return (
    <div
      role={notice.error ? "alert" : "status"}
      className={`notice ${notice.error ? "notice-error" : ""}`}
    >
      <AlertCircle size={22} />
      <span>{notice.text}</span>
      <button aria-label="關閉提示" onClick={dismiss}>
        <X size={20} />
      </button>
    </div>
  );
}
export function Progress({ q, e }: { q: Quote; e: Eligibility }) {
  const v = currentVersion(q);
  const steps = [
    ["報價", true],
    ["客戶已簽", !!v.signature],
    ["交Office", e.hasSubmission],
  ] as const;
  return (
    <ol className="source-progress">
      {steps.map(([label, done], i) => (
        <li className={done ? "done" : ""} key={label}>
          <span>{done ? <Check size={16} /> : i + 1}</span>
          {label}
          {i < steps.length - 1 && (
            <ChevronRight className="progress-arrow" size={18} />
          )}
        </li>
      ))}
    </ol>
  );
}
export function UploadField({
  attachment,
  onSave,
  label = "上載文件",
  sample = false,
}: {
  attachment?: Attachment;
  onSave: (a: Attachment) => void;
  label?: string;
  sample?: boolean;
}) {
  const { run } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  async function select(file: File) {
    setBusy(true);
    try {
      const a = await saveAttachment(file);
      run(() => onSave(a), "檔案已保存。");
    } catch (e) {
      run(() => {
        throw e;
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function example() {
    setBusy(true);
    try {
      const a = await sampleAttachment(label);
      run(() => onSave(a), "示例測試檔案已保存。");
    } catch (e) {
      run(() => {
        throw e;
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="upload-field">
      {attachment && (
        <div className="attachment-name">
          <FileText size={20} />
          <span>{attachment.name}</span>
          <Button
            variant="ghost"
            onClick={() =>
              showAttachment(attachment).catch((e) =>
                run(() => {
                  throw e;
                }),
              )
            }
          >
            查看
          </Button>
        </div>
      )}
      <div className="inline-actions">
        <Button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={18} />
          {attachment ? "更換文件" : label}
        </Button>
        {sample && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={example}
          >
            使用示例檔
          </Button>
        )}
      </div>
      <input
        ref={input}
        aria-label={label}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf,.doc,.docx"
        onChange={(e) => {
          if (e.target.files?.[0]) select(e.target.files[0]);
        }}
      />
    </div>
  );
}
export function Search({
  value,
  onChange,
  placeholder = "搜尋",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      className="search"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

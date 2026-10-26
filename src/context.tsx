import React, {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { Engine } from "./domain/engine";
import { Actor, Attachment } from "./domain/types";
export const engine = new Engine(window.localStorage);
interface Notice {
  text: string;
  error: boolean;
}
interface Context {
  engine: Engine;
  actor: Actor;
  setActor: (id: string) => void;
  notice: Notice | null;
  dismiss: () => void;
  run: <T>(fn: () => T, message?: string) => T | undefined;
}
const Ctx = createContext<Context | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
  const [actorId, setId] = useState(
    localStorage.getItem("homeflow-actor") || "sales-mm",
  );
  const actor =
    engine.listActors().find((a) => a.id === actorId) || engine.listActors()[0];
  const [notice, setNotice] = useState<Notice | null>(
    engine.storageWarning ? { text: engine.storageWarning, error: true } : null,
  );
  function run<T>(fn: () => T, message?: string): T | undefined {
    try {
      const result = fn();
      setNotice(message ? { text: message, error: false } : null);
      return result;
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : "操作未完成，請稍後再試。",
        error: true,
      });
      return undefined;
    }
  }
  return (
    <Ctx.Provider
      value={{
        engine,
        actor,
        setActor: (id) => {
          localStorage.setItem("homeflow-actor", id);
          setId(id);
          setNotice(null);
        },
        notice,
        dismiss: () => setNotice(null),
        run,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error("App context missing");
  return value;
}
const openFiles = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open("homeflow-files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export async function saveAttachment(file: File): Promise<Attachment> {
  if (/heic|heif|video/i.test(file.type + file.name))
    throw new Error(
      "本原型只支援JPG、PNG、PDF等相片／文件；請先轉換HEIC，影片在線下處理。",
    );
  if (
    file.size > 20 * 1024 * 1024 ||
    (file.type.startsWith("image") && file.size > 10 * 1024 * 1024)
  )
    throw new Error("相片上限10MB，文件上限20MB。");
  const id = crypto.randomUUID();
  const db = await openFiles();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return {
    id,
    name: file.name,
    mime: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };
}
export async function showAttachment(a: Attachment) {
  const db = await openFiles();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const rq = db.transaction("files").objectStore("files").get(a.id);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
  db.close();
  if (!blob)
    throw new Error(
      "這是初始示例檔案記錄，未附真實原件。你可在報價詳情上載測試檔案。",
    );
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function sampleAttachment(kind = "簽署報價"): Promise<Attachment> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1000"><rect width="840" height="1000" fill="white"/><text x="60" y="100" font-size="38" fill="#151515">好幫手｜${kind}</text><text x="60" y="170" font-size="24">Demo測試文件 · 非正式單據</text><path d="M60 230H780" stroke="#222"/><text x="60" y="300" font-size="25">僅供測試附件、簽署記錄與角色交接流程。</text><text x="60" y="360" font-size="25">不代表真實客戶簽名，不具法律效力。</text><text x="60" y="760" font-size="32">示例簽署：Demo Customer</text><text x="60" y="840" font-size="24">2026-10-22</text></svg>`;
  return saveAttachment(
    new File([svg], `示例_${kind}.svg`, { type: "image/svg+xml" }),
  );
}

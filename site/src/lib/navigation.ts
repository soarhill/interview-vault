/**
 * 列表返回位置记忆：进详情前记录列表 URL 与滚动位置，返回时精确恢复。
 * HashRouter 下路由状态在 location.hash 内（形如 #/?q=react&page=2）。
 */
interface ListReturn {
  url: string;
  scrollY: number;
  detailPath: string;
  pending: boolean;
}
const storageKey = "interview-vault:list-return:v1";
const changeEvent = "interview-vault:list-return-changed";

export function subscribeListReturn(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}

export function readListReturn(detailPath?: string): ListReturn | null {
  try {
    const entry: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Partial<ListReturn>;
    if (
      typeof value.url !== "string" ||
      !/^\/(?:\?|$)/.test(value.url) ||
      typeof value.scrollY !== "number" ||
      !Number.isFinite(value.scrollY) ||
      typeof value.detailPath !== "string" ||
      typeof value.pending !== "boolean"
    )
      return null;
    if (detailPath && value.detailPath !== detailPath) return null;
    return value as ListReturn;
  } catch {
    return null;
  }
}

function save(entry: ListReturn): void {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(entry));
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    /* Browser history remains usable. */
  }
}

/** HashRouter 下取当前路由 URL（不含 # 前缀，形如 /?q=react&page=2）。 */
export function currentRouteUrl(): string {
  const hash = location.hash;
  return hash.startsWith("#") ? hash.slice(1) || "/" : "/";
}

export function rememberList(detailPath: string): void {
  save({
    url: currentRouteUrl(),
    scrollY: window.scrollY,
    detailPath,
    pending: true,
  });
}

export function markReturnPending(detailPath: string): void {
  const entry = readListReturn(detailPath);
  if (entry) save({ ...entry, pending: true });
}

export function finishRestore(): void {
  const entry = readListReturn();
  if (entry) save({ ...entry, pending: false });
}

interface ListReturn {
  url: string;
  scrollY: number;
  detailPath: string;
  pending: boolean;
  snippet?: string;
}
const storageKey = "interview-vault:list-return:v1";
const changeEvent = "interview-vault:list-return-changed";

export function subscribeListReturn(onChange: () => void): () => void {
  window.addEventListener(changeEvent, onChange);
  return () => window.removeEventListener(changeEvent, onChange);
}

export function readListReturn(detailPath?: string): ListReturn | null {
  try {
    const entry: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? "null",
    );
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
export function rememberList(detailPath: string, snippet?: string): void {
  save({
    url: location.pathname + location.search,
    scrollY: window.scrollY,
    detailPath,
    pending: true,
    snippet,
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

import type { ListQuery } from "./api/types";
export interface UrlState {
  companyId: string;
  positionCategory: string;
  recruitType: string;
  q: string;
  page: number;
}
export const recruitmentLabels = { INTERN: "实习", CAMPUS: "校招" } as const;
export function readUrlState(params: Pick<URLSearchParams, "get">): UrlState {
  const rawPage = params.get("page");
  return {
    companyId: params.get("companyId") ?? "",
    positionCategory: params.get("positionCategory") ?? "",
    recruitType: params.get("recruitType") ?? "",
    q: params.get("q") ?? "",
    page: rawPage === null ? 1 : Number(rawPage),
  };
}
export function listUrl(state: UrlState): string {
  const params = new URLSearchParams();
  for (const key of [
    "companyId",
    "positionCategory",
    "recruitType",
    "q",
  ] as const)
    if (state[key]) params.set(key, state[key]);
  if (state.page !== 1) params.set("page", String(state.page));
  return params.size ? `/?${params}` : "/";
}
export function changeFilter(
  state: UrlState,
  key: Exclude<keyof UrlState, "page">,
  value: string,
): UrlState {
  return { ...state, [key]: key === "q" ? value.trim() : value, page: 1 };
}
export function apiQuery(state: UrlState): ListQuery {
  return {
    companyId: state.companyId || undefined,
    positionCategory: state.positionCategory || undefined,
    recruitType: state.recruitType || undefined,
    q: state.q || undefined,
    page: state.page,
    // 24 = 3 列 ×8 行 = 2 列 ×12 行：列表网格每页永远铺满，不留空位
    size: 24,
  };
}
export function detailUrl(
  id: number,
  q = "",
  questionId?: number | null,
  followUpId?: number | null,
): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q);
  if (followUpId != null) params.set("followUpId", String(followUpId));
  return `/interview/${id}${params.size ? `?${params}` : ""}${questionId == null ? "" : `#question-${questionId}`}`;
}

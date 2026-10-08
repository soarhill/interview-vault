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
  for (const key of ["companyId", "positionCategory", "recruitType", "q"] as const)
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
/** 列表每页 24 = 3 列 ×8 行 = 2 列 ×12 行：网格每页铺满，不留空位。 */
export const PAGE_SIZE = 24;
/** 深链定位改为查询参数（HashRouter 下 # 已被路由占用）。 */
export function detailUrl(
  id: number,
  q = "",
  questionId?: number | null,
  followUpId?: number | null,
): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q);
  if (questionId != null) params.set("questionId", String(questionId));
  if (followUpId != null) params.set("followUpId", String(followUpId));
  return `/interview/${id}${params.size ? `?${params}` : ""}`;
}

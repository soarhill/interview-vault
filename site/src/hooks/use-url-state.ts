import { useNavigate, useSearchParams } from "react-router-dom";
import { changeFilter, listUrl, readUrlState, type UrlState } from "@/lib/url-state";

/** 列表筛选状态与 URL（HashRouter 的查询段）双向同步：刷新、分享、后退均可还原。 */
export function useUrlState() {
  const params = useSearchParams()[0];
  const navigate = useNavigate();
  const state = readUrlState(params);
  return {
    state,
    change: (key: Exclude<keyof UrlState, "page">, value: string) =>
      navigate(listUrl(changeFilter(state, key, value)), { replace: false }),
    page: (page: number) => navigate(listUrl({ ...state, page })),
    reset: () => navigate("/", { replace: false }),
  };
}

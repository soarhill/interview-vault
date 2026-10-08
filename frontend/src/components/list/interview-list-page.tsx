"use client";
import { useCallback } from "react";
import { listInterviews, listInterviewFilters } from "@/lib/api/interviews";
import { errorMessage } from "@/lib/api/errors";
import { apiQuery, listUrl } from "@/lib/url-state";
import { useUrlState } from "@/hooks/use-url-state";
import { useResource } from "@/hooks/use-resource";
import { useListRestore } from "@/hooks/use-list-restore";
import { SiteHeader } from "../shared/brand";
import { CheerBar } from "../shared/cheer-bar";
import { Loading, PageState } from "../shared/page-state";
import { ListHeader } from "./list-header";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { ResultSummary } from "./result-summary";
import { InterviewCard } from "./interview-card";
import { Pagination } from "./pagination";

export function InterviewListPage() {
  const { state, change, page, reset } = useUrlState();
  const {
    companyId,
    positionCategory,
    recruitType,
    q,
    page: currentPage,
  } = state;
  const url = listUrl(state);
  const hasCriteria = Boolean(
    companyId || positionCategory || recruitType || q,
  );
  const filtered = hasCriteria || currentPage !== 1;
  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = apiQuery({
        companyId,
        positionCategory,
        recruitType,
        q,
        page: currentPage,
      });
      const [list, filters] = await Promise.all([
        listInterviews(query, signal),
        listInterviewFilters(query, signal),
      ]);
      return { list, filters };
    },
    [companyId, positionCategory, recruitType, q, currentPage],
  );
  const resource = useResource(url, load);
  const loadScale = useCallback(async (signal: AbortSignal) => {
    const [list, filters] = await Promise.all([
      listInterviews({ size: 1 }, signal),
      listInterviewFilters({}, signal),
    ]);
    return { list, filters };
  }, []);
  const scaleResource = useResource("scale", loadScale, hasCriteria);
  // Without search/filter criteria, the visible response already contains global counts.
  const scale = hasCriteria ? scaleResource : resource;
  useListRestore(resource.status === "success", url);
  const data = resource.status === "success" ? resource.data : undefined;
  return (
    <>
      <SiteHeader />
      <main className="list-container">
        <section className="search-area">
          <ListHeader
            total={
              scale.status === "success" ? scale.data.list.total : undefined
            }
            companyCount={
              scale.status === "success"
                ? scale.data.filters.companies.length
                : undefined
            }
            loading={scale.status === "loading"}
          />
          <SearchBar key={q} q={q} onSearch={(value) => change("q", value)} />
        </section>
        {data ? (
          <FilterBar filters={data.filters} state={state} onChange={change} />
        ) : (
          resource.status === "loading" && (
            <div className="filter-placeholder" aria-hidden="true">
              <div className="skeleton w-4/5" />
              <div className="skeleton w-3/5" />
              <div className="skeleton w-1/2" />
            </div>
          )
        )}
        <ResultSummary
          total={data?.list.total}
          filtered={filtered}
          reset={reset}
          loading={resource.status === "loading"}
        />
        {resource.status === "loading" && <Loading />}
        {resource.status === "error" && (
          <PageState
            error
            title="面经读取失败"
            description={errorMessage(resource.error)}
            action="重新加载"
            onAction={() => {
              resource.retry();
              if (hasCriteria && scaleResource.status === "error")
                scaleResource.retry();
            }}
          />
        )}
        {data && (
          <>
            {data.list.items.length ? (
              <div className="card-grid">
                {data.list.items.map((interview) => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    q={q}
                  />
                ))}
              </div>
            ) : (
              <PageState
                title="暂时没有找到符合条件的面经"
                description="试试切换公司、岗位或招聘类型。"
                action="重置"
                onAction={reset}
              />
            )}
            <Pagination
              page={data.list.page}
              size={data.list.size}
              total={data.list.total}
              onPage={page}
            />
          </>
        )}
        <CheerBar />
      </main>
    </>
  );
}

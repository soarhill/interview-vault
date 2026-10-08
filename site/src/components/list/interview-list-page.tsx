import { useMemo } from "react";
import { selectFilters, selectSummaries } from "@/lib/search";
import { PAGE_SIZE } from "@/lib/url-state";
import { useLibrary } from "@/hooks/use-library";
import { useUrlState } from "@/hooks/use-url-state";
import { useListRestore } from "@/hooks/use-list-restore";
import { SiteHeader } from "../shared/brand";
import { Loading, PageState } from "../shared/page-state";
import { SiteFooter } from "../shared/site-footer";
import { ListHeader } from "./list-header";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { ResultSummary } from "./result-summary";
import { InterviewCard } from "./interview-card";
import { Pagination } from "./pagination";

export function InterviewListPage() {
  const { state, change, page, reset } = useUrlState();
  const { companyId, positionCategory, recruitType, q, page: currentPage } = state;
  const hasCriteria = Boolean(companyId || positionCategory || recruitType || q);
  const library = useLibrary();
  const items = useMemo(
    () => (library.status === "success" ? selectSummaries(library.data, state) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, companyId, positionCategory, recruitType, q, currentPage],
  );
  const filters = useMemo(
    () => (library.status === "success" ? selectFilters(library.data, state) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library, companyId, positionCategory, recruitType, q, currentPage],
  );
  // 站点规模（总量 / 公司数）恒以全量快照计算，不随筛选抖动。
  const scale = useMemo(() => {
    if (library.status !== "success") return undefined;
    const global = selectFilters(library.data, {
      companyId: "",
      positionCategory: "",
      recruitType: "",
      q: "",
      page: 1,
    });
    return { total: global.companyTotal, companies: global.companies.length };
  }, [library]);
  useListRestore(library.status === "success", items?.length.toString() ?? "");
  if (library.status === "error") {
    return (
      <>
        <SiteHeader />
        <main className="list-container">
          <PageState
            error
            title="面经读取失败"
            description="数据快照加载失败，请检查网络后重试。"
            action="重新加载"
            onAction={library.retry}
          />
        </main>
      </>
    );
  }
  const pages = items ? Math.max(1, Math.ceil(items.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(Math.max(1, currentPage), pages);
  const visible = items?.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <>
      <SiteHeader />
      <main className="list-container">
        <section className="search-area">
          <ListHeader total={scale?.total} companyCount={scale?.companies} loading={!scale} />
          <SearchBar key={q} q={q} onSearch={(value) => change("q", value)} />
        </section>
        {filters ? (
          <FilterBar filters={filters} state={state} onChange={change} />
        ) : (
          <div className="filter-placeholder" aria-hidden="true">
            <div className="skeleton w-4/5" />
            <div className="skeleton w-3/5" />
            <div className="skeleton w-1/2" />
          </div>
        )}
        <ResultSummary
          total={items?.length}
          filtered={hasCriteria || currentPage !== 1}
          reset={reset}
          loading={!items}
        />
        {!items && <Loading />}
        {items && visible && (
          <>
            {visible.length ? (
              <div className="card-grid">
                {visible.map((interview) => (
                  <InterviewCard key={interview.id} interview={interview} q={q} />
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
            <Pagination page={safePage} size={PAGE_SIZE} total={items.length} onPage={page} />
          </>
        )}
        <SiteFooter
          generatedAt={library.status === "success" ? library.data.generatedAt : undefined}
        />
      </main>
    </>
  );
}

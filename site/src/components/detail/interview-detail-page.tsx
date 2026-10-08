import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { findInterview, loadLibrary } from "@/lib/data";
import type { Interview } from "@/lib/types";
import { markReturnPending } from "@/lib/navigation";
import { recruitmentLabels } from "@/lib/url-state";
import { CopyProvider } from "@/hooks/use-copy";
import { useAnchor } from "@/hooks/use-anchor";
import { SiteHeader, SITE_TITLE } from "../shared/brand";
import { Loading, PageState } from "../shared/page-state";
import { BackLink } from "./back-link";
import { DetailHeader } from "./detail-header";
import { RoundNav } from "./round-nav";
import { RoundSection } from "./round-section";
import { SourceLinks } from "./source-links";

type DetailState =
  | { status: "loading" }
  | { status: "success"; interview: Interview }
  | { status: "notfound" }
  | { status: "error" };

export function InterviewDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [prevId, setPrevId] = useState(id);
  // 路由参数变化时重置为加载态（React 推荐的 props 变更调整状态写法）
  if (id !== prevId) {
    setPrevId(id);
    setState({ status: "loading" });
  }
  useEffect(() => {
    let alive = true;
    loadLibrary().then(
      (library) => {
        if (!alive) return;
        const interview = findInterview(library, id);
        setState(interview ? { status: "success", interview } : { status: "notfound" });
      },
      () => {
        if (alive) setState({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, attempt]);
  const interview = state.status === "success" ? state.interview : undefined;
  const invalidAnchor = useAnchor(state.status === "success", id);
  useEffect(() => {
    markReturnPending(`/interview/${id}`);
  }, [id]);
  useEffect(() => {
    if (!interview) return;
    const year = interview.firstInterviewDate?.slice(0, 4) ?? "";
    document.title = `${interview.company.name} ${interview.position?.name ?? "岗位未说明"} ${year}${recruitmentLabels[interview.recruitType]}面经｜面个 Offer`;
    return () => {
      document.title = SITE_TITLE;
    };
  }, [interview]);
  const rounds = interview?.rounds ?? [];
  return (
    <CopyProvider>
      <SiteHeader />
      <main className="detail-container">
        <div className="detail-page-actions">
          <BackLink
            id={id}
            company={interview ? String(interview.company.id) : undefined}
          />
        </div>
        {state.status === "loading" && <Loading detail />}
        {state.status === "error" && (
          <PageState
            error
            title="面经读取失败"
            description="数据快照加载失败，请检查网络后重试。"
            action="重新加载"
            onAction={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          />
        )}
        {state.status === "notfound" && (
          <PageState
            title="面经不存在"
            description="这份面经不存在，请返回列表浏览其他面经。"
            action="返回列表"
            href="/"
          />
        )}
        {interview && (
          <>
            <DetailHeader interview={interview} />
            {invalidAnchor && (
              <p className="anchor-notice" role="status">
                原定位问题已变化
              </p>
            )}
            {rounds.length > 1 && <RoundNav rounds={rounds} />}
            {rounds.map((round) => (
              <RoundSection key={round.id} round={round} q={q} />
            ))}
            <SourceLinks sources={interview.sources} />
          </>
        )}
      </main>
    </CopyProvider>
  );
}

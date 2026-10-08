"use client";
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getInterviewDetail } from "@/lib/api/interviews";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { markReturnPending } from "@/lib/navigation";
import { recruitmentLabels } from "@/lib/url-state";
import { useResource } from "@/hooks/use-resource";
import { useAnchor } from "@/hooks/use-anchor";
import { CopyProvider } from "@/hooks/use-copy";
import { SiteHeader } from "../shared/brand";
import { useCurrentUser } from "@/hooks/use-current-user";
import Link from "next/link";
import { Loading, PageState } from "../shared/page-state";
import { BackLink } from "./back-link";
import { DetailHeader } from "./detail-header";
import { RoundNav } from "./round-nav";
import { RoundSection } from "./round-section";
import { SourceLinks } from "./source-links";

export function InterviewDetailPage({ id }: { id: string }) {
  const { user } = useCurrentUser();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const load = useCallback(
    (signal: AbortSignal) => getInterviewDetail(id, signal),
    [id],
  );
  const resource = useResource(id, load);
  const invalidAnchor = useAnchor(
    resource.status === "success",
    id,
    q,
    params.get("followUpId"),
  );
  const interview = resource.status === "success" ? resource.data : undefined;
  useEffect(() => {
    markReturnPending(`/interview/${id}`);
  }, [id]);
  useEffect(() => {
    if (!interview) return;
    const year = interview.firstInterviewDate?.slice(0, 4) ?? "";
    document.title = `${interview.company.name} ${interview.position?.name ?? "岗位未说明"} ${year}${recruitmentLabels[interview.recruitType]}面经｜面个 Offer`;
    return () => {
      document.title = "面个 Offer｜真实大厂面试问题";
    };
  }, [interview]);
  const notFound =
    resource.status === "error" &&
    resource.error instanceof ApiError &&
    resource.error.httpStatus === 404 &&
    resource.error.code === "INTERVIEW_NOT_FOUND";
  const rounds = useMemo(() => interview?.rounds ?? [], [interview?.rounds]);
  const removed =
    resource.status === "error" &&
    resource.error instanceof ApiError &&
    resource.error.code === "INTERVIEW_REMOVED";
  return (
    <CopyProvider>
      <SiteHeader />
      <main className="detail-container">
        <div className="detail-page-actions">
          <BackLink
            id={id}
            company={interview ? String(interview.company.id) : undefined}
          />
          {user?.role === "ADMIN" && interview && (
            <Link className="text-button" href={`/admin/interviews/${id}/edit`}>
              编辑已发布内容
            </Link>
          )}
        </div>
        {resource.status === "loading" && <Loading detail />}
        {resource.status === "error" && (
          <PageState
            error
            title={
              removed
                ? "该面经已下架"
                : notFound
                  ? "面经不存在"
                  : "面经读取失败"
            }
            description={
              removed
                ? "这份面经已由平台下架，请浏览其他面经。"
                : notFound
                  ? "这份面经不存在，请返回列表浏览其他面经。"
                  : errorMessage(resource.error)
            }
            action={notFound || removed ? "返回列表" : "重新加载"}
            href={notFound || removed ? "/" : undefined}
            onAction={resource.retry}
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

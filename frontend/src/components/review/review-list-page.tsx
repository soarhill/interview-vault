"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteHeader } from "@/components/shared/brand";
import { CompanyLogo } from "@/components/shared/company";
import { Loading, PageState } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/shared/error-toast";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useResource } from "@/hooks/use-resource";
import { listReviews } from "@/lib/api/reviews";
import {
  ReviewNavigation,
  ReviewPagination,
  reviewTime,
} from "./review-navigation";
import styles from "./review-list.module.css";

function ReviewList({
  page,
  done,
  view,
}: {
  page: number;
  done?: string;
  view?: string;
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      listReviews({ status: "PENDING_REVIEW", page, size: 20 }, signal),
    [page],
  );
  const resource = useResource(`reviews:${page}`, load);
  const router = useRouter();
  const dismissDone = useCallback(() => {
    router.replace("/admin/reviews");
  }, [router]);
  return (
    <main className="workspace-page workspace-wide">
      <ReviewNavigation current="reviews" appearance="tabs" />
      {done && (
        <ErrorToast
          tone="success"
          message={done}
          onClose={dismissDone}
          action={
            view ? { label: "查看公开面经", href: view } : undefined
          }
        />
      )}
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">内容治理</span>
          <h1>投稿审核</h1>
          <p>先核对事实和候选项，再让真实面经被更多人看见。</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <p aria-live="polite">
          {resource.status === "success"
            ? <>共 <strong>{resource.data.total}</strong> 份待审核投稿</>
            : resource.status === "loading"
              ? "正在读取待审核投稿…"
              : "待审核投稿"}
        </p>
        <Button
          variant="ghost"
          className={styles.refresh}
          onClick={resource.retry}
          disabled={resource.status === "loading"}
          aria-busy={resource.status === "loading"}
        >
          <RefreshCw aria-hidden="true" />
          刷新
        </Button>
      </div>
      {resource.status === "loading" && <Loading />}
      {resource.status === "error" && (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      )}
      {resource.status === "success" && (
        <>
          {resource.data.items.length === 0 ? (
            <PageState
              title="暂无待审核投稿"
              description="新的投稿提交后会出现在这里。"
              action="浏览面经"
              href="/"
            />
          ) : (
            <div className={styles.list}>
              {resource.data.items.map((item) => (
                <article key={item.id} className={styles.item}>
                  <div className={styles.logo}>
                    <CompanyLogo name={item.company?.name || "尚未选择公司"} size={32} />
                  </div>
                  <h2 className={styles.title}>
                    <Link className={styles.cardLink} href={`/admin/reviews/${item.id}`}>
                      {item.company?.name || "尚未选择公司"} ·{" "}
                      {item.position?.name || "尚未选择岗位"}
                    </Link>
                  </h2>
                  <div className={styles.badges}>
                    <Badge variant="secondary" className={styles.status}>待审核</Badge>
                    {item.candidateCount > 0 && (
                      <Badge variant="secondary" className={styles.pending}>
                        {item.candidateCount} 项待处理
                      </Badge>
                    )}
                  </div>
                  <p className={styles.author}>
                    投稿人：@{item.author.githubLogin}
                    <br />
                    投稿时间：{reviewTime(item.submitTime)}
                  </p>
                  <span className={styles.entry} aria-hidden="true">
                    进入审核 <ArrowRight />
                  </span>
                </article>
              ))}
            </div>
          )}
          <ReviewPagination
            page={resource.data.page}
            size={resource.data.size}
            total={resource.data.total}
            path="/admin/reviews"
          />
        </>
      )}
    </main>
  );
}

export function ReviewListPage({
  page,
  done,
  view,
}: {
  page: number;
  done?: string;
  view?: string;
}) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <AuthGate admin>
        <ReviewList page={page} done={done} view={view} />
      </AuthGate>
    </div>
  );
}

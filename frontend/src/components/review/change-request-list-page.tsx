"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteHeader } from "@/components/shared/brand";
import { CompanyLogo } from "@/components/shared/company";
import { Loading, PageState } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useResource } from "@/hooks/use-resource";
import { listChangeRequests } from "@/lib/api/reviews";
import {
  ReviewNavigation,
  ReviewPagination,
  reviewTime,
} from "./review-navigation";
import styles from "./review-list.module.css";

function ChangeRequestList({ page }: { page: number }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      listChangeRequests({ status: "PENDING", page, size: 20 }, signal),
    [page],
  );
  const resource = useResource(`change-requests:${page}`, load);
  return (
    <main className="workspace-page workspace-wide">
      <ReviewNavigation current="changes" appearance="tabs" />
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">内容治理</span>
          <h1>变更申请</h1>
          <p>对照当前公开内容，确认作者申请的修改或删除。</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <p aria-live="polite">
          {resource.status === "success"
            ? <>共 <strong>{resource.data.total}</strong> 份待处理申请</>
            : resource.status === "loading"
              ? "正在读取待处理申请…"
              : "待处理申请"}
        </p>
        <Button
          variant="ghost"
          className={styles.refresh}
          onClick={resource.retry}
          disabled={resource.status === "loading"}
          aria-busy={resource.status === "loading"}
        >
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
              title="暂时没有待处理申请"
              description="作者对已发布面经发起的修改和删除申请会出现在这里。"
              action="返回投稿审核"
              href="/admin/reviews"
            />
          ) : (
            <div className={styles.list}>
              {resource.data.items.map((item) => (
                <article key={item.id} className={styles.item}>
                  <div className={styles.logo}>
                    <CompanyLogo
                      name={item.interview.companyName}
                      size={32}
                    />
                  </div>
                  <h2 className={styles.title}>
                    <Link
                      className={styles.cardLink}
                      href={`/admin/change-requests/${item.id}`}
                    >
                      {item.interview.companyName} ·{" "}
                      {item.interview.positionName}
                    </Link>
                  </h2>
                  <div className={styles.badges}>
                    <Badge variant="secondary" className={styles.status}>
                      {item.type === "DELETE" ? "申请删除" : "申请修改"}
                    </Badge>
                  </div>
                  <p className={styles.author}>
                    投稿人：@{item.requester.githubLogin}
                  </p>
                  <p className={styles.metadata}>
                    申请时间：{reviewTime(item.createTime)}
                    {item.reason && (
                      <>
                        {" · "}
                        <span>理由：{item.reason}</span>
                      </>
                    )}
                  </p>
                  <span className={styles.entry} aria-hidden="true">
                    查看申请 <ArrowRight size={14} />
                  </span>
                </article>
              ))}
            </div>
          )}
          <ReviewPagination
            page={resource.data.page}
            size={resource.data.size}
            total={resource.data.total}
            path="/admin/change-requests"
          />
        </>
      )}
    </main>
  );
}

export function ChangeRequestListPage({ page }: { page: number }) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <AuthGate admin>
        <ChangeRequestList page={page} />
      </AuthGate>
    </div>
  );
}

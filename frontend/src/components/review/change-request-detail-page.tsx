"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, Info, RefreshCw, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { payloadFromInterview } from "@/components/submission/form-model";
import { SiteHeader } from "@/components/shared/brand";
import { Loading } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import { useResource } from "@/hooks/use-resource";
import { ApiError } from "@/lib/api/errors";
import {
  approveChangeRequest,
  getChangeRequest,
  rejectChangeRequest,
} from "@/lib/api/reviews";
import type {
  AdminChangeRequestResponse,
  ChangeRequestMutationResponse,
} from "@/lib/api/types";
import { AggregateReadView } from "./aggregate-comparison";
import { ChangeRequestComparison } from "./change-request-comparison";
import { reviewTime } from "./review-navigation";
import styles from "./change-request-detail.module.css";

function ChangeRequestPanel({
  initial,
}: {
  initial: AdminChangeRequestResponse;
}) {
  const [detail, setDetail] = useState(initial);
  const [decision, setDecision] =
    useState<ChangeRequestMutationResponse | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | "refresh" | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const request = detail.changeRequest;
  const status = decision?.changeRequest.status ?? request.status;
  const handled = status !== "PENDING";
  const conflicted = error instanceof ApiError && error.httpStatus === 409;
  const disabled = !!busy || handled || conflicted;
  const current = payloadFromInterview(detail.currentInterview);
  const sources = detail.currentInterview.sources.map((source) => source.url);

  async function reloadLatest() {
    setBusy("refresh");
    try {
      setDetail(await getChangeRequest(request.id));
      setDecision(null);
      setError(null);
      setConfirmDelete(false);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (disabled) return;
    if (action === "approve" && request.type === "DELETE" && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const result =
        action === "approve"
          ? await approveChangeRequest(request.id, request.requestVersion)
          : await rejectChangeRequest(request.id, request.requestVersion);
      setDecision(result);
      setConfirmDelete(false);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>变更申请</span>
          <h1>
            {detail.currentInterview.company.name} ·{" "}
            {detail.currentInterview.position.name}
          </h1>
          <p>
            申请人 @{detail.requester.githubLogin} ·{" "}
            {reviewTime(request.updateTime)}
          </p>
        </div>
        <Button
          className={styles.refresh}
          variant="outline"
          disabled={!!busy}
          onClick={() => void reloadLatest()}
        >
          <RefreshCw
            size={18}
            className={busy === "refresh" ? styles.spinning : ""}
            aria-hidden="true"
          />
          {busy === "refresh" ? "正在读取…" : "读取最新状态"}
        </Button>
      </header>
      {conflicted ? (
        <div className="workspace-conflict" role="alert">
          <strong>申请状态或正式内容已经发生变化</strong>
          <p>审批操作已停止。请读取最新状态，确认是否已由其他管理员处理。</p>
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() => void reloadLatest()}
          >
            读取最新状态
          </Button>
        </div>
      ) : (
        error && (
          <RequestFeedback error={error} retry={() => void reloadLatest()} />
        )
      )}
      {handled && (
        <div className="workspace-notice" role="status">
          <strong>
            {status === "APPROVED" ? "该申请已批准" : "该申请已拒绝"}
          </strong>
          <p>
            {status === "REJECTED"
              ? "已拒绝本次申请，当前公开内容保持不变。"
              : decision
                ? decision.interview.status === "REMOVED"
                  ? "面经已按申请下架。"
                  : "面经已按申请更新并公开。"
                : "申请已处理，不能再次审批。"}
          </p>
          <div className="workspace-actions">
            <Link href="/admin/change-requests">返回申请列表</Link>
            {(decision?.interview.status ?? detail.currentInterview.status) ===
              "PUBLISHED" && (
              <Link href={`/interview/${detail.currentInterview.id}`}>
                查看公开内容
              </Link>
            )}
          </div>
        </div>
      )}
      {!handled && request.baseVersion !== detail.currentInterview.version && (
        <div className="workspace-notice" role="status">
          这份面经在申请提交后发生过更新。批准时服务端会再次核对，请先确认申请内容仍适用于最新公开内容。
        </div>
      )}
      {request.type === "UPDATE" && request.payload ? (
        <ChangeRequestComparison
          original={current}
          current={request.payload}
          originalTitle={
            decision?.changeRequest.status === "APPROVED"
              ? "审批前公开内容"
              : "当前公开内容"
          }
          originalSources={sources}
          status={status}
        />
      ) : request.type === "DELETE" ? (
        <>
          <section className={styles.deleteRequest}>
            <h2>
              <Trash2 size={21} aria-hidden="true" />
              作者申请删除这份面经
            </h2>
            <p className={styles.deleteReason}>
              {request.reason || "未提供删除原因"}
            </p>
            <p className="workspace-meta">
              批准后面经将下架，公开详情会显示“该面经已下架”。
            </p>
          </section>
          <details className={`${styles.deleteSnapshot} review-snapshot`}>
            <summary>查看申请删除的公开内容</summary>
            <AggregateReadView payload={current} sources={sources} />
          </details>
        </>
      ) : (
        <div className="workspace-conflict" role="alert">
          修改申请缺少目标内容，暂时无法完成核对。请重新加载或反馈该数据问题。
        </div>
      )}
      {!handled && (
        <section className={styles.decision} aria-label="处理申请">
          <div className={styles.decisionRow}>
            <span className={styles.decisionIcon}>
              <Info size={20} aria-hidden="true" />
            </span>
            <p className={styles.decisionHint}>
              {request.type === "UPDATE"
                ? "批准后将立即应用修改版本；拒绝后保留当前公开内容。"
                : "请确认作者的删除原因；拒绝会保留当前公开内容。"}
            </p>
            <div className={styles.decisionActions}>
              <Button
                className={styles.approve}
                disabled={
                  disabled || (request.type === "UPDATE" && !request.payload)
                }
                onClick={() => void decide("approve")}
              >
                {busy === "approve"
                  ? "正在批准…"
                  : request.type === "DELETE"
                    ? "批准删除…"
                    : "批准修改"}
              </Button>
              <Button
                className={styles.reject}
                variant="outline"
                disabled={disabled}
                onClick={() => void decide("reject")}
              >
                {busy === "reject" ? "正在拒绝…" : "拒绝申请"}
              </Button>
            </div>
          </div>
          {confirmDelete && (
            <div className="workspace-notice" role="alert">
              <strong>确认下架这份面经？</strong>
              <p>批准后公开阅读和搜索将不再显示它。</p>
              <div className="workspace-actions">
                <Button
                  variant="destructive"
                  disabled={disabled}
                  onClick={() => void decide("approve")}
                >
                  确认批准删除
                </Button>
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ChangeRequestDetail({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getChangeRequest(id, signal),
    [id],
  );
  const resource = useResource(`change-request:${id}`, load);
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Link className={styles.back} href="/admin/change-requests">
          <ArrowLeft size={16} aria-hidden="true" /> 返回变更申请
        </Link>
        {resource.status === "loading" && <Loading detail />}
        {resource.status === "error" && (
          <RequestFeedback error={resource.error} retry={resource.retry} />
        )}
        {resource.status === "success" && (
          <ChangeRequestPanel key={id} initial={resource.data} />
        )}
      </div>
    </main>
  );
}

export function ChangeRequestDetailPage({ id }: { id: string }) {
  return (
    <>
      <SiteHeader />
      <AuthGate admin>
        <ChangeRequestDetail id={id} />
      </AuthGate>
    </>
  );
}

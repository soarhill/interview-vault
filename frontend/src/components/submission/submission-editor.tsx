"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  RequestFeedback,
  WarningFeedback,
} from "@/components/shared/request-feedback";
import { ErrorToast } from "@/components/shared/error-toast";
import { errorMessage } from "@/lib/api/errors";
import { useInterviewForm } from "@/hooks/use-interview-form";
import {
  createInterview,
  getMyInterview,
  saveInterview,
  submitInterview,
} from "@/lib/api/interviews";
import { ApiError } from "@/lib/api/errors";
import type { MyInterviewDetailResponse, Warning } from "@/lib/api/types";
import {
  emptyInterviewPayload,
  payloadFromInterview,
  validateInterview,
  type FormIssue,
} from "./form-model";
import { InterviewForm } from "./interview-form";
import { UnsavedChanges } from "./unsaved-changes";
import { SubmissionPreview } from "./submission-preview";

export const statusLabels = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审核",
  PUBLISHED: "已发布",
  REJECTED: "未通过",
  REMOVED: "已下架",
};
export function SubmissionEditor({
  initial,
}: {
  initial?: MyInterviewDetailResponse;
}) {
  const router = useRouter();
  const form = useInterviewForm(
    initial ? payloadFromInterview(initial) : emptyInterviewPayload(),
  );
  const [detail, setDetail] = useState(initial);
  const active = useRef<{ id: number; version: number } | null>(
    initial ? { id: initial.id, version: initial.version } : null,
  );
  const [busy, setBusy] = useState<"save" | "submit" | "refresh" | null>(null);
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<MyInterviewDetailResponse | null>(null);
  const conflict = error instanceof ApiError && error.httpStatus === 409;
  const canEdit = !detail || detail.actions.canEdit;
  const canSubmit = !detail || detail.actions.canSubmit;

  async function save(intent: "save" | "submit") {
    const validation = validateInterview(
      form.payload,
      intent === "submit" ? "submit" : "draft",
    );
    setIssues(validation);
    if (validation.length > 0) return;
    setBusy(intent);
    setError(null);
    setMessage("");
    try {
      if (!active.current) {
        const created = await createInterview();
        active.current = { id: created.id, version: created.version };
      }
      const current = active.current;
      const saved = await saveInterview(current.id, {
        ...form.payload,
        version: current.version,
      });
      active.current = {
        id: saved.interview.id,
        version: saved.interview.version,
      };
      form.markSaved(payloadFromInterview(saved.interview));
      setWarnings(saved.warnings);
      const refreshed = await getMyInterview(current.id);
      setDetail(refreshed);
      if (intent === "submit") {
        if (!refreshed.actions.canSubmit) {
          setMessage(
            "内容已保存。当前状态不支持再次提交，请查看最新审核状态。",
          );
          return;
        }
        const submitted = await submitInterview(
          current.id,
          saved.interview.version,
        );
        active.current = { id: submitted.id, version: submitted.version };
        form.markSaved(form.payload);
        // 提交成功 → 独立成功页（查看投稿 / 继续逛）
        router.replace(`/me/interviews/submitted?id=${current.id}`);
        return;
      } else {
        setMessage(
          refreshed.status === "PENDING_REVIEW"
            ? "已保存，审核员将看到这次更新。"
            : "已保存草稿，可以稍后继续填写。",
        );
        // 保存结果提示渲染在页顶，滚回去让用户看到
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (!initial) router.replace(`/me/interviews/${current.id}/edit`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }
  async function refreshConflict() {
    if (!active.current) return;
    setBusy("refresh");
    setRefreshError(null);
    try {
      setLatest(await getMyInterview(active.current.id));
    } catch (failure) {
      setRefreshError(failure);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <UnsavedChanges dirty={form.dirty} />
      <div className="workspace-heading">
        <div>
          <Link href="/me/interviews" className="workspace-back">
            ← 我的投稿
          </Link>
          <p className="workspace-eyebrow">分享你的面经</p>
          <h1>{initial ? "继续完善这份面经" : "记录一段真实的面试经历"}</h1>
          <p>
            你的经历，可能会帮助下一位面试者。支持草稿保存，审核通过后公开。
          </p>
        </div>
        {detail && (
          <span
            className={`workspace-status status-${detail.status.toLowerCase()}`}
          >
            {statusLabels[detail.status]}
          </span>
        )}
      </div>
      {detail?.rejectionReason && (
        <div className="workspace-notice">
          <strong>这次投稿未通过</strong>
          <p>{detail.rejectionReason}</p>
          <p>补充内容并保存后，可以重新提交审核。</p>
        </div>
      )}
      {!canEdit && (
        <div className="workspace-notice">
          <p>这份投稿当前不能直接编辑。</p>
          {detail?.actions.canRequestChange && (
            <Link href={`/me/interviews/${detail.id}/change`}>
              申请修改已发布内容 →
            </Link>
          )}
        </div>
      )}
      {conflict ? (
        <div className="workspace-conflict" role="alert">
          <h2>当前内容已经发生变化</h2>
          <p>请加载最新内容后重新确认。你尚未保存的输入仍保留在下方。</p>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => void refreshConflict()}
          >
            {busy === "refresh" ? "正在加载…" : "加载最新版本并对比"}
          </Button>
        </div>
      ) : (
        error && <ErrorToast message={errorMessage(error)} onClose={() => setError(null)} />
      )}
      <RequestFeedback
        error={refreshError}
        retry={() => void refreshConflict()}
      />
      {latest && (
        <section className="workspace-notice">
          <h2>最新版本：{statusLabels[latest.status]}</h2>
          <p>
            请逐项比较服务器内容与下方未保存输入；选择保留输入后，保存前仍会由服务器校验。
          </p>
          <details>
            <summary>查看服务器最新内容</summary>
            <SubmissionPreview interview={latest} />
          </details>
          <div className="editor-actions">
            <Button
              variant="outline"
              onClick={() => {
                form.markSaved(payloadFromInterview(latest));
                active.current = { id: latest.id, version: latest.version };
                setDetail(latest);
                setLatest(null);
                setError(null);
                setMessage("已采用服务器最新内容。");
              }}
            >
              使用服务器内容
            </Button>
            <Button
              disabled={!latest.actions.canEdit}
              onClick={() => {
                active.current = { id: latest.id, version: latest.version };
                setDetail(latest);
                setLatest(null);
                setError(null);
                setMessage("已保留你的输入，请重新确认后保存。");
              }}
            >
              已对比，保留我的输入继续编辑
            </Button>
          </div>
        </section>
      )}
      <WarningFeedback warnings={warnings} />
      {message && (
        <p className="editor-status" role="status">
          {message}
        </p>
      )}
      <InterviewForm
        value={form.value}
        onChange={form.setValue}
        errors={issues}
        disabled={busy !== null || !canEdit}
      />
      {canEdit && (
        <div className="editor-actions editor-sticky-actions">
          <span className="editor-help" aria-live="polite">
            {busy === "save"
              ? "正在保存…"
              : busy === "submit"
                ? "正在提交…"
                : form.dirty
                  ? "有未保存的修改"
                  : detail
                    ? "内容已保存"
                    : "填写后可以保存草稿"}
          </span>
          <Button
            variant="outline"
            disabled={busy !== null || conflict}
            onClick={() => void save("save")}
          >
            {busy === "save"
              ? "正在保存…"
              : detail?.status === "PENDING_REVIEW"
                ? "保存更新"
                : "保存草稿"}
          </Button>
          {canSubmit && (
            <Button
              disabled={busy !== null || conflict}
              onClick={() => void save("submit")}
            >
              {busy === "submit"
                ? "正在提交…"
                : detail?.status === "REMOVED"
                  ? "重新投递"
                  : "提交审核"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

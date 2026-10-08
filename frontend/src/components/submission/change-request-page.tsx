"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, CircleAlert, Clock3, ExternalLink } from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteHeader } from "@/components/shared/brand";
import { CompanyLogo } from "@/components/shared/company";
import { Loading } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import { useInterviewForm } from "@/hooks/use-interview-form";
import { useResource } from "@/hooks/use-resource";
import { getMyChangeRequest, saveChangeRequest } from "@/lib/api/interviews";
import { ApiError } from "@/lib/api/errors";
import type {
  ChangeRequestType,
  MyChangeRequestResponse,
} from "@/lib/api/types";
import {
  payloadFromInterview,
  validateInterview,
  type FormIssue,
} from "./form-model";
import { InterviewForm } from "./interview-form";
import { UnsavedChanges } from "./unsaved-changes";
import { SubmissionPreview } from "./submission-preview";
import styles from "./change-request-page.module.css";

function ChangeRequestEditor({
  initial,
  initialType,
}: {
  initial: MyChangeRequestResponse;
  initialType?: ChangeRequestType;
}) {
  const form = useInterviewForm(
    initial.changeRequest?.payload ?? payloadFromInterview(initial.interview),
  );
  const [type, setType] = useState<ChangeRequestType>(
    initialType ?? initial.changeRequest?.type ?? "UPDATE",
  );
  const [interview, setInterview] = useState(initial.interview);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState(initial.changeRequest?.reason ?? "");
  const [baselineReason, setBaselineReason] = useState(
    initial.changeRequest?.reason ?? "",
  );
  const [baseVersion, setBaseVersion] = useState(initial.interview.version);
  const [currentRequest, setCurrentRequest] = useState(initial.changeRequest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [refreshError, setRefreshError] = useState<unknown>(null);
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<MyChangeRequestResponse | null>(null);
  // 明确的删除入口直接进入删除表单；普通入口先展示已有申请的审核状态。
  const [editing, setEditing] = useState(
    Boolean(initialType) || !initial.changeRequest,
  );
  const conflict = error instanceof ApiError && error.httpStatus === 409;
  const dirty =
    editing && (type === "UPDATE" ? form.dirty : reason !== baselineReason);
  const deleting = type === "DELETE";
  const replacing = currentRequest && currentRequest.type !== type;
  const datedRound = interview.rounds.find((round) => round.interviewDate);
  const interviewDate = datedRound?.interviewDate
    ? datedRound.interviewDate.slice(
        0,
        datedRound.interviewDatePrecision === "YEAR" ? 4 : 7,
      )
    : null;

  function beginEditing(nextType: ChangeRequestType) {
    setType(nextType);
    setEditing(true);
    setIssues([]);
    setError(null);
    setRefreshError(null);
    setMessage("");
    setLatest(null);
  }
  async function save() {
    const validation =
      type === "UPDATE"
        ? validateInterview(form.payload, "submit")
        : !reason.trim()
          ? [{ field: "reason", message: "请填写申请删除的原因。" }]
          : reason.length > 500
            ? [{ field: "reason", message: "删除原因不能超过 500 字。" }]
            : [];
    setIssues(validation);
    if (validation.length > 0) {
      if (type === "DELETE") reasonInput.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      const request = await saveChangeRequest(
        initial.interview.id,
        type === "UPDATE"
          ? { type, baseVersion, payload: form.payload }
          : { type, baseVersion, reason: reason.trim() },
      );
      setCurrentRequest(request);
      if (request.payload) form.markSaved(request.payload);
      else form.markClean();
      setBaselineReason(request.reason ?? "");
      setReason(request.reason ?? "");
      setEditing(false);
      setMessage(
        type === "UPDATE"
          ? "修改申请已提交。审核通过前，公开面经继续展示原版本。"
          : "删除申请已提交。管理员批准后，这份面经将下架。",
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setRefreshError(null);
    try {
      setLatest(await getMyChangeRequest(initial.interview.id));
    } catch (failure) {
      setRefreshError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <UnsavedChanges dirty={dirty} />
      <header className={styles.heading}>
        <Link className={styles.back} href="/me/interviews">
          <ArrowLeft size={14} aria-hidden="true" /> 返回我的投稿
        </Link>
        <h1>
          {editing
            ? `申请${deleting ? "删除" : "修改"}已发布内容`
            : `${deleting ? "删除" : "修改"}申请正在等待审核`}
        </h1>
        <p>
          {editing
            ? deleting
              ? "如果你不希望这份面经继续公开，可以提交删除申请，我们会在审核后处理。"
              : "完整填写你希望发布的内容，审核通过后将更新公开面经。"
            : "审核期间，公开页面继续展示当前版本。你可以在这里查看或更新申请。"}
        </p>
      </header>
      <section className={styles.summary} aria-label="当前已发布面经">
        <CompanyLogo name={interview.company.name} size={60} />
        <div className={styles.summaryCopy}>
          <h2>
            {interview.company.name} · {interview.department || interview.position.name}
          </h2>
          <p>{interview.company.name} · {interview.position.name}</p>
          <ul className={styles.tags} aria-label="面经信息">
            <li>{interview.position.name}</li>
            <li>{interview.recruitType === "INTERN" ? "实习" : "校招"}</li>
            {interview.rounds.length > 0 && (
              <li>{interview.rounds.length} 轮面试</li>
            )}
            {interview.tags.map((tag) => (
              <li key={tag.id}>{tag.name}</li>
            ))}
            {interviewDate && <li>{interviewDate}</li>}
          </ul>
        </div>
        <Link
          className={styles.onlineLink}
          href={`/interview/${interview.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          查看线上版本 <ExternalLink size={14} aria-hidden="true" />
          <span className="sr-only">（在新标签页打开）</span>
        </Link>
      </section>
      {editing && (
        <aside className={`${styles.notice} ${deleting ? styles.deleteNotice : styles.updateNotice}`}>
          <CircleAlert size={22} aria-hidden="true" />
          <p>
            <strong>{deleting ? "删除" : "修改"}申请需要管理员审核。</strong>
            {deleting
              ? "审核通过前，公开页面继续展示当前版本；审核通过后，该内容将从公开页面移除。"
              : "在审核通过前，公开页面将继续展示当前版本；审核通过后，将替换为本次提交的内容。"}
            {currentRequest && (
              <span className={styles.replacement}>
                {replacing
                  ? `提交后，当前待审核的${currentRequest.type === "DELETE" ? "删除" : "修改"}申请将替换为${deleting ? "删除" : "修改"}申请。`
                  : "再次提交会覆盖当前待审核申请。"}
              </span>
            )}
          </p>
        </aside>
      )}
      {conflict ? (
        <section className="workspace-conflict" role="alert">
          <h2>线上内容已更新</h2>
          <p>你填写的内容仍然保留，请加载最新版本并重新确认申请。</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void refresh()}
          >
            加载最新版本并对比
          </Button>
        </section>
      ) : (
        <RequestFeedback error={error} />
      )}
      <RequestFeedback error={refreshError} retry={() => void refresh()} />
      {latest && (
        <section className="workspace-notice">
          <h2>请核对最新线上内容</h2>
          <details>
            <summary>查看最新版本内容</summary>
            <SubmissionPreview interview={latest.interview} />
          </details>
          <div className="editor-actions">
            <Button
              variant="outline"
              onClick={() => {
                form.markSaved(
                  latest.changeRequest?.payload ??
                    payloadFromInterview(latest.interview),
                );
                setCurrentRequest(latest.changeRequest);
                setInterview(latest.interview);
                setBaseVersion(latest.interview.version);
                setReason(latest.changeRequest?.reason ?? "");
                setBaselineReason(latest.changeRequest?.reason ?? "");
                setIssues([]);
                setMessage("");
                setLatest(null);
                setError(null);
              }}
            >
              使用最新内容
            </Button>
            <Button
              onClick={() => {
                setBaseVersion(latest.interview.version);
                setCurrentRequest(latest.changeRequest);
                setInterview(latest.interview);
                setLatest(null);
                setError(null);
                setMessage("已保留你的输入，请核对后重新提交申请。");
              }}
            >
              已对比，保留我的输入
            </Button>
          </div>
        </section>
      )}
      {message && editing && (
        <p className={styles.status} role="status">{message}</p>
      )}
      {currentRequest && !editing && (
        <section className={styles.pending} aria-label="待审核申请">
          <div className={styles.pendingTitle}>
            <Clock3 size={20} aria-hidden="true" />
            <h2>{deleting ? "删除" : "修改"}申请已提交</h2>
            <span>待审核</span>
          </div>
          <p className={styles.status} role="status">
            {message || (deleting
              ? "管理员批准后，这份面经将下架。审核通过前，当前公开内容继续保留。"
              : "审核通过后，公开内容将更新为你提交的版本。")}
          </p>
          {deleting && currentRequest.reason && (
            <div className={styles.reasonSummary}>
              <h3>删除原因</h3>
              <p>{currentRequest.reason}</p>
            </div>
          )}
          <p className={styles.timestamp}>
            最近提交于 {new Date(currentRequest.updateTime).toLocaleString("zh-CN")}
          </p>
          <div className={styles.pendingActions}>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => beginEditing(currentRequest.type)}
            >
              更新这份申请
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => beginEditing(deleting ? "UPDATE" : "DELETE")}
            >
              改成{deleting ? "修改" : "删除"}申请
            </Button>
          </div>
        </section>
      )}
      {editing &&
      (type === "UPDATE" ? (
        <InterviewForm
          value={form.value}
          onChange={form.setValue}
          disabled={busy}
          errors={issues}
        />
      ) : (
        <form
          className={styles.reasonForm}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2><label htmlFor="deletion-reason">删除原因</label></h2>
          <p className={styles.help} id="deletion-reason-help">
            请告诉我们你希望删除这份内容的原因，这会提交给管理员审核。
          </p>
          <div className={styles.textareaWrap}>
            <textarea
              id="deletion-reason"
              ref={reasonInput}
              className={styles.textarea}
              rows={4}
              disabled={busy}
              value={reason}
              maxLength={500}
              aria-required="true"
              aria-describedby={`deletion-reason-help deletion-reason-count${issues.length ? " deletion-reason-error" : ""}`}
              placeholder="例如：内容包含不便公开的信息，或希望撤回这份内容。"
              aria-invalid={issues.length > 0}
              onChange={(event) => {
                setReason(event.target.value);
                setIssues([]);
              }}
            />
            <span className={styles.counter} id="deletion-reason-count">
              {reason.length} / 500
            </span>
          </div>
          {issues.map((issue) => (
            <p className="editor-error" id="deletion-reason-error" role="alert" key={issue.field}>
              {issue.message}
            </p>
          ))}
          <div className={styles.formActions}>
            <Button variant="outline" disabled={busy} asChild>
              <Link
                href="/me/interviews"
                aria-disabled={busy}
                onClick={(event) => { if (busy) event.preventDefault(); }}
              >
                取消返回
              </Link>
            </Button>
            <Button type="submit" disabled={busy || conflict} variant="destructive">
              {busy ? "正在提交…" : "提交删除申请"}
            </Button>
          </div>
        </form>
      ))}
      {editing && !deleting && (
      <div className={`editor-actions editor-sticky-actions ${styles.updateActions}`}>
        <span className="editor-help">
          {deleting
            ? dirty
              ? "有未提交的修改"
              : "填写删除原因后提交"
            : JSON.stringify(form.payload) ===
                JSON.stringify(payloadFromInterview(initial.interview))
              ? "内容没有任何修改"
              : dirty
                ? "有未提交的修改"
                : currentRequest
                  ? "提交后将覆盖当前待审核申请"
                  : "确认后提交申请"}
        </span>
        <Button variant="outline" disabled={busy} asChild>
          <Link
            href="/me/interviews"
            aria-disabled={busy}
            onClick={(event) => { if (busy) event.preventDefault(); }}
          >
            取消返回
          </Link>
        </Button>
        <Button
          disabled={
            busy ||
            conflict ||
            (!deleting &&
              JSON.stringify(form.payload) ===
                JSON.stringify(payloadFromInterview(initial.interview)))
          }
          onClick={() => void save()}
        >
          {busy ? "正在提交…" : "提交修改申请"}
        </Button>
      </div>
      )}
    </>
  );
}
function ChangeRequestContent({
  id,
  initialType,
}: {
  id: string;
  initialType?: ChangeRequestType;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getMyChangeRequest(id, signal),
    [id],
  );
  const resource = useResource(`my-change-request:${id}`, load);
  if (resource.status === "loading") return <Loading detail />;
  if (resource.status === "error")
    return <RequestFeedback error={resource.error} retry={resource.retry} />;
  return (
    <ChangeRequestEditor
      key={`${id}:${initialType ?? "current"}`}
      initial={resource.data}
      initialType={initialType}
    />
  );
}
export function ChangeRequestPage({
  id,
  initialType,
}: {
  id: string;
  initialType?: ChangeRequestType;
}) {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <AuthGate>
          <div className={styles.content}>
            <ChangeRequestContent id={id} initialType={initialType} />
          </div>
        </AuthGate>
      </main>
    </>
  );
}

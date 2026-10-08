"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  Eye,
  Pencil,
  FileClock,
  RotateCw,
  Clock3,
} from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { InterviewForm } from "@/components/submission/interview-form";
import { UnsavedChanges } from "@/components/submission/unsaved-changes";
import {
  payloadFromInterview,
  validateInterview,
  type FormIssue,
} from "@/components/submission/form-model";
import { SiteHeader } from "@/components/shared/brand";
import { Loading } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useInterviewForm } from "@/hooks/use-interview-form";
import { useResource } from "@/hooks/use-resource";
import {
  getReviewDetail,
  publishInterview,
  rejectInterview,
  resolveCandidate,
  saveReview,
} from "@/lib/api/reviews";
import type {
  AdminReviewResponse,
  InterviewChangePayload,
  ResolveCandidateRequest,
  Warning,
} from "@/lib/api/types";
import { AggregateComparison } from "./aggregate-comparison";
import { ReviewContent, ReviewTags } from "./review-content";
import { ReviewSidebar } from "./review-sidebar";
import { candidateResolved, reviewConflict } from "./review-state";
import { reviewTime } from "./review-navigation";
import styles from "./review-workbench.module.css";

function ReviewPanel({ initial }: { initial: AdminReviewResponse }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const form = useInterviewForm(payloadFromInterview(initial.interview));
  const [busy, setBusy] = useState<
    "save" | "resolve" | "publish" | "reject" | "refresh" | null
  >(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [reconfirmation, setReconfirmation] =
    useState<InterviewChangePayload | null>(null);
  const conflict = reviewConflict(error);
  const handled = detail.interview.status !== "PENDING_REVIEW";
  const stopped =
    !!busy || !!conflict || refreshRequired || !!reconfirmation || handled;
  const actionStopped = stopped || form.dirty || editing;

  async function reloadLatest() {
    const keepInput = form.dirty;
    setBusy("refresh");
    try {
      const latest = await getReviewDetail(detail.interview.id);
      setDetail(latest);
      if (keepInput) {
        setReconfirmation(payloadFromInterview(latest.interview));
        setNotice(
          "已读取最新审核内容。你的未保存修改仍在编辑器中，请对照确认后继续。",
        );
      } else {
        form.markSaved(payloadFromInterview(latest.interview));
        setEditing(false);
        setReconfirmation(null);
        setNotice("已读取最新内容，请重新核对后审核。");
      }
      setRefreshRequired(false);
      setError(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  async function refreshCanonical(expectedVersion: number) {
    try {
      const latest = await getReviewDetail(detail.interview.id);
      setDetail(latest);
      form.markSaved(payloadFromInterview(latest.interview));
      setRefreshRequired(false);
      if (latest.interview.version !== expectedVersion) {
        setReconfirmation(payloadFromInterview(latest.interview));
        setNotice(
          "操作已成功，随后内容又有更新。请核对当前最新内容后继续审核。",
        );
        return false;
      }
      return true;
    } catch (failure) {
      setRefreshRequired(true);
      setError(failure);
      setNotice("操作已保存，但最新审核内容读取失败。请读取最新版本后继续。");
      return false;
    }
  }

  async function save() {
    const nextIssues = validateInterview(form.payload, "draft");
    setIssues(nextIssues);
    if (nextIssues.length || stopped) return;
    setBusy("save");
    setError(null);
    setNotice("");
    try {
      const result = await saveReview(detail.interview.id, {
        ...form.payload,
        version: detail.interview.version,
      });
      setDetail((current) => ({
        ...current,
        interview: { ...current.interview, ...result.interview },
      }));
      form.markSaved(payloadFromInterview(result.interview));
      setWarnings(result.warnings);
      setNotice("审核内容已保存。");
      if (await refreshCanonical(result.interview.version)) setEditing(false);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  async function resolve(
    candidateId: number,
    request: ResolveCandidateRequest,
  ) {
    if (actionStopped) return;
    setBusy("resolve");
    setResolvingId(candidateId);
    setError(null);
    setNotice("");
    try {
      const response = await resolveCandidate(
        detail.interview.id,
        candidateId,
        request,
      );
      setDetail((current) => candidateResolved(current, response));
      setNotice("候选项已处理。");
      await refreshCanonical(response.interview.version);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
      setResolvingId(null);
    }
  }

  async function decide(action: "publish" | "reject") {
    if (actionStopped) return;
    if (action === "reject" && !reason.trim()) {
      setReasonError(true);
      return;
    }
    setBusy(action);
    setError(null);
    setNotice("");
    setReasonError(false);
    try {
      const result =
        action === "publish"
          ? await publishInterview(
              detail.interview.id,
              detail.interview.version,
            )
          : await rejectInterview(
              detail.interview.id,
              detail.interview.version,
              reason.trim(),
            );
      setDetail((current) => ({
        ...current,
        interview: {
          ...current.interview,
          ...result,
          rejectionReason: action === "reject" ? reason.trim() : null,
        },
      }));
      setWarnings(result.warnings);
      // 处理完成即退出工作台：任务页不留“已结束”状态，回列表带一条轻提示。
      // 不提前关拒绝弹层：UnsavedChanges 守卫清理时的 history.back() 会竞争掉
      // 同帧的软导航；保持 dirty 让弹层随页面卸载，失败时也留在原地展示错误。
      const done =
        action === "publish"
          ? "面经已发布，现在可以被搜索和阅读。"
          : "已拒绝投稿，作者可以补充后重新提交。";
      router.push(
        `/admin/reviews?done=${encodeURIComponent(done)}&view=${
          action === "publish" ? `/interview/${detail.interview.id}` : ""
        }`,
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  function cancelEditing() {
    if (form.dirty) setDiscardOpen(true);
    else setEditing(false);
  }

  function discardEditing() {
    form.markSaved(payloadFromInterview(detail.interview));
    setIssues([]);
    setReconfirmation(null);
    setDiscardOpen(false);
    setEditing(false);
  }

  function locateCandidate(id: number) {
    setWorkflowOpen(true);
    requestAnimationFrame(() => {
      const target = document.getElementById(`review-candidate-${id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      target?.focus({ preventScroll: true });
    });
  }

  const submittedAt = detail.submissionSnapshot?.createTime ?? null;
  const statusLabel =
    detail.interview.status === "PENDING_REVIEW"
      ? "待审核"
      : detail.interview.status === "PUBLISHED"
        ? "已发布"
        : detail.interview.status === "REJECTED"
          ? "已拒绝"
          : "已处理";
  const decisionHint = editing
    ? "正在编辑内容，请保存或取消编辑后审核。"
    : refreshRequired
      ? "请读取最新内容后继续审核。"
      : conflict || reconfirmation
        ? "请先核对最新版本后继续审核。"
        : detail.candidates.length
          ? "请先处理全部候选项，再发布面经。"
          : "确认内容无误后即可发布。";

  return (
    <>
      <UnsavedChanges dirty={form.dirty || (rejectOpen && !!reason.trim())} />
      <div className={styles.layout}>
        <div className={styles.contentColumn}>
          <header className={styles.heading}>
            <div className={styles.headingTop}>
              <span
                className={styles.status}
                data-status={detail.interview.status}
              >
                <Clock3 size={13} aria-hidden="true" />
                {statusLabel}
              </span>
              <div className={styles.headingActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotOpen(true)}
                >
                  <FileClock size={15} aria-hidden="true" />
                  查看原始提交
                </Button>
                {!handled && (
                  <Button
                    size="sm"
                    variant={editing ? "outline" : "default"}
                    disabled={!!busy || refreshRequired}
                    onClick={() =>
                      editing ? cancelEditing() : setEditing(true)
                    }
                  >
                    {editing ? (
                      <Eye size={15} aria-hidden="true" />
                    ) : (
                      <Pencil size={15} aria-hidden="true" />
                    )}
                    {editing ? "取消编辑" : "编辑内容"}
                  </Button>
                )}
              </div>
            </div>
            <h1>
              {detail.interview.company?.name || "未填写公司"} ·{" "}
              {detail.interview.position?.name || "未填写岗位"}
            </h1>
            <p className={styles.metadata}>
              <span>@{detail.author.githubLogin}</span>
              <span>
                {detail.interview.recruitType === "INTERN"
                  ? "实习"
                  : detail.interview.recruitType === "CAMPUS"
                    ? "校招"
                    : "招聘类型未填写"}
              </span>
              <span>
                {submittedAt
                  ? `提交于 ${reviewTime(submittedAt)}`
                  : `创建于 ${reviewTime(detail.interview.createTime)}`}
              </span>
            </p>
            <ReviewTags
              tags={detail.interview.tags}
              candidates={detail.candidates}
              onLocate={locateCandidate}
            />
          </header>

          {notice && (
            <div className={styles.notice} role="status">
              {notice}
            </div>
          )}
          {warnings.map((warning) => (
            <div className={styles.notice} role="status" key={warning.code}>
              {warning.message}
            </div>
          ))}
          {conflict === "handled" ? (
            <div className="workspace-conflict" role="alert">
              <strong>这份投稿或候选项已被处理</strong>
              <p>审核操作已停止，未保存的修改仍然保留。</p>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => void reloadLatest()}
              >
                读取最新状态
              </Button>
            </div>
          ) : (
            !!error && (
              <RequestFeedback
                error={error}
                retry={() => void reloadLatest()}
              />
            )
          )}
          {refreshRequired && (
            <div className={styles.notice} role="alert">
              最新审核状态尚未同步，请读取最新内容后继续。
              <Button
                variant="outline"
                size="sm"
                disabled={!!busy}
                onClick={() => void reloadLatest()}
              >
                读取最新内容
              </Button>
            </div>
          )}
          {handled && (
            <div className={styles.notice} role="status">
              <strong>
                {detail.interview.status === "PUBLISHED"
                  ? "面经已发布"
                  : detail.interview.status === "REJECTED"
                    ? "投稿已拒绝"
                    : "该投稿已不在待审核状态"}
              </strong>
              {detail.interview.rejectionReason && (
                <p>拒绝原因：{detail.interview.rejectionReason}</p>
              )}
              <div className="workspace-actions">
                <Link href="/admin/reviews">返回投稿审核</Link>
                {detail.interview.status === "PUBLISHED" && (
                  <>
                    <Link href={`/interview/${detail.interview.id}`}>
                      查看公开面经
                    </Link>
                    <Link
                      href={`/admin/interviews/${detail.interview.id}/edit`}
                    >
                      编辑已发布内容
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
          {reconfirmation && (
            <section className={styles.reconfirmation}>
              <h2>核对最新内容与保留的修改</h2>
              <AggregateComparison
                original={reconfirmation}
                current={form.payload}
                originalTitle="最新服务器内容"
                currentTitle="保留的本地修改"
              />
              <Button disabled={!!busy} onClick={() => setReconfirmation(null)}>
                已核对，继续审核
              </Button>
            </section>
          )}

          {editing ? (
            <section className={styles.editingCard} aria-label="编辑审核内容">
              <div className={styles.editorHeading}>
                <h2>
                  <Pencil size={18} aria-hidden="true" />
                  编辑内容
                </h2>
                <span>{form.dirty ? "有未保存修改" : "尚未修改"}</span>
              </div>
              <InterviewForm
                value={form.value}
                onChange={form.setValue}
                disabled={!!busy || handled || refreshRequired}
                errors={issues}
              />
              <div className={styles.editorActions}>
                <Button
                  disabled={stopped || !form.dirty}
                  onClick={() => void save()}
                >
                  {busy === "save" ? "正在保存…" : "保存并返回审核"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={cancelEditing}
                >
                  取消编辑
                </Button>
              </div>
            </section>
          ) : (
            <ReviewContent
              interview={detail.interview}
              candidates={detail.candidates}
              submittedAt={submittedAt}
              onLocate={locateCandidate}
            />
          )}
          <div className={styles.refreshRow}>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void reloadLatest()}
            >
              <RotateCw size={14} aria-hidden="true" />
              {busy === "refresh" ? "正在读取…" : "读取最新内容"}
            </button>
          </div>
        </div>

        <ReviewSidebar
          detail={detail}
          disabled={actionStopped}
          publishing={busy === "publish"}
          resolvingId={resolvingId}
          handled={handled}
          hint={decisionHint}
          expanded={workflowOpen}
          onToggle={() => setWorkflowOpen((current) => !current)}
          onResolve={(id, request) => void resolve(id, request)}
          onPublish={() => void decide("publish")}
          onReject={() => setRejectOpen(true)}
        />
      </div>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className={styles.snapshotDialog}>
          <DialogTitle>原始投稿与当前内容对照</DialogTitle>
          <DialogDescription>
            {submittedAt
              ? `原始提交于 ${reviewTime(submittedAt)}，快照保留作者提交时的内容。`
              : "这份投稿暂无原始提交快照。"}
          </DialogDescription>
          {detail.submissionSnapshot && (
            <AggregateComparison
              original={detail.submissionSnapshot.content}
              current={
                editing ? form.payload : payloadFromInterview(detail.interview)
              }
              currentTitle={
                editing && form.dirty ? "编辑中的未保存内容" : "当前审核内容"
              }
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogTitle>放弃未保存的修改？</DialogTitle>
          <DialogDescription>
            返回审核模式后，使用当前已保存的内容。
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              继续编辑
            </Button>
            <Button variant="destructive" onClick={discardEditing}>
              放弃修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={rejectOpen}
        onOpenChange={(next) => {
          if (!busy) setRejectOpen(next);
        }}
      >
        <DialogContent>
          <DialogTitle>拒绝这份投稿</DialogTitle>
          <DialogDescription>
            说明需要补充或修正的内容，让作者知道下一步怎么做。
          </DialogDescription>
          <label className="field-label" htmlFor="review-reason">
            拒绝原因
          </label>
          <textarea
            id="review-reason"
            className="field-textarea"
            value={reason}
            disabled={!!busy}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(false);
            }}
            placeholder="请填写具体原因"
            aria-invalid={reasonError}
            aria-describedby={reasonError ? "review-reason-error" : undefined}
          />
          {reasonError && (
            <p id="review-reason-error" className="field-error" role="alert">
              请填写拒绝原因。
            </p>
          )}
          {!!error && (
            <RequestFeedback error={error} retry={() => void reloadLatest()} />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setRejectOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={actionStopped}
              onClick={() => void decide("reject")}
            >
              {busy === "reject" ? "正在拒绝…" : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReviewDetail({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getReviewDetail(id, signal),
    [id],
  );
  const resource = useResource(`review:${id}`, load);
  return (
    <main className={styles.page}>
      <Link href="/admin/reviews" className={styles.back}>
        <ArrowLeft size={15} aria-hidden="true" />
        返回投稿审核
      </Link>
      {resource.status === "loading" && <Loading detail />}
      {resource.status === "error" && (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      )}
      {resource.status === "success" && (
        <ReviewPanel key={id} initial={resource.data} />
      )}
    </main>
  );
}

export function ReviewDetailPage({ id }: { id: string }) {
  return (
    <div className={styles.shell}>
      <SiteHeader />
      <AuthGate admin>
        <ReviewDetail id={id} />
      </AuthGate>
    </div>
  );
}

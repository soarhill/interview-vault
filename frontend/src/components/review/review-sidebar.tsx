"use client";

import {
  ChevronDown,
  ClipboardCheck,
  CircleAlert,
  Send,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  AdminReviewResponse,
  ResolveCandidateRequest,
} from "@/lib/api/types";
import { CandidateResolver } from "./candidate-resolver";
import { reviewTime } from "./review-navigation";
import styles from "./review-workbench.module.css";

export function ReviewSidebar({
  detail,
  disabled,
  publishing,
  resolvingId,
  handled,
  hint,
  expanded,
  onToggle,
  onResolve,
  onPublish,
  onReject,
}: {
  detail: AdminReviewResponse;
  disabled: boolean;
  publishing: boolean;
  resolvingId: number | null;
  handled: boolean;
  hint: string;
  expanded: boolean;
  onToggle: () => void;
  onResolve: (candidateId: number, request: ResolveCandidateRequest) => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const count = detail.candidates.length;
  const needsResolution = count > 0 && !handled;
  return (
    <aside className={styles.sidebar} aria-label="投稿审核操作">
      <div className={styles.sidebarCard}>
        <div className={styles.sidebarHeading}>
          <h2>
            <ClipboardCheck size={21} aria-hidden="true" />
            审核
          </h2>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className={styles.guideLink}>
                审核指南
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>投稿审核指南</DialogTitle>
              <DialogDescription>
                先核对内容，再处理目录信息，最后做出审核决定。
              </DialogDescription>
              <ol className={styles.guideSteps}>
                <li>阅读问题、追问与来源，确认记录清楚、可信。</li>
                <li>将新公司、岗位和标签归入正式目录，或确认创建新项。</li>
                <li>需要修正时点“编辑内容”，保存后再次核对。</li>
                <li>确认无误后发布；拒绝时说明作者需要补充什么。</li>
              </ol>
            </DialogContent>
          </Dialog>
        </div>
        <div
          className={
            needsResolution ? styles.pendingSummary : styles.readySummary
          }
          role="status"
          aria-live="polite"
        >
          {needsResolution ? (
            <CircleAlert size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <div>
            <strong>
              {handled ? "审核已完成" : count ? "待处理项" : "候选已确认"}
            </strong>
            <p>
              {handled
                ? "可返回列表继续审核"
                : count
                  ? "请确认以下信息后发布"
                  : "核对内容后即可发布"}
            </p>
          </div>
          {!handled && <span className={styles.pendingCount}>{count}</span>}
        </div>
        <button
          type="button"
          className={styles.mobileToggle}
          aria-expanded={expanded}
          aria-controls="review-workflow-content"
          onClick={onToggle}
        >
          {expanded
            ? "收起审核事项"
            : `查看审核事项${count ? `（${count}）` : ""}`}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <div
          className={styles.workflowContent}
          id="review-workflow-content"
          data-expanded={expanded}
        >
          <div className={styles.candidateList}>
            {count ? (
              detail.candidates.map((candidate, index) => (
                <CandidateResolver
                  key={`${candidate.id}:${candidate.value}`}
                  candidate={candidate}
                  index={index}
                  version={detail.interview.version}
                  disabled={disabled}
                  pending={resolvingId === candidate.id}
                  onResolve={onResolve}
                />
              ))
            ) : (
              <div className={styles.submissionInfo}>
                <h3>投稿信息</h3>
                <dl>
                  <div>
                    <dt>作者</dt>
                    <dd>@{detail.author.githubLogin}</dd>
                  </div>
                  <div>
                    <dt>提交时间</dt>
                    <dd>
                      {detail.submissionSnapshot
                        ? reviewTime(detail.submissionSnapshot.createTime)
                        : "未记录"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
          {!handled && (
            <div className={styles.decisions}>
              <p className={styles.decisionHint}>{hint}</p>
              <Button
                id="review-publish"
                className={styles.publishButton}
                disabled={disabled || count > 0}
                onClick={onPublish}
              >
                <Send size={17} aria-hidden="true" />
                {publishing ? "正在发布…" : "发布面经"}
              </Button>
              <Button
                variant="outline"
                className={styles.rejectButton}
                disabled={disabled}
                onClick={onReject}
              >
                <X size={18} aria-hidden="true" />
                拒绝投稿
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Eye,
  FileText,
  Pencil,
  Plus,
  XCircle,
} from "lucide-react";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteHeader } from "@/components/shared/brand";
import { CompanyLogo } from "@/components/shared/company";
import { Loading, PageState } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/list/pagination";
import { useResource } from "@/hooks/use-resource";
import { useCurrentUser } from "@/hooks/use-current-user";
import { deleteDraft, listMyInterviews } from "@/lib/api/interviews";
import type { MyInterviewListItem, MyInterviewsQuery } from "@/lib/api/types";
import { statusLabels } from "./submission-editor";
import { SubmissionPiggy } from "./submission-piggy";

type StatusTab =
  | "ALL"
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "REMOVED";
type StatusCounts = Record<StatusTab, number>;

const countStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "REMOVED",
] as const;

const statusTabs: {
  value: StatusTab;
  status?: MyInterviewsQuery["status"];
  label: string;
}[] = [
  { value: "ALL", label: "全部" },
  { value: "DRAFT", status: "DRAFT", label: "草稿" },
  { value: "PENDING_REVIEW", status: "PENDING_REVIEW", label: "待审核" },
  { value: "PUBLISHED", status: "PUBLISHED", label: "已发布" },
  { value: "REJECTED", status: "REJECTED", label: "未通过" },
  { value: "REMOVED", status: "REMOVED", label: "已下架" },
];

const statusIcons = {
  DRAFT: FileText,
  PENDING_REVIEW: Clock3,
  PUBLISHED: CheckCircle2,
  REJECTED: XCircle,
  REMOVED: XCircle,
} as const;

function roundCountLabel(count: number): string {
  if (count === 0) return "未记录面试轮数";
  if (count === 1) return "一轮面试";
  if (count === 2) return "两轮面试";
  return `${count} 轮面试`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function submissionHref(interview: MyInterviewListItem): string {
  return interview.status === "PUBLISHED"
    ? `/interview/${interview.id}`
    : `/me/interviews/${interview.id}/edit`;
}

function submissionActionLabel(interview: MyInterviewListItem): string {
  if (interview.status === "PENDING_REVIEW") return "查看投稿";
  if (interview.status === "REJECTED") return "修改后重投";
  if (interview.status === "PUBLISHED") return "查看面经";
  if (interview.status === "REMOVED") return "重新编辑";
  return "继续编辑";
}

function SubmissionCard({
  interview,
  onDelete,
}: {
  interview: MyInterviewListItem;
  onDelete: (item: MyInterviewListItem) => void;
}) {
  const company = interview.company?.name ?? "公司待填写";
  const position = interview.position?.name ?? "岗位待填写";
  const StatusIcon = statusIcons[interview.status as keyof typeof statusIcons];
  const link = submissionHref(interview);
  const recruitment =
    interview.recruitType === "INTERN"
      ? "实习"
      : interview.recruitType
        ? "校招"
        : "招聘类型待补充";

  return (
    <article className="workspace-list-card submission-card">
      <Link
        className="submission-card-overlay"
        href={link}
        aria-label={`${company}，${position}，${statusLabels[interview.status]}`}
      />
      <div className="submission-card-main">
        <CompanyLogo name={company} size={40} />
        <div className="submission-card-copy">
          <h2>
            <span>{company}</span>
            {interview.department && (
              <span className="submission-department"> · {interview.department}</span>
            )}
          </h2>
          <p className="submission-role">
            {position} <span aria-hidden="true">·</span> {recruitment}
          </p>
          <div className="submission-meta" aria-label="投稿统计">
            <span>
              <FileText aria-hidden="true" />
              {roundCountLabel(interview.roundCount)}
            </span>
            <span>
              <CircleHelp aria-hidden="true" />
              {interview.questionCount} 个问题
            </span>
            <span>
              <Clock3 aria-hidden="true" />
              更新于 {dateLabel(interview.updateTime)}
            </span>
          </div>
          {interview.status === "REJECTED" && interview.rejectionReason && (
            <p className="submission-rejection">
              <strong>未通过原因</strong>
              <span>{interview.rejectionReason}</span>
            </p>
          )}
        </div>
      </div>
      <div className="submission-card-actions">
        <span
          className={`workspace-status submission-status status-${interview.status.toLowerCase()}`}
        >
          {StatusIcon && <StatusIcon aria-hidden="true" />}
          {statusLabels[interview.status]}
        </span>
        <div className="submission-action-row">
          {interview.hasPendingChangeRequest && (
            <span className="submission-change-note">
              修改 / 删除申请审核中 · 当前公开版本不受影响
            </span>
          )}
          {interview.status === "PUBLISHED" ? (
            <Link className="submission-link" href={link}>
              {submissionActionLabel(interview)}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : interview.actions.canEdit ? (
            <Link className="submission-link" href={link}>
              {interview.status === "PENDING_REVIEW" ? (
                <Eye aria-hidden="true" />
              ) : (
                <Pencil aria-hidden="true" />
              )}
              {submissionActionLabel(interview)}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
          {interview.actions.canRequestChange && (
            <Link
              className="submission-link submission-link-secondary"
              href={`/me/interviews/${interview.id}/change`}
            >
              {interview.hasPendingChangeRequest ? "查看 / 更新申请" : "申请修改"}
            </Link>
          )}
          {interview.actions.canRequestDelete && (
            <Link
              className="submission-link submission-link-secondary"
              href={`/me/interviews/${interview.id}/change?type=DELETE`}
            >
              申请删除
            </Link>
          )}
          {interview.actions.canDeleteDraft && (
            <button
              type="button"
              className="submission-link submission-link-secondary submission-delete-action"
              onClick={() => onDelete(interview)}
            >
              删除草稿
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function MyInterviewsContent() {
  const { user, logout } = useCurrentUser();
  const [status, setStatus] = useState<MyInterviewsQuery["status"]>();
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] =
    useState<MyInterviewListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(
    (signal: AbortSignal) =>
      listMyInterviews({ status, page, size: 20 }, signal),
    [status, page],
  );
  const resource = useResource(`my-interviews:${status}:${page}`, load);
  const loadCounts = useCallback(async (signal: AbortSignal) => {
    const [all, ...byStatus] = await Promise.all([
      listMyInterviews({ page: 1, size: 1 }, signal),
      ...countStatuses.map((value) =>
        listMyInterviews({ status: value, page: 1, size: 1 }, signal),
      ),
    ]);
    return {
      ALL: all.total,
      DRAFT: byStatus[0].total,
      PENDING_REVIEW: byStatus[1].total,
      PUBLISHED: byStatus[2].total,
      REJECTED: byStatus[3].total,
      REMOVED: byStatus[4].total,
    } satisfies StatusCounts;
  }, []);
  const counts = useResource("my-interview-status-counts", loadCounts);

  async function removeDraft() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    setError(null);
    resource.setData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== target.id),
      total: current.total - 1,
    }));
    setConfirmDelete(null);
    try {
      await deleteDraft(target.id);
      resource.retry();
      counts.retry();
    } catch (failure) {
      setError(failure);
      resource.retry();
    } finally {
      setDeleting(false);
    }
  }

  async function performSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch (failure) {
      setError(failure);
    } finally {
      setSigningOut(false);
    }
  }

  function requestSignOut() {
    const event = new CustomEvent("interview-vault:before-signout", {
      cancelable: true,
      detail: { proceed: () => void performSignOut() },
    });
    if (window.dispatchEvent(event)) void performSignOut();
  }

  return (
    <>
      <div className="workspace-heading submission-heading">
        <div>
          <h1>我的投稿</h1>
          <p className="submission-heading-warm">
            <span>
              谢谢你来过，也谢谢你愿意分享。愿每一份真诚的记录，都有回响！
            </span>
            <SubmissionPiggy className="submission-piggy" />
          </p>
        </div>
        <Button asChild className="submission-create-action">
          <Link href="/me/interviews/new">
            <Plus aria-hidden="true" />
            投稿面经
          </Link>
        </Button>
      </div>
      <nav className="my-account-links" aria-label="账户与管理入口">
        <Link href="/about">关于 / 反馈</Link>
        {user?.role === "ADMIN" && <Link href="/admin/reviews">管理员审核</Link>}
        <button type="button" disabled={signingOut} onClick={requestSignOut}>
          {signingOut ? "正在退出…" : "退出登录"}
        </button>
      </nav>
      <div className="submission-tabs" role="group" aria-label="筛选投稿状态">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`submission-tab${(status ?? "ALL") === tab.value ? " is-active" : ""}`}
            aria-pressed={(status ?? "ALL") === tab.value}
            onClick={() => {
              setError(null);
              setStatus(tab.status);
              setPage(1);
            }}
          >
            {tab.label}
            {counts.status === "success" && counts.data[tab.value] > 0 && (
              <span className="submission-tab-count">{counts.data[tab.value]}</span>
            )}
          </button>
        ))}
      </div>
      <RequestFeedback error={error} retry={resource.retry} />
      {resource.status === "loading" ? (
        <Loading />
      ) : resource.status === "error" ? (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      ) : (
        <>
          {resource.data.items.length === 0 ? (
            <PageState
              title={
                status
                  ? `还没有${statusLabels[status]}投稿`
                  : "第一份面经，从你开始"
              }
              description="真实的提问和追问，即使只记得一轮，也值得分享。"
              action="开始投稿"
              href="/me/interviews/new"
            />
          ) : (
            <div className="workspace-list submission-list">
              {resource.data.items.map((interview) => (
                <SubmissionCard
                  interview={interview}
                  key={interview.id}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>
          )}
          <Pagination
            page={resource.data.page}
            size={resource.data.size}
            total={resource.data.total}
            onPage={setPage}
          />
        </>
      )}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(null);
        }}
      >
        <DialogContent
          showCloseButton={!deleting}
          className="submission-delete-dialog"
        >
          <DialogTitle>删除这份草稿？</DialogTitle>
          <DialogDescription>
            尚未提交审核的草稿会被永久删除，删除后无法恢复。
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setConfirmDelete(null)}
            >
              保留草稿
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeDraft()}
            >
              {deleting ? "正在删除…" : "删除草稿"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MyInterviewsPage() {
  return (
    <>
      <SiteHeader />
      <main className="workspace-page submissions-page">
        <AuthGate>
          <MyInterviewsContent />
        </AuthGate>
      </main>
    </>
  );
}

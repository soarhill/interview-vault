"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
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
import { useInterviewForm } from "@/hooks/use-interview-form";
import { useResource } from "@/hooks/use-resource";
import { getAdminInterview, saveAdminInterview } from "@/lib/api/reviews";
import type {
  AdminPublishedInterviewResponse,
  PublishedInterview,
  Warning,
} from "@/lib/api/types";
import { AggregateComparison } from "./aggregate-comparison";
import { publishedUpdateRequest, reviewConflict } from "./review-state";
import { reviewTime } from "./review-navigation";

interface EditorSource {
  key: string;
  url: string;
}
function editorSources(interview: PublishedInterview): EditorSource[] {
  return interview.sources.map((source) => ({
    key: `source-${source.id}`,
    url: source.url,
  }));
}
function validSource(url: string) {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function AdminInterviewEditor({
  initial,
}: {
  initial: AdminPublishedInterviewResponse;
}) {
  const [detail, setDetail] = useState(initial);
  const form = useInterviewForm(payloadFromInterview(initial.interview));
  const [sources, setSources] = useState(() =>
    editorSources(initial.interview),
  );
  const [sourceBaseline, setSourceBaseline] = useState(() =>
    JSON.stringify(initial.interview.sources.map((source) => source.url)),
  );
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<"save" | "refresh" | null>(null);
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [reconfirmation, setReconfirmation] =
    useState<PublishedInterview | null>(null);
  const sourceUrls = sources.map((source) => source.url);
  const sourcesDirty = JSON.stringify(sourceUrls) !== sourceBaseline;
  const dirty = form.dirty || sourcesDirty;
  const conflict = reviewConflict(error);
  const stopped =
    !!busy || !!conflict || !!reconfirmation || !detail.actions.canEditDirectly;

  async function reloadLatest() {
    const keepContent = form.dirty;
    const keepSources = sourcesDirty;
    setBusy("refresh");
    try {
      const latest = await getAdminInterview(detail.interview.id);
      setDetail(latest);
      setError(null);
      if (!keepContent) form.markSaved(payloadFromInterview(latest.interview));
      if (!keepSources) setSources(editorSources(latest.interview));
      setSourceBaseline(
        JSON.stringify(latest.interview.sources.map((source) => source.url)),
      );
      if (keepContent || keepSources) {
        setReconfirmation(latest.interview);
        setNotice(
          "已读取最新正式内容。你的未保存正文和来源链接仍保留，请核对后继续。",
        );
      } else {
        setReconfirmation(null);
        setNotice("已读取最新正式内容。");
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const nextIssues = validateInterview(form.payload, "published");
    const invalidSources = sources
      .filter((source) => !validSource(source.url))
      .map((source) => source.key);
    setIssues(nextIssues);
    setSourceErrors(invalidSources);
    if (stopped || nextIssues.length || invalidSources.length) return;
    setBusy("save");
    setError(null);
    setNotice("");
    try {
      const result = await saveAdminInterview(
        detail.interview.id,
        publishedUpdateRequest(
          form.payload,
          detail.interview.version,
          sourceUrls,
        ),
      );
      setDetail((current) => ({ ...current, interview: result.interview }));
      form.markSaved(payloadFromInterview(result.interview));
      setSources(editorSources(result.interview));
      setSourceBaseline(
        JSON.stringify(result.interview.sources.map((source) => source.url)),
      );
      setWarnings(result.warnings);
      setNotice(
        `正式内容已更新，修改前版本已留存审计。`,
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  }

  const interview = detail.interview;
  return (
    <>
      <UnsavedChanges dirty={dirty} />
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">已发布内容治理</span>
          <h1>
            编辑 {interview.company.name} · {interview.position.name}
          </h1>
          <p>
            更新于 {reviewTime(interview.updateTime)}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() => void reloadLatest()}
        >
          读取最新内容
        </Button>
      </div>
      <div className="workspace-notice">
        <p>
          保存会直接更新公开内容，并留存修改前版本。新增名称将在保存时成为正式目录项。
        </p>
      </div>
      {detail.pendingChangeRequest && (
        <div className="workspace-conflict" role="alert">
          <strong>这份面经有待处理的变更申请</strong>
          <p>请先处理作者申请，再直接修改公开内容。</p>
          <Link
            href={`/admin/change-requests/${detail.pendingChangeRequest.id}`}
            className="workspace-link"
          >
            查看变更申请 →
          </Link>
        </div>
      )}
      {error && (
        <RequestFeedback error={error} retry={() => void reloadLatest()} />
      )}
      {notice && (
        <div className="workspace-notice" role="status">
          {notice}
        </div>
      )}
      {warnings.map((warning) => (
        <div className="workspace-notice" role="status" key={warning.code}>
          {warning.message}
        </div>
      ))}
      {reconfirmation && (
        <section className="workspace-card">
          <h2>核对最新正式内容</h2>
          <p className="workspace-meta">
            当前编辑器保留了你尚未保存的输入，请对照最新版本后决定是否继续提交。
          </p>
          <AggregateComparison
            original={payloadFromInterview(reconfirmation)}
            current={form.payload}
            originalSources={reconfirmation.sources.map((source) => source.url)}
            currentSources={sourceUrls}
            originalTitle="最新正式版本"
            currentTitle="保留的本地修改"
          />
          <Button disabled={!!busy} onClick={() => setReconfirmation(null)}>
            已核对，继续编辑
          </Button>
        </section>
      )}
      {(interview.originalPositionName ||
        interview.inferredPositionName ||
        interview.note) && (
        <section className="workspace-card">
          <h2>历史事实记录</h2>
          <p className="workspace-meta">这些说明随原记录保留。</p>
          <dl className="review-facts">
            {interview.originalPositionName && (
              <>
                <dt>原岗位</dt>
                <dd>{interview.originalPositionName}</dd>
              </>
            )}
            {interview.inferredPositionName && (
              <>
                <dt>推断岗位</dt>
                <dd>{interview.inferredPositionName}</dd>
              </>
            )}
            {interview.note && (
              <>
                <dt>事实备注</dt>
                <dd>{interview.note}</dd>
              </>
            )}
          </dl>
        </section>
      )}
      <InterviewForm
        value={form.value}
        onChange={form.setValue}
        errors={issues}
        disabled={!!busy || !detail.actions.canEditDirectly}
        allowProposed={false}
        showSource={false}
      />
      <section className="workspace-card">
        <div className="workspace-heading">
          <div>
            <h2>全部来源链接</h2>
            <p className="workspace-meta">
              每条来源都会完整保存。删除某条链接表示移除该来源。
            </p>
          </div>
        </div>
        <div className="workspace-stack">
          {sources.map((source, index) => (
            <div key={source.key} className="review-source-editor">
              <label htmlFor={source.key} className="field-label">
                来源 {index + 1}
              </label>
              <div className="workspace-actions">
                <input
                  id={source.key}
                  type="url"
                  className="field-input"
                  value={source.url}
                  disabled={!!busy || !detail.actions.canEditDirectly}
                  aria-invalid={sourceErrors.includes(source.key)}
                  aria-describedby={
                    sourceErrors.includes(source.key)
                      ? `${source.key}-error`
                      : undefined
                  }
                  onChange={(event) =>
                    setSources((current) =>
                      current.map((item) =>
                        item.key === source.key
                          ? { ...item, url: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  disabled={!!busy || !detail.actions.canEditDirectly}
                  onClick={() =>
                    setSources((current) =>
                      current.filter((item) => item.key !== source.key),
                    )
                  }
                >
                  移除
                </Button>
              </div>
              {sourceErrors.includes(source.key) && (
                <p
                  id={`${source.key}-error`}
                  className="field-error"
                  role="alert"
                >
                  请填写有效的 http:// 或 https:// 来源链接，或移除这一项。
                </p>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          disabled={!!busy || !detail.actions.canEditDirectly}
          onClick={() =>
            setSources((current) => [
              ...current,
              { key: `source-${crypto.randomUUID()}`, url: "" },
            ])
          }
        >
          ＋ 添加来源
        </Button>
      </section>
      <div className="workspace-action-bar">
        <span className="workspace-meta">
          {dirty ? "有未保存的修改" : "全部修改已保存"}
        </span>
        <div className="workspace-actions">
          <Button variant="outline" asChild>
            <Link href={`/interview/${interview.id}`}>查看公开内容</Link>
          </Button>
          <Button disabled={stopped || !dirty} onClick={() => void save()}>
            {busy === "save" ? "正在保存…" : "保存并更新公开内容"}
          </Button>
        </div>
      </div>
    </>
  );
}

function AdminInterviewEdit({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getAdminInterview(id, signal),
    [id],
  );
  const resource = useResource(`admin-interview:${id}`, load);
  return (
    <main className="workspace-page">
      <Link className="workspace-back" href={`/interview/${id}`}>
        ← 返回公开面经
      </Link>
      {resource.status === "loading" && <Loading detail />}
      {resource.status === "error" && (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      )}
      {resource.status === "success" && (
        <AdminInterviewEditor key={id} initial={resource.data} />
      )}
    </main>
  );
}

export function AdminInterviewEditPage({ id }: { id: string }) {
  return (
    <>
      <SiteHeader />
      <AuthGate admin>
        <AdminInterviewEdit id={id} />
      </AuthGate>
    </>
  );
}

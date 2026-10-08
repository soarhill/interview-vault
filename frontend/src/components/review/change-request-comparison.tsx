"use client";

import { ArrowRight, FileText, Info, Sparkles } from "lucide-react";
import { RequestFeedback } from "@/components/shared/request-feedback";
import type {
  ChangeRequestStatus,
  InterviewChangePayload,
} from "@/lib/api/types";
import { externalHref } from "@/lib/url";
import { useComparisonCatalog } from "./aggregate-comparison";
import {
  catalogName,
  changeRequestDiff,
  roundLabel,
  tagNames,
  type ComparisonCatalog,
  type ContentChange,
} from "./change-request-diff";
import styles from "./change-request-detail.module.css";

function VersionCard({
  payload,
  catalog,
  sources,
  changes,
  side,
  title,
  status,
}: {
  payload: InterviewChangePayload;
  catalog: ComparisonCatalog;
  sources?: string[];
  changes: ContentChange[];
  side: "original" | "current";
  title: string;
  status: ChangeRequestStatus;
}) {
  const paths = new Set(
    changes.flatMap((change) => {
      const path =
        side === "original" ? change.originalPath : change.currentPath;
      return path ? [path] : [];
    }),
  );
  const changed = (path: string) => paths.has(path);
  const highlight = (path: string) =>
    changed(path)
      ? side === "current"
        ? styles.changed
        : styles.previous
      : "";
  const tags = tagNames(payload, catalog);
  const urls = sources ?? (payload.sourceUrl ? [payload.sourceUrl] : []);
  const proposed = side === "current";
  const badge = proposed
    ? status === "PENDING"
      ? "待审核"
      : status === "APPROVED"
        ? "已批准"
        : "已拒绝"
    : title === "审批前公开内容"
      ? "审批前版本"
      : "当前版本";

  return (
    <section className={styles.versionCard} aria-label={title} data-side={side}>
      <header className={styles.cardHeading}>
        <span
          className={`${styles.documentIcon} ${proposed ? styles.proposedIcon : ""}`}
        >
          <FileText size={22} aria-hidden="true" />
        </span>
        <h2>{title}</h2>
        <span
          className={`${styles.versionBadge} ${proposed ? styles.proposedBadge : ""}`}
        >
          {badge}
        </span>
      </header>
      <dl className={styles.facts}>
        <dt>公司</dt>
        <dd className={highlight("company")}>
          {catalogName(payload.company, catalog.companies)}
        </dd>
        <dt>岗位</dt>
        <dd className={highlight("position")}>
          {catalogName(payload.position, catalog.positions)}
        </dd>
        <dt>部门</dt>
        <dd className={highlight("department")}>
          {payload.department || "未填写"}
        </dd>
        <dt>招聘类型</dt>
        <dd className={highlight("recruitType")}>
          {payload.recruitType === "INTERN"
            ? "实习"
            : payload.recruitType === "CAMPUS"
              ? "校招"
              : "未填写"}
        </dd>
        <dt>标签</dt>
        <dd className={`${styles.tags} ${highlight("tags")}`}>
          {tags.length
            ? tags.map((tag, index) => (
                <span key={`${index}:${tag}`}>{tag}</span>
              ))
            : "无"}
        </dd>
      </dl>
      <div className={styles.interviewContent}>
        <h3>
          面试内容 <span>（共 {payload.rounds.length} 面）</span>
        </h3>
        {changed("rounds.order") && (
          <p className={styles.orderNote}>面试轮次顺序已调整</p>
        )}
        {payload.rounds.length === 0 && (
          <p className={styles.empty}>尚无面试轮次</p>
        )}
        {payload.rounds.map((round, index) => {
          const path = `rounds.${index}`;
          return (
            <section
              className={`${styles.round} ${highlight(path)}`}
              key={round.id ?? `new:${index}`}
            >
              <div className={styles.roundHeading}>
                <h4 className={highlight(`${path}.title`)}>
                  {roundLabel(round)}
                </h4>
                <time className={highlight(`${path}.date`)}>
                  {round.interviewDate || "日期未确认"}
                </time>
              </div>
              {changed(`${path}.questions.order`) && (
                <p className={styles.orderNote}>问题顺序已调整</p>
              )}
              {round.questions.length === 0 && (
                <p className={styles.empty}>尚无问题</p>
              )}
              {round.questions.map((question, questionIndex) => {
                const questionPath = `${path}.questions.${questionIndex}`;
                const contentChanged =
                  changed(questionPath) || changed(`${questionPath}.content`);
                return (
                  <article
                    className={styles.question}
                    key={question.id ?? `new:${questionIndex}`}
                  >
                    <p
                      className={`${styles.questionContent} ${contentChanged ? (proposed ? styles.changed : styles.previous) : ""}`}
                      data-changed={contentChanged || undefined}
                    >
                      <strong>Q{questionIndex + 1}.</strong>
                      <span>{question.content || "问题未填写"}</span>
                      {contentChanged && proposed && (
                        <span className="sr-only">（此问题有变更）</span>
                      )}
                    </p>
                    {externalHref(question.referenceUrl) ? (
                      <a
                        className={`${styles.questionLink} ${highlight(`${questionPath}.link`)}`}
                        href={externalHref(question.referenceUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        题目链接 ↗
                      </a>
                    ) : (
                      question.referenceUrl && (
                        <span
                          className={`${styles.questionLink} ${highlight(`${questionPath}.link`)}`}
                        >
                          题目链接（无效链接）
                        </span>
                      )
                    )}
                    {changed(`${questionPath}.followUps.order`) && (
                      <p className={styles.orderNote}>追问顺序已调整</p>
                    )}
                    {question.followUps.length > 0 && (
                      <ol className={styles.followUps}>
                        {question.followUps.map((follow, followIndex) => (
                          <li
                            className={highlight(
                              `${questionPath}.followUps.${followIndex}`,
                            )}
                            key={follow.id ?? `new:${followIndex}`}
                          >
                            {follow.content || "追问未填写"}
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      {(urls.length > 0 || changed("sources")) && (
        <div className={`${styles.sources} ${highlight("sources")}`}>
          <h3>来源</h3>
          {urls.length ? (
            urls.map((url, index) =>
              externalHref(url) ? (
                <a
                  href={externalHref(url)}
                  key={`${index}:${url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {url} ↗
                </a>
              ) : (
                <span key={`${index}:${url}`}>{url}</span>
              ),
            )
          ) : (
            <p className={styles.empty}>未提供来源链接</p>
          )}
        </div>
      )}
    </section>
  );
}

function ChangeLine({ change }: { change: ContentChange }) {
  if (!change.originalPath)
    return (
      <li>
        <strong>{change.label}</strong>
        <span>新增</span>
        <ins>「{change.after}」</ins>
      </li>
    );
  if (!change.currentPath)
    return (
      <li>
        <strong>{change.label}</strong>
        <span>删除</span>
        <del>「{change.before}」</del>
      </li>
    );
  return (
    <li>
      <strong>{change.label}</strong>
      <span>从</span>
      <del>「{change.before}」</del>
      <span>修改为</span>
      <ins>「{change.after}」</ins>
    </li>
  );
}

export function ChangeRequestComparison({
  original,
  current,
  originalSources,
  originalTitle,
  status,
}: {
  original: InterviewChangePayload;
  current: InterviewChangePayload;
  originalSources: string[];
  originalTitle: string;
  status: ChangeRequestStatus;
}) {
  const resource = useComparisonCatalog();
  const catalog =
    resource.status === "success"
      ? resource.data
      : { companies: [], positions: [], tags: [] };
  const changes = changeRequestDiff(
    original,
    current,
    catalog,
    originalSources,
  );
  return (
    <>
      {resource.status === "loading" && (
        <p className={styles.empty} role="status">
          正在读取正式目录名称…
        </p>
      )}
      {resource.status === "error" && (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      )}
      <div className={styles.diffNotice} role="status">
        <Info size={20} aria-hidden="true" />
        <p>
          {changes.length ? (
            <>
              本次申请包含 <strong>{changes.length} 处变更</strong>
              ，已高亮展示差异。
            </>
          ) : (
            "两侧内容一致，没有内容变更。"
          )}
        </p>
      </div>
      <div className={styles.comparison}>
        <VersionCard
          payload={original}
          catalog={catalog}
          sources={originalSources}
          changes={changes}
          side="original"
          title={originalTitle}
          status={status}
        />
        <span className={styles.compareArrow} aria-hidden="true">
          <ArrowRight size={22} />
        </span>
        <VersionCard
          payload={current}
          catalog={catalog}
          changes={changes}
          side="current"
          title="申请修改后的版本"
          status={status}
        />
      </div>
      {changes.length > 0 && (
        <section className={styles.changeSummary} aria-label="变更点">
          <h2>
            <Sparkles size={20} aria-hidden="true" />
            变更点
          </h2>
          <div>
            <ul>
              {changes.slice(0, 3).map((change, index) => (
                <ChangeLine change={change} key={index} />
              ))}
            </ul>
            {changes.length > 3 && (
              <details>
                <summary>查看其余 {changes.length - 3} 处变更</summary>
                <ul>
                  {changes.slice(3).map((change, index) => (
                    <ChangeLine change={change} key={index} />
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>
      )}
    </>
  );
}

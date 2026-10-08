"use client";

import { useCallback } from "react";
import { useResource } from "@/hooks/use-resource";
import { listCompanies, listPositions, listTags } from "@/lib/api/catalog";
import { externalHref } from "@/lib/url";
import type {
  Company,
  InterviewChangePayload,
  Position,
  SelectionInput,
  Tag,
} from "@/lib/api/types";
import { RequestFeedback } from "@/components/shared/request-feedback";

interface Catalog {
  companies: Company[];
  positions: Position[];
  tags: Tag[];
}

function selectionName(
  selection: SelectionInput,
  catalog: { id: number; name: string }[],
  label: string,
) {
  if (selection.proposedName) return `${selection.proposedName}（新增项）`;
  if (selection.existingId != null)
    return (
      catalog.find((item) => item.id === selection.existingId)?.name ??
      `${label} #${selection.existingId}`
    );
  return "未填写";
}

function AggregatePreview({
  payload,
  catalog,
  sources,
  highlightFields,
}: {
  payload: InterviewChangePayload;
  catalog: Catalog;
  sources?: string[];
  highlightFields?: Set<string>;
}) {
  const urls = sources ?? (payload.sourceUrl ? [payload.sourceUrl] : []);
  const tags = [
    ...payload.tagIds.map(
      (id) => catalog.tags.find((tag) => tag.id === id)?.name ?? `标签 #${id}`,
    ),
    ...payload.proposedTags.map((tag) => `${tag}（新增项）`),
  ];
  const diff = (field: string) =>
    highlightFields?.has(field) ? " review-diff-field" : "";
  return (
    <div className="review-preview">
      <dl className="review-facts">
        <dt className={diff("company")}>公司</dt>
        <dd className={diff("company")}>{selectionName(payload.company, catalog.companies, "公司")}</dd>
        <dt className={diff("position")}>岗位</dt>
        <dd className={diff("position")}>{selectionName(payload.position, catalog.positions, "岗位")}</dd>
        <dt className={diff("department")}>部门</dt>
        <dd className={diff("department")}>{payload.department || "未填写"}</dd>
        <dt className={diff("recruitType")}>招聘类型</dt>
        <dd className={diff("recruitType")}>
          {payload.recruitType === "INTERN"
            ? "实习"
            : payload.recruitType === "CAMPUS"
              ? "校招"
              : "未填写"}
        </dd>
        <dt className={diff("tags")}>标签</dt>
        <dd className={diff("tags")}>{tags.join("、") || "无"}</dd>
      </dl>
      {payload.rounds.length === 0 && (
        <p className="workspace-meta">尚无面试轮次</p>
      )}
      {payload.rounds.map((round, index) => (
        <section
          className={`review-round${highlightFields?.has(`rounds.${index}`) ? " review-diff-field" : ""}`}
          key={round.id ?? index}
        >
          <div className="workspace-heading">
            <h3>
              {round.roundType === "HR"
                ? "HR 面"
                : round.roundType === "TECHNICAL"
                  ? `技术第 ${round.roundNo} 面`
                  : "其他轮次"}
            </h3>
            <span className="workspace-meta">
              {round.interviewDate || "日期未确认"}
            </span>
          </div>
          {round.questions.length === 0 && (
            <p className="workspace-meta">尚无问题</p>
          )}
          {round.questions.map((question, questionIndex) => (
            <article
              className="review-question"
              key={question.id ?? questionIndex}
            >
              <p>
                <strong>Q{questionIndex + 1}.</strong>{" "}
                {question.content || "问题未填写"}
              </p>
              {externalHref(question.referenceUrl) ? (
                <a
                  href={externalHref(question.referenceUrl)}
                  target="_blank"
                  rel="noreferrer"
                >
                  题目链接 ↗
                </a>
              ) : (
                question.referenceUrl && <span>题目链接（无效链接）</span>
              )}
              {question.followUps.length > 0 && (
                <ol className="review-follow-ups">
                  {question.followUps.map((followUp, followIndex) => (
                    <li key={followUp.id ?? followIndex}>
                      {followUp.content || "追问未填写"}
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </section>
      ))}
      <div className="review-sources">
        <strong>来源</strong>
        {urls.length ? (
          urls.map((url, index) =>
            externalHref(url) ? (
              <a
                key={`${index}:${url}`}
                href={externalHref(url)}
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
          <p className="workspace-meta">未提供来源链接</p>
        )}
      </div>
    </div>
  );
}

export function useComparisonCatalog() {
  const load = useCallback(async (signal: AbortSignal) => {
    const [companies, positions, tags] = await Promise.all([
      listCompanies("", signal),
      listPositions({}, signal),
      listTags("", signal),
    ]);
    return {
      companies: companies.items,
      positions: positions.items,
      tags: tags.items,
    };
  }, []);
  const resource = useResource("review-comparison-catalog", load);
  return resource;
}

export function AggregateReadView({
  payload,
  sources,
}: {
  payload: InterviewChangePayload;
  sources?: string[];
}) {
  const resource = useComparisonCatalog();
  const catalog =
    resource.status === "success"
      ? resource.data
      : { companies: [], positions: [], tags: [] };
  return (
    <>
      {resource.status === "loading" && (
        <p className="workspace-meta" role="status">
          正在读取正式目录名称…
        </p>
      )}
      {resource.status === "error" && (
        <RequestFeedback error={resource.error} retry={resource.retry} />
      )}
      <AggregatePreview payload={payload} catalog={catalog} sources={sources} />
    </>
  );
}

export function AggregateComparison({
  original,
  current,
  originalTitle = "原始投稿",
  currentTitle = "当前审核内容",
  originalSources,
  currentSources,
}: {
  original: InterviewChangePayload;
  current: InterviewChangePayload;
  originalTitle?: string;
  currentTitle?: string;
  originalSources?: string[];
  currentSources?: string[];
}) {
  const resource = useComparisonCatalog();
  const catalog =
    resource.status === "success"
      ? resource.data
      : { companies: [], positions: [], tags: [] };

  // 按展示名做逐字段对比，找出有差异的字段（含逐轮次）
  const sig = (payload: InterviewChangePayload) => ({
    company: selectionName(payload.company, catalog.companies, "公司"),
    position: selectionName(payload.position, catalog.positions, "岗位"),
    department: payload.department || "未填写",
    recruitType:
      payload.recruitType === "INTERN"
        ? "实习"
        : payload.recruitType === "CAMPUS"
          ? "校招"
          : "未填写",
    tags: [
      ...payload.tagIds.map(
        (id) => catalog.tags.find((tag) => tag.id === id)?.name ?? `标签 #${id}`,
      ),
      ...payload.proposedTags.map((tag) => `${tag}（新增项）`),
    ].join("、"),
    rounds: payload.rounds
      .map((round) =>
        [
          round.roundType === "HR"
            ? "HR 面"
            : round.roundType === "TECHNICAL"
              ? `技术第 ${round.roundNo} 面`
              : "其他轮次",
          round.interviewDate || "",
          ...round.questions.map(
            (question) =>
              `${question.content}|${question.referenceUrl ?? ""}|${question.followUps.map((f) => f.content).join(">")}`,
          ),
        ].join("\n"),
      )
      .join("\n==\n"),
  });
  const a = sig(original);
  const b = sig(current);
  const diffFields = new Set<string>(
    (Object.keys(a) as (keyof typeof a)[]).filter((key) => a[key] !== b[key]),
  );
  const roundDiff = new Set(
    payload_roundDiffIndexes(original, current) ?? [],
  );
  diffFields.forEach((field) => {
    if (field.startsWith("rounds.")) roundDiff.add(field);
  });

  return (
    <>
      {diffFields.size === 0 && (
        <p className="workspace-meta" role="status">
          两侧内容一致——作者提交后未做过修改。
        </p>
      )}
      {diffFields.size > 0 && (
        <p className="workspace-meta">
          高亮字段为与另一侧不同的部分（共 {diffFields.size} 处）。
        </p>
      )}
      <div className="review-two-columns">
        <section className="workspace-card review-compare">
          <h2>{originalTitle}</h2>
          <AggregatePreview
            payload={original}
            catalog={catalog}
            sources={originalSources}
            highlightFields={new Set([
              ...diffFields,
              ...[...roundDiff].map((key) => key),
            ])}
          />
        </section>
        <section className="workspace-card review-compare">
          <h2>{currentTitle}</h2>
          <AggregatePreview
            payload={current}
            catalog={catalog}
            sources={currentSources}
            highlightFields={new Set([
              ...diffFields,
              ...[...roundDiff].map((key) => key),
            ])}
          />
        </section>
      </div>
    </>
  );
}

/** 逐轮次对比：返回内容不同的轮次下标集合（"rounds.0" 形式）。 */
function payload_roundDiffIndexes(
  original: InterviewChangePayload,
  current: InterviewChangePayload,
): string[] {
  const result: string[] = [];
  const max = Math.max(original.rounds.length, current.rounds.length);
  for (let index = 0; index < max; index++) {
    const serialize = (round: InterviewChangePayload["rounds"][number]) =>
      JSON.stringify([
        round.interviewDate,
        ...round.questions.map(
          (question) =>
            `${question.content}|${question.referenceUrl ?? ""}|${question.followUps.map((f) => f.content).join(">")}`,
        ),
      ]);
    const a = original.rounds[index] ? serialize(original.rounds[index]) : null;
    const b = current.rounds[index] ? serialize(current.rounds[index]) : null;
    if (a !== b) result.push(`rounds.${index}`);
  }
  return result;
}

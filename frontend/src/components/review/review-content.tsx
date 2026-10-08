"use client";

import {
  BookOpenText,
  ClipboardList,
  CornerDownRight,
  ChevronDown,
  ExternalLink,
  Link2,
} from "lucide-react";
import type {
  AdminReviewResponse,
  Candidate,
  CatalogSelectionView,
} from "@/lib/api/types";
import { externalHref } from "@/lib/url";
import { reviewTime } from "./review-navigation";
import styles from "./review-workbench.module.css";

type Interview = AdminReviewResponse["interview"];

export function reviewRoundName(round: Interview["rounds"][number]) {
  if (round.roundType === "HR") return "HR 面";
  if (round.roundType === "TECHNICAL" && round.roundNo != null)
    return (
      ["一面", "二面", "三面", "四面", "五面"][round.roundNo - 1] ??
      round.displayName
    );
  return round.remark || round.displayName || "未明确轮次";
}

function roundDate(round: Interview["rounds"][number]) {
  if (!round.interviewDate) return null;
  if (round.interviewDatePrecision === "YEAR")
    return `${round.interviewDate.slice(0, 4)}年`;
  if (round.interviewDatePrecision === "MONTH")
    return `${round.interviewDate.slice(0, 4)}年${Number(round.interviewDate.slice(5, 7))}月`;
  return round.interviewDate;
}

function questionReference(question: {
  referenceUrl?: string | null;
  leetcodeUrl?: string | null;
}) {
  return externalHref(question.referenceUrl ?? question.leetcodeUrl);
}

export function ReviewCatalogName({
  selection,
  kind,
  candidates,
  onLocate,
}: {
  selection: CatalogSelectionView | null;
  kind: Candidate["type"];
  candidates: Candidate[];
  onLocate: (id: number) => void;
}) {
  if (!selection) return <span className={styles.muted}>未填写</span>;
  const candidate = candidates.find(
    (item) =>
      item.type === kind && (kind !== "TAG" || item.value === selection.name),
  );
  if (selection.source === "PROPOSED" && candidate) {
    return (
      <button
        type="button"
        className={styles.pendingValue}
        onClick={() => onLocate(candidate.id)}
      >
        {selection.name}
        <span className={styles.pendingBadge}>待确认</span>
      </button>
    );
  }
  return <span>{selection.name}</span>;
}

export function ReviewTags({
  tags,
  candidates,
  onLocate,
}: {
  tags: Interview["tags"];
  candidates: Candidate[];
  onLocate: (id: number) => void;
}) {
  return (
    <div className={styles.tags} aria-label="标签与考点">
      {tags.map((tag) => {
        const candidate = candidates.find(
          (item) => item.type === "TAG" && item.value === tag.name,
        );
        return candidate && tag.source === "PROPOSED" ? (
          <button
            type="button"
            className={styles.pendingTag}
            key={`proposed:${tag.name}`}
            onClick={() => onLocate(candidate.id)}
          >
            {tag.name}
            <span>待确认</span>
          </button>
        ) : (
          <span className={styles.tag} key={tag.id ?? tag.name}>
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}

export function ReviewContent({
  interview,
  candidates,
  submittedAt,
  onLocate,
}: {
  interview: Interview;
  candidates: Candidate[];
  submittedAt: string | null;
  onLocate: (id: number) => void;
}) {
  const source = externalHref(interview.sourceUrl);
  return (
    <article className={styles.readingCard} aria-label="面经审核预览">
      <section
        className={styles.factsSection}
        aria-labelledby="review-basic-information"
      >
        <h2 id="review-basic-information" className={styles.sectionTitle}>
          <BookOpenText size={21} aria-hidden="true" />
          基本信息
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>公司</dt>
            <dd>
              <ReviewCatalogName
                selection={interview.company}
                kind="COMPANY"
                candidates={candidates}
                onLocate={onLocate}
              />
            </dd>
          </div>
          <div>
            <dt>招聘类型</dt>
            <dd>
              {interview.recruitType === "INTERN"
                ? "实习"
                : interview.recruitType === "CAMPUS"
                  ? "校招"
                  : "未填写"}
            </dd>
          </div>
          <div>
            <dt>岗位</dt>
            <dd>
              <ReviewCatalogName
                selection={interview.position}
                kind="POSITION"
                candidates={candidates}
                onLocate={onLocate}
              />
            </dd>
          </div>
          <div>
            <dt>面试轮次</dt>
            <dd>
              {interview.rounds.map(reviewRoundName).join(" · ") || "尚未填写"}
            </dd>
          </div>
          <div>
            <dt>部门</dt>
            <dd>{interview.department || "未填写"}</dd>
          </div>
          <div>
            <dt>提交时间</dt>
            <dd>{submittedAt ? reviewTime(submittedAt) : "未记录"}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.roundsSection}
        aria-labelledby="review-interview-process"
      >
        <h2 id="review-interview-process" className={styles.sectionTitle}>
          <ClipboardList size={21} aria-hidden="true" />
          面试过程
        </h2>
        {interview.rounds.length === 0 && (
          <p className={styles.empty}>尚未填写面试轮次。</p>
        )}
        {interview.rounds.map((round) => (
          <details className={styles.round} key={round.id} open>
            <summary>
              <strong>{reviewRoundName(round)}</strong>
              <span>
                {roundDate(round) || "日期未确认"} · 共 {round.questions.length}{" "}
                个问题
              </span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <ol className={styles.questions}>
              {round.questions.map((question, index) => (
                <li className={styles.question} key={question.id}>
                  <span className={styles.questionNumber}>Q{index + 1}</span>
                  <div className={styles.questionContent}>
                    {question.sectionLabel && (
                      <span className={styles.tag}>
                        {question.sectionLabel}
                      </span>
                    )}
                    <p>{question.content}</p>
                    {question.contextNote && (
                      <p className={styles.contextNote}>
                        {question.contextNote}
                      </p>
                    )}
                    {question.algorithmTitle &&
                      question.algorithmTitle !== question.content && (
                        <p className={styles.algorithmTitle}>
                          {question.algorithmTitle}
                        </p>
                      )}
                    {question.algorithmDescription && (
                      <p className={styles.contextNote}>
                        {question.algorithmDescription}
                      </p>
                    )}
                    {question.algorithmRequirements && (
                      <p className={styles.contextNote}>
                        {question.algorithmRequirements}
                      </p>
                    )}
                    {question.followUps.length > 0 && (
                      <ol className={styles.followUps}>
                        {question.followUps.map((follow) => (
                          <li key={follow.id}>
                            <CornerDownRight size={15} aria-hidden="true" />
                            <span>{follow.content}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {questionReference(question) && (
                      <a
                        className={styles.questionLink}
                        href={questionReference(question)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        相关题目
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {round.questions.length === 0 && (
              <p className={styles.empty}>这轮暂未记录问题。</p>
            )}
          </details>
        ))}
      </section>

      <section
        className={styles.sourcesSection}
        aria-labelledby="review-sources"
      >
        <h2 id="review-sources" className={styles.sectionTitle}>
          <Link2 size={21} aria-hidden="true" />
          来源<span className={styles.optional}>可选</span>
        </h2>
        {source ? (
          <a
            href={source}
            className={styles.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            {interview.sourceUrl}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        ) : (
          <p className={styles.empty}>
            {interview.sourceUrl || "未提供来源链接。"}
          </p>
        )}
      </section>
    </article>
  );
}

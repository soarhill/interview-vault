"use client";
import Link from "next/link";
import type { InterviewSummary } from "@/lib/api/types";
import { rememberList } from "@/lib/navigation";
import { detailUrl, recruitmentLabels } from "@/lib/url-state";
import { formatInterviewDate } from "@/lib/date";
import { CompanyName } from "../shared/company";
import { Highlight } from "../shared/highlight";
import { Icon } from "../shared/icon";
import type { MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function InterviewCard({
  interview,
  q,
}: {
  interview: InterviewSummary;
  q: string;
}) {
  // api-design「面经列表 / 搜索」：命中片段「存在时」返回——无搜索词时后端省略 matches 字段
  const allMatches = interview.matches ?? [];
  const matches = allMatches.slice(0, 2);
  const first = allMatches.find((match) => match.kind !== "META");
  const href = detailUrl(interview.id, q, first?.questionId, first?.followUpId);
  const remember = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !event.button &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    )
      rememberList(`/interview/${interview.id}`);
  };
  return (
    <Card className="interview-card" role="article">
      <div className="card-meta">
        <CompanyName name={interview.company.name} />
        <span className="card-meta-side">
          {interview.recruitType && (
            <Badge
              variant="secondary"
              className={`badge ${interview.recruitType === "INTERN" ? "intern-badge" : "campus-badge"}`}
            >
              {recruitmentLabels[interview.recruitType]}
            </Badge>
          )}
          {interview.department && (
            <span className="card-side-department">{interview.department}</span>
          )}
        </span>
      </div>
      <h2>
        <Link
          className="card-main-link"
          href={href}
          scroll={false}
          onClick={remember}
        >
          <Highlight text={interview.position?.name ?? "岗位未说明"} q={q} />
        </Link>
      </h2>
      <div className="round-badges">
        {interview.rounds.map((name, index) => (
          <Badge variant="secondary" className="badge" key={`${name}-${index}`}>
            {name}
          </Badge>
        ))}
      </div>
      <p className={`card-date${interview.firstInterviewDate ? "" : " card-date-unknown"}`}>
        {interview.firstInterviewDate
          ? formatInterviewDate(
              interview.firstInterviewDate,
              interview.firstInterviewDatePrecision,
            )
          : "面试时间未记录"}
      </p>
      <div className="card-tags">
        {interview.position && (
          <Badge variant="secondary" className="badge category-badge">
            {interview.position.category}
          </Badge>
        )}
        {interview.tags.map((tag, index) => (
          <Badge
            variant="secondary"
            className={`tag${index >= 4 ? " card-tag-extra" : ""}`}
            key={tag}
          >
            <Highlight text={tag} q={q} />
          </Badge>
        ))}
      </div>
      {matches.length > 0 && (
        <div className="match-list">
          {matches.map((match, index) =>
            match.kind === "META" ? (
              <p className="meta-match" key={index}>
                <Highlight text={match.snippet} q={q} />
              </p>
            ) : (
              <Link
                key={`${match.questionId}-${match.followUpId ?? index}`}
                className="match-link"
                href={detailUrl(
                  interview.id,
                  q,
                  match.questionId,
                  match.followUpId,
                )}
                scroll={false}
                onClick={remember}
              >
                <span className="match-location">
                  {match.roundName}
                  {match.kind === "FOLLOW_UP" ? " · 追问" : ""}
                  <Icon name="arrow" size={13} />
                </span>
                <span className="match-snippet">
                  <Highlight text={match.snippet} q={q} />
                </span>
              </Link>
            ),
          )}
        </div>
      )}
      <span className="card-view" aria-hidden="true">
        查看面经
        <Icon name="arrow" size={16} />
      </span>
    </Card>
  );
}

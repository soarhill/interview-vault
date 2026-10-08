import type { Interview } from "@/lib/types";
import { formatInterviewDate } from "@/lib/date";
import { recruitmentLabels } from "@/lib/url-state";
import { CompanyName } from "../shared/company";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DetailHeader({ interview }: { interview: Interview }) {
  return (
    <Card className="detail-heading" role="region" aria-label="面经基本信息">
      <CompanyName name={interview.company.name} />
      <h1>{interview.position?.name ?? "岗位未说明"}</h1>
      {interview.inferredPositionName && (
        <p className="inferred-role">
          据内容判断：{interview.inferredPositionName}
        </p>
      )}
      <div className="detail-meta">
        {interview.firstInterviewDate && (
          <Badge variant="secondary" className="badge year-badge">
            {formatInterviewDate(
              interview.firstInterviewDate,
              interview.firstInterviewDatePrecision,
            )}
          </Badge>
        )}
        <Badge
          variant="secondary"
          className={`badge ${interview.recruitType === "INTERN" ? "intern-badge" : "campus-badge"}`}
        >
          {recruitmentLabels[interview.recruitType]}
        </Badge>
        <Badge variant="secondary" className="badge category-badge">
          {interview.position?.category ?? "岗位方向未说明"}
        </Badge>
        {interview.rounds.some((round) =>
          round.questions.some((q) => q.questionType === "ALGORITHM"),
        ) && <Badge variant="secondary" className="badge algo-badge">含算法题</Badge>}
        {interview.department && (
          <span className="department">{interview.department}</span>
        )}
      </div>
      <div className="detail-tags">
        {/* 详情是完整记录视图：标签全量展示，不做卡片式的 4 个截断 */}
        {interview.tags.map((tag) => (
          <Badge variant="secondary" className="tag" key={tag}>
            {tag}
          </Badge>
        ))}
      </div>
      {interview.originalPositionName && (
        <p className="detail-note">
          原岗位记录：{interview.originalPositionName}
        </p>
      )}
      {interview.note && <p className="detail-note">{interview.note}</p>}
    </Card>
  );
}

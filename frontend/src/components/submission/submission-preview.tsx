import type { RecruitType, RoundInput } from "@/lib/api/types";
export function SubmissionPreview({
  interview,
}: {
  interview: {
    company: { name: string } | null;
    position: { name: string } | null;
    department: string | null;
    recruitType: RecruitType | null;
    tags: { name: string }[];
    rounds: RoundInput[];
    sourceUrl?: string | null;
  };
}) {
  return (
    <div className="editor-preview">
      <p>
        <strong>{interview.company?.name ?? "公司待填写"}</strong>
        {interview.department && ` · ${interview.department}`} ·{" "}
        {interview.position?.name ?? "岗位待填写"}
      </p>
      <p className="editor-help">
        {interview.recruitType
          ? interview.recruitType === "INTERN"
            ? "实习"
            : "校招"
          : "招聘类型待填写"}{" "}
        {interview.tags.map((tag) => tag.name).join(" · ")}
      </p>
      {interview.rounds.map((round, index) => (
        <section className="editor-preview-round" key={round.id ?? index}>
          <h3>
            {round.roundType === "TECHNICAL"
              ? ["一面", "二面", "三面", "四面", "五面"][
                  (round.roundNo ?? 1) - 1
                ]
              : round.roundType === "HR"
                ? "HR 面"
                : "未明确轮次"}{" "}
            <small>{round.interviewDate || "时间未确认"}</small>
          </h3>
          <ol>
            {round.questions.map((question, questionIndex) => (
              <li key={question.id ?? questionIndex}>
                <p>{question.content || "（问题待填写）"}</p>
                {question.referenceUrl && (
                  <p className="editor-help">题目链接：{question.referenceUrl}</p>
                )}
                {question.followUps.length > 0 && (
                  <ul>
                    {question.followUps.map((followUp, followIndex) => (
                      <li key={followUp.id ?? followIndex}>
                        {followUp.content || "（追问待填写）"}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {interview.sourceUrl && (
        <p className="editor-help">来源：{interview.sourceUrl}</p>
      )}
    </div>
  );
}

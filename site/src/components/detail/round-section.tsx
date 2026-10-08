import type { InterviewRound } from "@/lib/types";
import { formatInterviewDate } from "@/lib/date";
import { QuestionCard } from "./question-card";

export function RoundSection({
  round,
  q,
}: {
  round: InterviewRound;
  q: string;
}) {
  const questions = round.questions;
  const emptyMessage = "该轮存在，但原记录未提供具体问题";
  return (
    <section className="round-section" id={`round-${round.id}`} tabIndex={-1}>
      <div className="round-title">
        <h2>{round.displayName}</h2>
        <span>共 {questions.length} 题</span>
        {round.interviewDate && (
          <time>
            {formatInterviewDate(
              round.interviewDate,
              round.interviewDatePrecision,
            )}
          </time>
        )}
      </div>
      {round.remark &&
        (questions.length > 0 || round.remark !== emptyMessage) && (
          <p className="round-note">{round.remark}</p>
        )}
      {!questions.length && (
        <p className="empty-round">该轮存在，但原记录未提供具体问题</p>
      )}
      {questions.map((question, index) => (
        <div key={question.id}>
          <QuestionCard question={question} number={index + 1} q={q} />
        </div>
      ))}
    </section>
  );
}

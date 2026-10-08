import type { Question } from "./api/types";

export function questionText(question: Question): string {
  if (question.questionType !== "ALGORITHM") return question.content;
  return [
    question.content,
    question.algorithmTitle !== question.content
      ? question.algorithmTitle
      : null,
    question.algorithmDescription,
    question.algorithmRequirements,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}
export function chainText(
  question: Question,
  through = question.followUps.length,
): string {
  const follows = question.followUps.slice(0, through);
  const main = questionText(question);
  return follows.length
    ? `${main}\n\n追问：\n${follows.map((item, index) => `${index + 1}. ${item.content}`).join("\n")}`
    : main;
}
/** 单条追问：只复制该条本身（带上下文用「复制整组」）。 */
export function followUpText(question: Question, nth: number): string {
  return question.followUps[nth - 1]?.content ?? "";
}

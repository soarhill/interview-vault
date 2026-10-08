import type { Question } from "@/lib/types";
import { chainText, followUpText, questionText } from "@/lib/copy-text";
import { externalHref } from "@/lib/url";
import { Highlight } from "../shared/highlight";
import { CopyButton } from "./copy-button";
import { Icon } from "../shared/icon";
import { Card } from "@/components/ui/card";

/** 链接文案：知道 LeetCode 题号用题号，否则按平台 / 通用「原题链接」。 */
function linkLabel(question: Question): string {
  if (question.leetcodeNumber != null) return `LeetCode ${question.leetcodeNumber}`;
  const host = question.referenceUrl ?? question.leetcodeUrl ?? "";
  if (/leetcode/i.test(host)) return "LeetCode";
  if (/nowcoder/i.test(host)) return "牛客";
  if (/codeforces/i.test(host)) return "Codeforces";
  return "原题链接";
}

export function QuestionCard({
  question,
  number,
  q,
}: {
  question: Question;
  number: number;
  q: string;
}) {
  const follows = question.followUps;
  const link = externalHref(question.referenceUrl ?? question.leetcodeUrl);
  // 单按钮：有追问给「复制整组」（问题 + 全部追问），没有就只复制问题本身
  const copyText = follows.length ? chainText(question) : questionText(question);
  const copyLabel = follows.length ? "复制整组" : "复制";
  const copyAria = follows.length
    ? `复制 Q${number} 整组`
    : `复制 Q${number}`;
  return (
    <Card
      role="article"
      className="question-card"
      id={`question-${question.id}`}
      tabIndex={-1}
    >
      <div className="question-main">
        <span className="question-number">Q{number}</span>
        <div className="question-main-body">
          <div className="question-heading">
            <h4 className="question-text">
              <Highlight text={question.content} q={q} />
            </h4>
            <div className="copy-actions">
              <CopyButton text={copyText} label={copyLabel} accessibleLabel={copyAria} />
            </div>
          </div>
          {link && (
            <a
              className="question-leetcode-link"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkLabel(question)}
              <Icon name="external" size={13} />
            </a>
          )}
          {follows.length > 0 && (
            <ol className="follow-ups">
              {follows.map((follow, index) => (
                <li key={follow.id} data-follow-up={follow.id} tabIndex={-1}>
                  <div className="follow-heading">
                    <span className="follow-label">追问 {index + 1}</span>
                    <CopyButton
                      text={followUpText(question, index + 1)}
                      accessibleLabel={`复制 Q${number} 追问 ${index + 1}`}
                      secondary
                    />
                  </div>
                  <p className="question-text" data-follow-text>
                    <Highlight text={follow.content} q={q} />
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  );
}

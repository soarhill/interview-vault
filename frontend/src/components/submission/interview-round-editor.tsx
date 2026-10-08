import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "../shared/icon";
import { moveItem, newQuestion, type EditorRound } from "./form-model";
import { QuestionEditor } from "./question-editor";
import { ReorderActions } from "./reorder-actions";
import { RoundDatePicker } from "./round-date-picker";

export function roundDisplayName(value: EditorRound): string {
  if (value.roundType === "HR") return "HR 面";
  if (value.roundType === "TECHNICAL" && value.roundNo != null)
    return ["一面", "二面", "三面", "四面", "五面"][value.roundNo - 1];
  return "未明确轮次";
}

/**
 * 轮次（V1 简化冻结）：一面～五面 / HR 面 + 一个可选日期 + 问题列表。
 * 展开状态由父级管理：新增轮次自动展开、其余收起为单行摘要。
 * 日期用标准日期选择器（记不清就留空），不暴露精度概念。
 */
export function InterviewRoundEditor({
  value,
  index,
  total,
  open,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  value: EditorRound;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onChange: (value: EditorRound) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const dateLabel = value.interviewDate?.slice(0, 10) ?? null;
  const questionCount = value.questions.length;

  return (
    <section
      className={`round-card${open ? " round-card-open" : ""}`}
      data-field={`rounds.${index}`}
    >
      <div className="round-card-header">
        <button
          type="button"
          className="round-card-summary"
          aria-expanded={open}
          onClick={onToggle}
        >
          <strong>{roundDisplayName(value)}</strong>
          {dateLabel && <span>{dateLabel}</span>}
          <span>
            {questionCount > 0 ? `共 ${questionCount} 个问题` : "还没有问题"}
          </span>
        </button>
        <span className="round-card-tools">
          <button type="button" className="round-tool-link" onClick={onToggle}>
            {open ? "收起" : "展开"}
            <Icon name="chevron" size={14} />
          </button>
        </span>
      </div>
      {open && (
        <div className="round-card-body">
          <div className="editor-grid round-card-basics">
            <label className="editor-field">
              <span>轮次</span>
              <Select
                value={
                  value.roundType === "TECHNICAL"
                    ? `TECHNICAL:${value.roundNo ?? 1}`
                    : value.roundType
                }
                onValueChange={(next) => {
                  onChange({
                    ...value,
                    roundType: next.startsWith("TECHNICAL")
                      ? "TECHNICAL"
                      : next === "HR"
                        ? "HR"
                        : "UNKNOWN",
                    roundNo: next.startsWith("TECHNICAL")
                      ? Number(next.split(":")[1])
                      : null,
                  });
                }}
              >
                <SelectTrigger className="editor-select-trigger w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="editor-select-content">
                  {[1, 2, 3, 4, 5].map((number) => (
                    <SelectItem key={number} value={`TECHNICAL:${number}`}>
                      {["一面", "二面", "三面", "四面", "五面"][number - 1]}
                    </SelectItem>
                  ))}
                  <SelectItem value="HR">HR 面</SelectItem>
                  {value.roundType === "UNKNOWN" && (
                    <SelectItem value="UNKNOWN">未明确轮次（保留原记录）</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </label>
            <div className="editor-field">
              <span className="editor-label">
                面试日期 <small>可选</small>
              </span>
              <RoundDatePicker
                value={value.interviewDate}
                onChange={(date) => onChange({ ...value, interviewDate: date })}
              />
            </div>
          </div>
          {value.questions.length === 0 && (
            <p className="editor-help">还没有问题，可以先记录记得最清楚的一道。</p>
          )}
          <div className="question-list">
            {value.questions.map((question, questionIndex) => (
              <QuestionEditor
                key={question.clientKey}
                value={question}
                index={questionIndex}
                total={value.questions.length}
                onChange={(next) =>
                  onChange({
                    ...value,
                    questions: value.questions.map((item, itemIndex) =>
                      itemIndex === questionIndex ? next : item,
                    ),
                  })
                }
                onMove={(direction) =>
                  onChange({
                    ...value,
                    questions: moveItem(
                      value.questions,
                      questionIndex,
                      questionIndex + direction,
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    ...value,
                    questions: value.questions.filter(
                      (_, itemIndex) => itemIndex !== questionIndex,
                    ),
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            className="editor-add-row"
            onClick={() =>
              onChange({
                ...value,
                questions: [...value.questions, newQuestion()],
              })
            }
          >
            ＋ 记一道问题
          </button>
          {total > 1 && (
            <div className="round-card-move">
              <ReorderActions
                label={`轮次 ${index + 1}`}
                index={index}
                total={total}
                onMove={onMove}
                onRemove={onRemove}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

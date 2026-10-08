"use client";
import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CompanySelector,
  PositionSelector,
  TagSelector,
} from "./catalog-selector";
import { InterviewRoundEditor } from "./interview-round-editor";
import {
  moveItem,
  newRound,
  type FormIssue,
  type InterviewEditorValue,
} from "./form-model";

export function DepartmentInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="editor-field" data-field="department">
      <span>
        部门 <small>可选</small>
      </span>
      <input
        className="editor-input"
        value={value ?? ""}
        placeholder="能确认时填写，如抖音电商"
        onChange={(event) => onChange(event.target.value || null)}
      />
    </label>
  );
}
export function InterviewForm({
  value,
  onChange,
  disabled = false,
  errors = [],
  allowProposed = true,
  showSource = true,
}: {
  value: InterviewEditorValue;
  onChange: (value: InterviewEditorValue) => void;
  disabled?: boolean;
  errors?: FormIssue[];
  allowProposed?: boolean;
  showSource?: boolean;
}) {
  const summary = useRef<HTMLDivElement>(null);
  // 展开状态集中在表单层：默认展开第一个轮次，其余轮次可任意同时展开（非手风琴）
  const [openRoundKeys, setOpenRoundKeys] = useState<Set<string> | null>(null);
  const effectiveOpenKeys =
    openRoundKeys ??
    new Set(value.rounds.slice(0, 1).map((round) => round.clientKey));
  const availableRoundNo = [1, 2, 3, 4, 5].find(
    (number) =>
      !value.rounds.some(
        (round) => round.roundType === "TECHNICAL" && round.roundNo === number,
      ),
  );
  const canAddRound =
    availableRoundNo != null ||
    !value.rounds.some((round) => round.roundType === "HR");
  useEffect(() => {
    if (errors.length > 0) summary.current?.focus();
  }, [errors]);
  function focusField(field: string) {
    const segments = field.split(".");
    while (segments.length > 0) {
      const element = document.querySelector<HTMLElement>(
        `[data-field="${segments.join(".")}"]`,
      );
      if (element) {
        element.scrollIntoView({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
        element
          .querySelector<HTMLElement>("input,textarea,select,button")
          ?.focus();
        return;
      }
      segments.pop();
    }
  }
  return (
    <div className="interview-editor">
      {errors.length > 0 && (
        <div
          ref={summary}
          className="editor-error-summary"
          tabIndex={-1}
          role="alert"
        >
          <h3>再补充一下就能继续</h3>
          <ul>
            {errors.map((issue, index) => (
              <li key={`${issue.field}:${index}`}>
                <button type="button" onClick={() => focusField(issue.field)}>
                  {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={disabled} className="editor-fieldset">
        <section className="editor-section form-step">
          <div className="form-step-header">
            <span className="form-step-num" aria-hidden="true">1</span>
            <div>
              <h2>基本信息</h2>
              <p>简单填写一些基本信息，便于其他同学找到这篇面经。</p>
            </div>
          </div>
          <div className="editor-grid">
            <CompanySelector
              value={value.company}
              allowProposed={allowProposed}
              onChange={(company) => onChange({ ...value, company })}
            />
            <PositionSelector
              value={value.position}
              allowProposed={allowProposed}
              onChange={(position) => onChange({ ...value, position })}
            />
          </div>
          <div className="editor-grid">
            <DepartmentInput
              value={value.department}
              onChange={(department) => onChange({ ...value, department })}
            />
            <label className="editor-field" data-field="recruitType">
              <span>招聘类型 *</span>
              <Select
                value={value.recruitType ?? undefined}
                onValueChange={(next) =>
                  onChange({
                    ...value,
                    recruitType: next === "INTERN" || next === "CAMPUS" ? next : null,
                  })
                }
              >
                <SelectTrigger className="editor-select-trigger w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent position="popper" className="editor-select-content">
                  <SelectItem value="INTERN">实习</SelectItem>
                  <SelectItem value="CAMPUS">校招</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <TagSelector
            tagIds={value.tagIds}
            proposedTags={value.proposedTags}
            allowProposed={allowProposed}
            onChange={(tagIds, proposedTags) =>
              onChange({ ...value, tagIds, proposedTags })
            }
          />
        </section>
        <section className="editor-section form-step">
          <div className="form-step-header">
            <span className="form-step-num" aria-hidden="true">2</span>
            <div>
              <h2>面试过程</h2>
              <p>按面试轮次记录遇到的问题。你可以只记记得清楚的部分，不需要一次性写完。</p>
            </div>
          </div>
          {value.rounds.map((round, roundIndex) => (
            <InterviewRoundEditor
              key={round.clientKey}
              value={round}
              index={roundIndex}
              total={value.rounds.length}
              open={effectiveOpenKeys.has(round.clientKey)}
              onToggle={() =>
                setOpenRoundKeys(() => {
                  const next = new Set(effectiveOpenKeys);
                  if (next.has(round.clientKey)) next.delete(round.clientKey);
                  else next.add(round.clientKey);
                  return next;
                })
              }
              onChange={(next) =>
                onChange({
                  ...value,
                  rounds: value.rounds.map((item, itemIndex) =>
                    itemIndex === roundIndex ? next : item,
                  ),
                })
              }
              onMove={(direction) =>
                onChange({
                  ...value,
                  rounds: moveItem(
                    value.rounds,
                    roundIndex,
                    roundIndex + direction,
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...value,
                  rounds: value.rounds.filter(
                    (_, itemIndex) => itemIndex !== roundIndex,
                  ),
                })
              }
            />
          ))}
          <button
            type="button"
            className="editor-add-row section-editor-add"
            disabled={!canAddRound}
            onClick={() => {
              const round = newRound(availableRoundNo ?? 1);
              if (availableRoundNo == null) {
                round.roundType = "HR";
                round.roundNo = null;
              }
              setOpenRoundKeys(
                () => new Set(effectiveOpenKeys).add(round.clientKey),
              );
              onChange({ ...value, rounds: [...value.rounds, round] });
            }}
          >
            ＋ 添加下一轮面试
          </button>
        </section>
        {showSource && (
          <section className="editor-section form-step">
            <div className="form-step-header">
              <span className="form-step-num" aria-hidden="true">3</span>
              <div>
                <h2>来源（可选）</h2>
                <p>如果这篇面经来源于其他平台，可以填入链接，方便注明出处。</p>
              </div>
            </div>
            <label className="editor-field" data-field="sourceUrl">
              <span>原帖链接</span>
              <input
                className="editor-input"
                type="url"
                value={value.sourceUrl ?? ""}
                placeholder="https://..."
                onChange={(event) =>
                  onChange({ ...value, sourceUrl: event.target.value || null })
                }
              />
            </label>
          </section>
        )}
      </fieldset>
    </div>
  );
}

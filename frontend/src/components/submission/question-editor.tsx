import { useState } from "react";
import { FollowUpEditor } from "./follow-up-editor";
import type { EditorQuestion } from "./form-model";
import { ReorderActions } from "./reorder-actions";

/**
 * 问题（V1 简化冻结）：一道题 = 正文 + 可选追问 + 可选题目链接。
 * 「Q1 + 面试官问了什么？」直接开写；追问 ↳ 缩进；链接是一行可选输入，
 * 不出现类型 / 分组 / 上下文 / 算法结构化字段。排序删除收进 hover 出现的 ··· 菜单。
 */
export function QuestionEditor({
  value,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  value: EditorQuestion;
  index: number;
  total: number;
  onChange: (value: EditorQuestion) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLink, setShowLink] = useState(Boolean(value.referenceUrl));
  const link = value.referenceUrl?.trim() || "";

  return (
    <article className="question-note" data-field="question-row">
      <div className="question-note-row">
        <span className="question-note-num" aria-hidden="true">
          Q{index + 1}
        </span>
        <div className="question-note-main">
          <label className="editor-field">
            <span className="sr-only">问题 {index + 1}</span>
            <textarea
              className="editor-textarea question-note-input"
              rows={2}
              maxLength={500}
              value={value.content}
              placeholder="面试官问了什么？"
              onChange={(event) =>
                onChange({ ...value, content: event.target.value })
              }
            />
          </label>
          <span className="question-note-count" aria-hidden="true">
            {value.content.length} / 500
          </span>
        </div>
        <span className="question-note-tools">
          <span className="question-menu-wrap">
            <button
              type="button"
              className="question-menu-trigger"
              aria-label={`问题 ${index + 1} 的更多操作`}
              onClick={() => setMenuOpen((current) => !current)}
            >
              ···
            </button>
            {menuOpen && (
              <span className="question-menu">
                <ReorderActions
                  label={`问题 ${index + 1}`}
                  index={index}
                  total={total}
                  onMove={onMove}
                  onRemove={onRemove}
                />
              </span>
            )}
          </span>
        </span>
      </div>

          {value.followUps.length > 0 && (
        <div className="follow-up-thread">
          {value.followUps.map((followUp, followIndex) => (
            <FollowUpEditor
              key={followUp.clientKey}
              value={followUp}
              index={followIndex}
              onChange={(next) =>
                onChange({
                  ...value,
                  followUps: value.followUps.map((item, itemIndex) =>
                    itemIndex === followIndex ? next : item,
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...value,
                  followUps: value.followUps.filter(
                    (_, itemIndex) => itemIndex !== followIndex,
                  ),
                })
              }
            />
          ))}
        </div>
      )}
      <button
        type="button"
        className="question-add-follow"
        onClick={() =>
          onChange({
            ...value,
            followUps: [
              ...value.followUps,
              { id: null, clientKey: crypto.randomUUID(), content: "" },
            ],
          })
        }
      >
        ↳ 添加追问
      </button>

      {showLink || link ? (
        <label className="question-link-field">
          <span>
            相关题目链接 <small>算法 / 编码题可选</small>
          </span>
          <input
            className="editor-input question-link-input"
            type="url"
            maxLength={500}
            value={link}
            placeholder="例如 LeetCode / 牛客 / Codeforces 题目链接"
            onChange={(event) =>
              onChange({ ...value, referenceUrl: event.target.value || null })
            }
          />
        </label>
      ) : (
        <button
          type="button"
          className="link-quiet question-link-toggle"
          onClick={() => setShowLink(true)}
        >
          ＋ 相关题目链接
        </button>
      )}
    </article>
  );
}

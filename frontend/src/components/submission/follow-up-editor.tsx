import type { EditorFollowUp } from "./form-model";

/** 追问：缩进 + 淡竖线串在主问题下方；删除按钮 hover 才出现。 */
export function FollowUpEditor({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: EditorFollowUp;
  index: number;
  onChange: (value: EditorFollowUp) => void;
  onRemove: () => void;
}) {
  return (
    <div className="follow-up-item">
      <span className="follow-up-line" aria-hidden="true" />
      <div className="follow-up-main">
        <span className="follow-up-arrow" aria-hidden="true">↳</span>
        <label className="editor-field follow-up-field">
          <input
            className="editor-input follow-up-input"
            maxLength={500}
            value={value.content}
            placeholder="面试官接着问了什么？"
            onChange={(event) =>
              onChange({ ...value, content: event.target.value })
            }
          />
        </label>
        <div className="follow-up-tools">
          <button
            type="button"
            className="follow-up-remove"
            aria-label={`删除追问 ${index + 1}`}
            onClick={onRemove}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

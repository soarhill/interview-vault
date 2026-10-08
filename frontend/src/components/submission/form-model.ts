import type {
  InterviewChangePayload,
  Question,
  QuestionInput,
  RoundInput,
} from "@/lib/api/types";

export interface EditorFollowUp {
  id?: number | null;
  content: string;
  clientKey: string;
}
export interface EditorQuestion extends Omit<QuestionInput, "followUps"> {
  clientKey: string;
  followUps: EditorFollowUp[];
}
export interface EditorRound extends Omit<RoundInput, "questions"> {
  clientKey: string;
  questions: EditorQuestion[];
}
export interface InterviewEditorValue extends Omit<
  InterviewChangePayload,
  "rounds"
> {
  rounds: EditorRound[];
}
export interface FormIssue {
  field: string;
  message: string;
}

function localKey() {
  return globalThis.crypto.randomUUID();
}
export function newQuestion(): EditorQuestion {
  return {
    clientKey: localKey(),
    id: null,
    content: "",
    referenceUrl: null,
    followUps: [],
  };
}
export function newRound(roundNo = 1): EditorRound {
  return {
    clientKey: localKey(),
    id: null,
    roundType: "TECHNICAL",
    roundNo,
    interviewDate: null,
    questions: [newQuestion()],
  };
}
export function emptyInterviewPayload(): InterviewChangePayload {
  return {
    company: { existingId: null, proposedName: null },
    position: { existingId: null, proposedName: null },
    department: null,
    recruitType: null,
    tagIds: [],
    proposedTags: [],
    rounds: [newRound()],
    sourceUrl: null,
  };
}
function reconcileEditorIdentity<
  T extends { id?: number | null; clientKey: string },
>(
  id: number | null | undefined,
  previous: T[] | undefined,
  index: number,
  usedKeys: Set<string>,
) {
  const existing =
    id == null
      ? undefined
      : previous?.find(
          (item) => item.id === id && !usedKeys.has(item.clientKey),
        );
  const positional = previous?.[index];
  // Positional matching only bridges newly created local entities to their canonical database IDs.
  const matched =
    existing ??
    (positional?.id == null && positional && !usedKeys.has(positional.clientKey)
      ? positional
      : undefined);
  const clientKey = matched?.clientKey ?? localKey();
  usedKeys.add(clientKey);
  return { matched, clientKey };
}
export function editorValueFromPayload(
  payload: InterviewChangePayload,
  previous?: InterviewEditorValue,
): InterviewEditorValue {
  const usedRoundKeys = new Set<string>();
  return {
    ...payload,
    company: { ...payload.company },
    position: { ...payload.position },
    tagIds: [...payload.tagIds],
    proposedTags: [...payload.proposedTags],
    rounds: payload.rounds.map((round, index) => {
      const roundIdentity = reconcileEditorIdentity(
        round.id,
        previous?.rounds,
        index,
        usedRoundKeys,
      );
      const usedQuestionKeys = new Set<string>();
      return {
        ...round,
        clientKey: roundIdentity.clientKey,
        questions: round.questions.map((question, questionIndex) => {
          const questionIdentity = reconcileEditorIdentity(
            question.id,
            roundIdentity.matched?.questions,
            questionIndex,
            usedQuestionKeys,
          );
          const usedFollowUpKeys = new Set<string>();
          return {
            ...question,
            clientKey: questionIdentity.clientKey,
            referenceUrl: question.referenceUrl ?? null,
            followUps: question.followUps.map((followUp, followIndex) => ({
              ...followUp,
              clientKey: reconcileEditorIdentity(
                followUp.id,
                questionIdentity.matched?.followUps,
                followIndex,
                usedFollowUpKeys,
              ).clientKey,
            })),
          };
        }),
      };
    }),
  };
}
export function editorPayload(
  value: InterviewEditorValue,
): InterviewChangePayload {
  return {
    ...value,
    rounds: value.rounds.map(({ clientKey: roundKey, ...round }) => {
      void roundKey;
      return {
        ...round,
        questions: round.questions.map(
          ({ clientKey: questionKey, ...question }) => {
            void questionKey;
            return {
              ...question,
              referenceUrl: question.referenceUrl?.trim() || null,
              followUps: question.followUps.map(
                ({ clientKey: followKey, ...followUp }) => {
                  void followKey;
                  return followUp;
                },
              ),
            };
          },
        ),
      };
    }),
  };
}
interface EditableInterview {
  company: {
    id: number | null;
    name: string;
    source?: "OFFICIAL" | "PROPOSED";
  } | null;
  position: {
    id: number | null;
    name: string;
    source?: "OFFICIAL" | "PROPOSED";
  } | null;
  department: string | null;
  recruitType: InterviewChangePayload["recruitType"];
  tags: { id: number | null; name: string; source?: "OFFICIAL" | "PROPOSED" }[];
  /** 读侧 InterviewRound：remark / 精度等历史字段不进写入合同，由后端保留。 */
  rounds: (Omit<RoundInput, "questions"> & {
    remark?: string | null;
    interviewDatePrecision?: string | null;
    questions?: Question[];
  })[];
  sourceUrl?: string | null;
}
export function payloadFromInterview(
  interview: EditableInterview,
): InterviewChangePayload {
  const selection = (item: EditableInterview["company"]) => ({
    existingId: item?.id ?? null,
    proposedName: item && item.id == null ? item.name : null,
  });
  return {
    company: selection(interview.company),
    position: selection(interview.position),
    department: interview.department,
    recruitType: interview.recruitType,
    tagIds: interview.tags.flatMap((tag) => (tag.id == null ? [] : [tag.id])),
    proposedTags: interview.tags
      .filter((tag) => tag.id == null)
      .map((tag) => tag.name),
    rounds: interview.rounds.map((round) => ({
      id: round.id,
      roundType: round.roundType,
      roundNo: round.roundNo,
      interviewDate: round.interviewDate,
      questions: (round.questions ?? []).map((question) => ({
        id: question.id,
        content: question.content,
        referenceUrl: question.referenceUrl ?? null,
        followUps: question.followUps.map((followUp) => ({
          id: followUp.id,
          content: followUp.content,
        })),
      })),
    })),
    sourceUrl: interview.sourceUrl ?? null,
  };
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function validateInterview(
  payload: InterviewChangePayload,
  mode: "draft" | "submit" | "published",
): FormIssue[] {
  const issues: FormIssue[] = [];
  const requireCompleteContent = mode !== "draft";
  for (const [field, label] of [
    ["company", "公司"],
    ["position", "岗位"],
  ] as const) {
    const value = payload[field];
    if (value.existingId != null && value.proposedName != null)
      issues.push({
        field,
        message: `${label}请选择正式项或新增候选中的一项。`,
      });
    if (value.proposedName != null && !value.proposedName.trim())
      issues.push({
        field,
        message: `${label}名称不能只包含空格。`,
      });
    if (
      requireCompleteContent &&
      !value.existingId &&
      !value.proposedName?.trim()
    )
      issues.push({ field, message: `请填写${label}名称。` });
  }
  if (payload.sourceUrl && !isHttpUrl(payload.sourceUrl))
    issues.push({
      field: "sourceUrl",
      message: "来源链接需要以 http:// 或 https:// 开头。",
    });
  if (payload.department != null && !payload.department.trim())
    issues.push({
      field: "department",
      message: "部门不能只包含空格；无法确认时可留空。",
    });
  const proposedTags = payload.proposedTags.map((tag) =>
    tag.trim().toLowerCase(),
  );
  if (
    proposedTags.some((tag) => !tag) ||
    new Set(proposedTags).size !== proposedTags.length
  )
    issues.push({ field: "tags", message: "新增标签不能留空或重复。" });
  if (requireCompleteContent && !payload.recruitType)
    issues.push({ field: "recruitType", message: "请选择招聘类型。" });
  if (requireCompleteContent && payload.rounds.length === 0)
    issues.push({ field: "rounds", message: "请添加至少一个真实面试轮次。" });
  if (
    mode === "published" &&
    payload.rounds.length > 0 &&
    !payload.rounds.some((round) => round.questions.length > 0)
  )
    issues.push({
      field: "rounds",
      message: "整份面经需要保留至少一个真实问题。",
    });
  const technicalNumbers = new Set<number>();
  payload.rounds.forEach((round, index) => {
    const field = `rounds.${index}`;
    if (round.roundType === "TECHNICAL") {
      if (round.roundNo == null || round.roundNo < 1 || round.roundNo > 5)
        issues.push({
          field,
          message: `第 ${index + 1} 个技术轮次请选择一面至五面。`,
        });
      else if (technicalNumbers.has(round.roundNo))
        issues.push({
          field,
          message: `第 ${index + 1} 个轮次与其他技术轮次重复。`,
        });
      else technicalNumbers.add(round.roundNo);
    }
    if (round.interviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(round.interviewDate))
      issues.push({ field, message: `第 ${index + 1} 个轮次请填写有效日期。` });
    const existingPublishedRound = mode === "published" && round.id != null;
    if (
      requireCompleteContent &&
      round.questions.length === 0 &&
      !existingPublishedRound
    )
      issues.push({ field, message: `第 ${index + 1} 个轮次请添加问题。` });
    round.questions.forEach((question, questionIndex) => {
      const questionField = `${field}.questions.${questionIndex}`;
      if (requireCompleteContent && !question.content.trim())
        issues.push({
          field: questionField,
          message: `第 ${index + 1} 个轮次的问题 ${questionIndex + 1} 尚未填写。`,
        });
      if (question.referenceUrl && !isHttpUrl(question.referenceUrl))
        issues.push({
          field: questionField,
          message: "题目链接需要以 http:// 或 https:// 开头。",
        });
      if (requireCompleteContent)
        question.followUps.forEach((followUp, followIndex) => {
          if (!followUp.content.trim())
            issues.push({
              field: `${questionField}.followUps.${followIndex}`,
              message: `问题 ${questionIndex + 1} 的追问 ${followIndex + 1} 尚未填写，可删除空追问。`,
            });
        });
    });
  });
  return issues;
}

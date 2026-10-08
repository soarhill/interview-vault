import type {
  Company,
  InterviewChangePayload,
  Position,
  RoundInput,
  SelectionInput,
  Tag,
} from "@/lib/api/types";

export interface ComparisonCatalog {
  companies: Company[];
  positions: Position[];
  tags: Tag[];
}

export interface ContentChange {
  label: string;
  before: string;
  after: string;
  originalPath?: string;
  currentPath?: string;
}

export function catalogName(
  selection: SelectionInput,
  items: { id: number; name: string }[],
) {
  if (selection.proposedName) return `${selection.proposedName}（新增项）`;
  if (selection.existingId != null)
    return (
      items.find((item) => item.id === selection.existingId)?.name ??
      `目录项 #${selection.existingId}`
    );
  return "未填写";
}

export function tagNames(
  payload: InterviewChangePayload,
  catalog: ComparisonCatalog,
) {
  return [
    ...payload.tagIds.map(
      (id) => catalog.tags.find((tag) => tag.id === id)?.name ?? `标签 #${id}`,
    ),
    ...payload.proposedTags.map((tag) => `${tag}（新增项）`),
  ];
}

export function roundLabel(round: RoundInput) {
  return round.roundType === "HR"
    ? "HR 面"
    : round.roundType === "TECHNICAL"
      ? `技术第 ${round.roundNo ?? "未确认"} 面`
      : "其他轮次";
}

// 已有内容按稳定 ID 对齐；只有两侧都没有 ID 的新内容才按位置对齐。
function alignItems<T extends { id?: number | null }>(before: T[], after: T[]) {
  const used = new Set<number>();
  const pairs = before.map((item, index) => {
    const nextIndex =
      item.id != null
        ? after.findIndex((next) => next.id === item.id)
        : after[index]?.id == null && after[index]
          ? index
          : -1;
    if (nextIndex >= 0) used.add(nextIndex);
    return {
      before: item as T | undefined,
      after: nextIndex >= 0 ? after[nextIndex] : undefined,
      beforeIndex: index,
      afterIndex: nextIndex,
    };
  });
  after.forEach((item, index) => {
    if (!used.has(index))
      pairs.push({
        before: undefined,
        after: item,
        beforeIndex: -1,
        afterIndex: index,
      });
  });
  return pairs;
}

export function changeRequestDiff(
  original: InterviewChangePayload,
  current: InterviewChangePayload,
  catalog: ComparisonCatalog,
  originalSources?: string[],
): ContentChange[] {
  const changes: ContentChange[] = [];
  const add = (
    label: string,
    before: unknown,
    after: unknown,
    originalPath: string,
    currentPath = originalPath,
    displayBefore = String(before ?? "未填写"),
    displayAfter = String(after ?? "未填写"),
  ) => {
    if (JSON.stringify(before) !== JSON.stringify(after))
      changes.push({
        label,
        before: displayBefore,
        after: displayAfter,
        originalPath,
        currentPath,
      });
  };
  const selectionKey = (value: SelectionInput) => [
    value.existingId ?? null,
    value.proposedName || null,
  ];
  add(
    "公司",
    selectionKey(original.company),
    selectionKey(current.company),
    "company",
    "company",
    catalogName(original.company, catalog.companies),
    catalogName(current.company, catalog.companies),
  );
  add(
    "岗位",
    selectionKey(original.position),
    selectionKey(current.position),
    "position",
    "position",
    catalogName(original.position, catalog.positions),
    catalogName(current.position, catalog.positions),
  );
  add(
    "部门",
    original.department || null,
    current.department || null,
    "department",
  );
  const recruitment = (value: InterviewChangePayload["recruitType"]) =>
    value === "INTERN" ? "实习" : value === "CAMPUS" ? "校招" : "未填写";
  add(
    "招聘类型",
    original.recruitType,
    current.recruitType,
    "recruitType",
    "recruitType",
    recruitment(original.recruitType),
    recruitment(current.recruitType),
  );
  const tagsKey = (value: InterviewChangePayload) => [
    [...new Set(value.tagIds)].sort((a, b) => a - b),
    [...new Set(value.proposedTags)].sort(),
  ];
  add(
    "标签",
    tagsKey(original),
    tagsKey(current),
    "tags",
    "tags",
    tagNames(original, catalog).join("、") || "无",
    tagNames(current, catalog).join("、") || "无",
  );
  const beforeSources =
    originalSources ?? (original.sourceUrl ? [original.sourceUrl] : []);
  const afterSources = current.sourceUrl ? [current.sourceUrl] : [];
  add(
    "来源",
    beforeSources,
    afterSources,
    "sources",
    "sources",
    beforeSources.join("、") || "未提供",
    afterSources.join("、") || "未提供",
  );

  function orderChange<T extends { id?: number | null }>(
    before: T[],
    after: T[],
    label: string,
    path: string,
    nextPath = path,
  ) {
    const common = before.flatMap((item) =>
      item.id != null && after.some((next) => next.id === item.id)
        ? [item.id]
        : [],
    );
    const next = after.flatMap((item) =>
      item.id != null && common.includes(item.id) ? [item.id] : [],
    );
    add(
      label,
      common,
      next,
      `${path}.order`,
      `${nextPath}.order`,
      "原有顺序",
      "已调整顺序",
    );
  }

  orderChange(original.rounds, current.rounds, "面试轮次顺序", "rounds");
  for (const pair of alignItems(original.rounds, current.rounds)) {
    const before = pair.before;
    const after = pair.after;
    const left = `rounds.${pair.beforeIndex}`;
    const right = `rounds.${pair.afterIndex}`;
    if (!before || !after) {
      changes.push({
        label: roundLabel((before ?? after)!),
        before: before ? `${before.questions.length} 个问题` : "无此轮次",
        after: after ? `${after.questions.length} 个问题` : "已删除该轮次",
        originalPath: before ? left : undefined,
        currentPath: after ? right : undefined,
      });
      continue;
    }
    add(
      `${roundLabel(after)} · 轮次`,
      [before.roundType, before.roundNo],
      [after.roundType, after.roundNo],
      `${left}.title`,
      `${right}.title`,
      roundLabel(before),
      roundLabel(after),
    );
    add(
      `${roundLabel(after)} · 日期`,
      before.interviewDate,
      after.interviewDate,
      `${left}.date`,
      `${right}.date`,
    );
    orderChange(
      before.questions,
      after.questions,
      `${roundLabel(after)} · 问题顺序`,
      `${left}.questions`,
      `${right}.questions`,
    );
    for (const question of alignItems(before.questions, after.questions)) {
      const a = question.before;
      const b = question.after;
      const aPath = `${left}.questions.${question.beforeIndex}`;
      const bPath = `${right}.questions.${question.afterIndex}`;
      const label = `${current.rounds.length > 1 ? `${roundLabel(after)} · ` : ""}Q${(b ? question.afterIndex : question.beforeIndex) + 1}`;
      if (!a || !b) {
        changes.push({
          label,
          before: a?.content ?? "无此问题",
          after: b?.content ?? "已删除该问题",
          originalPath: a ? aPath : undefined,
          currentPath: b ? bPath : undefined,
        });
        continue;
      }
      add(label, a.content, b.content, `${aPath}.content`, `${bPath}.content`);
      add(
        `${label} · 题目链接`,
        a.referenceUrl || null,
        b.referenceUrl || null,
        `${aPath}.link`,
        `${bPath}.link`,
      );
      orderChange(
        a.followUps,
        b.followUps,
        `${label} · 追问顺序`,
        `${aPath}.followUps`,
        `${bPath}.followUps`,
      );
      for (const follow of alignItems(a.followUps, b.followUps)) {
        const from = `${aPath}.followUps.${follow.beforeIndex}`;
        const to = `${bPath}.followUps.${follow.afterIndex}`;
        const followLabel = `${label} · 追问 ${(follow.after ? follow.afterIndex : follow.beforeIndex) + 1}`;
        if (!follow.before || !follow.after) {
          changes.push({
            label: followLabel,
            before: follow.before?.content ?? "无此追问",
            after: follow.after?.content ?? "已删除该追问",
            originalPath: follow.before ? from : undefined,
            currentPath: follow.after ? to : undefined,
          });
        } else {
          add(
            followLabel,
            follow.before.content,
            follow.after.content,
            from,
            to,
          );
        }
      }
    }
  }
  return changes;
}

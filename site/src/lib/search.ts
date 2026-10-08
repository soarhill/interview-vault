import type {
  Interview,
  InterviewFiltersResponse,
  InterviewLibrary,
  InterviewSummary,
  RecruitType,
  SearchMatch,
} from "./types";
import type { UrlState } from "./url-state";

/** 命中片段窗口：与完整版后端 SnippetGenerator 一致（前后各约 30 字符，超长加省略号）。 */
const SNIPPET_RADIUS = 30;

export function snippetWindow(text: string, keyword: string): string {
  if (!text) return "";
  const index = text.toLowerCase().indexOf(keyword);
  if (index < 0) {
    return text.length <= SNIPPET_RADIUS * 2 + 10
      ? text
      : text.slice(0, SNIPPET_RADIUS * 2 + 10) + "…";
  }
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + keyword.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(needle));
}

/** 返回在该文本上命中的关键词（无命中为 null），用于生成对位的命中片段。 */
function firstHit(text: string | null | undefined, terms: string[]): string | null {
  return terms.find((term) => contains(text, term)) ?? null;
}

export function parseTerms(q: string): string[] {
  return [...new Set(q.trim().toLowerCase().split(/\s+/).filter(Boolean))];
}

/** 面试时间排序：首轮已确认日期倒序，无日期置后，id 兜底稳定（与完整版一致）。 */
export function sortInterviews(interviews: Interview[]): Interview[] {
  return [...interviews].sort((a, b) => {
    const dateA = a.firstInterviewDate ?? "";
    const dateB = b.firstInterviewDate ?? "";
    if (dateA && dateB && dateA !== dateB) return dateA < dateB ? 1 : -1;
    if (dateA !== dateB) return dateA ? -1 : 1;
    return a.id - b.id;
  });
}

function questionHits(interview: Interview, terms: string[]): SearchMatch[] {
  const matches: SearchMatch[] = [];
  for (const round of interview.rounds) {
    for (const question of round.questions) {
      const hit =
        firstHit(question.content, terms) ??
        firstHit(question.algorithmTitle, terms) ??
        firstHit(question.algorithmDescription, terms) ??
        firstHit(question.algorithmRequirements, terms) ??
        firstHit(question.sectionLabel, terms);
      if (hit) {
        matches.push({
          kind: "QUESTION",
          questionId: question.id,
          followUpId: null,
          roundName: round.displayName,
          snippet: snippetWindow(question.content, hit),
        });
        continue;
      }
      for (const followUp of question.followUps) {
        const followHit = firstHit(followUp.content, terms);
        if (followHit) {
          matches.push({
            kind: "FOLLOW_UP",
            questionId: question.id,
            followUpId: followUp.id,
            roundName: round.displayName,
            snippet: snippetWindow(followUp.content, followHit),
          });
          break;
        }
      }
    }
  }
  return matches;
}

function metaHits(interview: Interview, terms: string[]): SearchMatch | null {
  const hit = terms.find(
    (term) =>
      contains(interview.company.name, term) ||
      contains(interview.position?.name, term) ||
      contains(interview.position?.category, term) ||
      interview.tags.some((tag) => contains(tag, term)),
  );
  if (!hit) return null;
  const text =
    [interview.position?.name, ...interview.tags].find((field) =>
      contains(field, hit),
    ) ?? interview.company.name;
  return {
    kind: "META",
    questionId: null,
    followUpId: null,
    roundName: null,
    snippet: snippetWindow(text, hit),
  };
}

function toSummary(interview: Interview, terms: string[]): InterviewSummary {
  const matches = terms.length
    ? [...questionHits(interview, terms), metaHits(interview, terms)].filter(
        (match): match is SearchMatch => match !== null,
      )
    : [];
  return {
    id: interview.id,
    company: interview.company,
    department: interview.department,
    position: interview.position,
    recruitType: interview.recruitType,
    firstInterviewDate: interview.firstInterviewDate,
    firstInterviewDatePrecision: interview.firstInterviewDatePrecision,
    rounds: interview.rounds.map((round) => round.displayName),
    tags: interview.tags,
    ...(matches.length ? { matches } : {}),
  };
}

/** 关键词是否命中（问题/算法字段/追问/公司/岗位/分类/标签，与完整版搜索维度一致）。 */
export function keywordMatch(interview: Interview, terms: string[]): boolean {
  if (!terms.length) return true;
  const lowered = terms.map((term) => term.toLowerCase());
  return lowered.every(
    (term) =>
      contains(interview.company.name, term) ||
      contains(interview.position?.name, term) ||
      contains(interview.position?.category, term) ||
      interview.tags.some((tag) => contains(tag, term)) ||
      interview.rounds.some((round) =>
        round.questions.some(
          (question) =>
            contains(question.content, term) ||
            contains(question.algorithmTitle, term) ||
            contains(question.algorithmDescription, term) ||
            contains(question.algorithmRequirements, term) ||
            contains(question.sectionLabel, term) ||
            question.followUps.some((item) => contains(item.content, term)),
        ),
      ),
  );
}

export interface Criteria {
  companyId: string;
  positionCategory: string;
  recruitType: string;
  terms: string[];
}

function matchesCriteria(interview: Interview, criteria: Criteria): boolean {
  if (
    criteria.companyId &&
    String(interview.company.id) !== criteria.companyId
  )
    return false;
  if (
    criteria.positionCategory &&
    interview.position?.category !== criteria.positionCategory
  )
    return false;
  if (
    criteria.recruitType &&
    interview.recruitType !== (criteria.recruitType as RecruitType)
  )
    return false;
  return keywordMatch(interview, criteria.terms);
}

function criteriaOf(state: UrlState, skip?: keyof UrlState): Criteria {
  return {
    companyId: skip === "companyId" ? "" : state.companyId,
    positionCategory: skip === "positionCategory" ? "" : state.positionCategory,
    recruitType: skip === "recruitType" ? "" : state.recruitType,
    terms: parseTerms(state.q),
  };
}

/** 列表查询：内存中完成筛选 + 搜索 + 排序，页大小与完整版一致（24）。 */
export function selectSummaries(
  library: InterviewLibrary,
  state: UrlState,
): InterviewSummary[] {
  const criteria = criteriaOf(state);
  return sortInterviews(library.interviews)
    .filter((interview) => matchesCriteria(interview, criteria))
    .map((interview) => toSummary(interview, criteria.terms));
}

/**
 * 联动筛选计数：每个维度在「忽略该维度、保留其余条件」的结果上统计（与完整版语义一致）。
 * 公司维度值用公司 id，岗位维度值用分类名（快照内稳定且可直接读）。
 */
export function selectFilters(
  library: InterviewLibrary,
  state: UrlState,
): InterviewFiltersResponse {
  const sorted = sortInterviews(library.interviews);
  const base = (skip: keyof UrlState) =>
    sorted.filter((interview) =>
      matchesCriteria(interview, criteriaOf(state, skip)),
    );
  const all = sorted.filter((interview) =>
    matchesCriteria(interview, criteriaOf(state)),
  );
  const companyBase = base("companyId");
  const categoryBase = base("positionCategory");
  const recruitBase = base("recruitType");

  const companies = [...companyBase].reduce<
    Map<number, { name: string; count: number }>
  >((map, interview) => {
    const { id, name } = interview.company;
    const entry = map.get(id) ?? { name, count: 0 };
    entry.count += 1;
    map.set(id, entry);
    return map;
  }, new Map());

  const categories = [...categoryBase].reduce<Map<string, number>>(
    (map, interview) => {
      const category = interview.position?.category;
      if (category) map.set(category, (map.get(category) ?? 0) + 1);
      return map;
    },
    new Map(),
  );

  const recruitTypes = [...recruitBase].reduce<Map<RecruitType, number>>(
    (map, interview) => {
      map.set(interview.recruitType, (map.get(interview.recruitType) ?? 0) + 1);
      return map;
    },
    new Map(),
  );

  // 分类展示顺序继承完整版目录（快照内按既有顺序即目录序），未知分类按首次出现兜底。
  const seen = new Set<string>();
  const categoryOrder: string[] = [];
  for (const interview of sorted) {
    const category = interview.position?.category;
    if (category && !seen.has(category)) {
      seen.add(category);
      categoryOrder.push(category);
    }
  }

  return {
    total: all.length,
    companyTotal: companyBase.length,
    positionCategoryTotal: categoryBase.length,
    recruitTypeTotal: recruitBase.length,
    companies: [...companies.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count || a.id - b.id),
    positionCategories: categoryOrder
      .filter((label) => categories.has(label))
      .map((label) => ({
        value: label,
        label,
        count: categories.get(label) ?? 0,
      })),
    recruitTypes: (["INTERN", "CAMPUS"] as const)
      .filter((value) => recruitTypes.has(value))
      .map((value) => ({
        value,
        label: value === "INTERN" ? "实习" : "校招",
        count: recruitTypes.get(value) ?? 0,
      })),
  };
}

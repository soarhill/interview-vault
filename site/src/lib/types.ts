/** 静态快照数据模型：与完整版公开 API 的展示字段对齐（不含任何用户 / 审核字段）。 */

export type RecruitType = "INTERN" | "CAMPUS";
export type DatePrecision = "DAY" | "MONTH" | "YEAR";
export type RoundType = "TECHNICAL" | "HR" | "UNKNOWN";

export interface Company {
  id: number;
  name: string;
}

export interface Position {
  id: number;
  name: string;
  category: string | null;
}

export interface FollowUp {
  id: number;
  content: string;
}

export interface Question {
  id: number;
  content: string;
  /** 用户可见的唯一题目链接（快照生成时已合并 reference_url ?? leetcode_url）。 */
  referenceUrl: string | null;
  questionType: "NORMAL" | "ALGORITHM";
  algorithmTitle?: string | null;
  algorithmDescription?: string | null;
  algorithmRequirements?: string | null;
  sectionLabel?: string | null;
  /** 快照不单独携带（已并入 referenceUrl）；保留为可选以复用完整版组件逻辑。 */
  leetcodeNumber?: number | null;
  leetcodeUrl?: string | null;
  followUps: FollowUp[];
}

export interface InterviewRound {
  id: number;
  roundType: RoundType;
  roundNo: number | null;
  displayName: string;
  remark: string | null;
  interviewDate: string | null;
  interviewDatePrecision: DatePrecision | null;
  questions: Question[];
}

export interface Source {
  id: number;
  url: string;
}

/** 快照内的一条完整面经：列表与详情共用同一份数据。 */
export interface Interview {
  id: number;
  company: Company;
  department: string | null;
  position: Position | null;
  recruitType: RecruitType;
  firstInterviewDate: string | null;
  firstInterviewDatePrecision: DatePrecision | null;
  originalPositionName: string | null;
  inferredPositionName: string | null;
  note: string | null;
  tags: string[];
  sources: Source[];
  rounds: InterviewRound[];
}

export interface InterviewLibrary {
  schema: number;
  generatedAt: string;
  /** 数据整理自公开渠道的说明，展示在关于页。 */
  provenance: string;
  total: number;
  interviews: Interview[];
}

/* ---------- 列表展示形态（与完整版 InterviewSummary 对齐） ---------- */

export interface MatchBase {
  roundName: string | null;
  snippet: string;
}
export interface ProblemMatch extends MatchBase {
  kind: "QUESTION" | "FOLLOW_UP";
  questionId: number;
  followUpId: number | null;
}
export interface MetaMatch extends MatchBase {
  kind: "META";
  questionId: null;
  followUpId: null;
}
export type SearchMatch = ProblemMatch | MetaMatch;

export interface InterviewSummary {
  id: number;
  company: Company;
  department: string | null;
  position: Position | null;
  recruitType: RecruitType;
  firstInterviewDate: string | null;
  firstInterviewDatePrecision: DatePrecision | null;
  rounds: string[];
  tags: string[];
  matches?: SearchMatch[];
}

export interface InterviewFiltersResponse {
  total: number;
  /** 「全部」= 忽略该维度、保留其余条件后的结果数（岗位维度的未分类记录计入 positionCategoryTotal）。 */
  companyTotal: number;
  positionCategoryTotal: number;
  recruitTypeTotal: number;
  companies: (Company & { count: number })[];
  positionCategories: { value: string; label: string; count: number }[];
  recruitTypes: { value: RecruitType; label: string; count: number }[];
}

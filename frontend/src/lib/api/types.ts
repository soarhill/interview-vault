export type RecruitType = "INTERN" | "CAMPUS";
/** 岗位方向：目录化后由 /position-categories 动态下发（value=id 字符串），不再枚举冻结。 */
export type PositionCategory = string;
export type DatePrecision = "DAY" | "MONTH" | "YEAR";
export type InterviewStatus =
  "DRAFT" | "PENDING_REVIEW" | "REJECTED" | "PUBLISHED" | "REMOVED";
export type RoundType = "TECHNICAL" | "HR" | "UNKNOWN";
export type UserRole = "USER" | "ADMIN";
export interface Result<T> {
  code: string;
  message: string;
  data: T;
}
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export interface ItemsResponse<T> {
  items: T[];
}
export interface Company {
  id: number;
  name: string;
}
export interface Position {
  id: number;
  name: string;
  category: PositionCategory;
}
export interface Tag {
  id: number;
  name: string;
}
export interface CatalogSelectionView {
  id: number | null;
  name: string;
  source: "OFFICIAL" | "PROPOSED";
  category?: PositionCategory | null;
}
export interface SelectionInput {
  existingId?: number | null;
  proposedName?: string | null;
}
export interface Warning {
  code: string;
  message: string;
}
export interface Author {
  id: number;
  githubLogin: string;
  avatarUrl: string | null;
}
export interface CurrentUserResponse extends Author {
  role: UserRole;
}
export interface ListQuery {
  companyId?: number | string;
  positionCategory?: string;
  recruitType?: string;
  q?: string;
  page?: number;
  size?: number;
}
export interface PageQuery {
  page?: number;
  size?: number;
}
export interface MyInterviewsQuery extends PageQuery {
  status?: InterviewStatus;
}
export interface ReviewsQuery extends PageQuery {
  status?: InterviewStatus;
}
export interface ChangeRequestsQuery extends PageQuery {
  status?: ChangeRequestStatus;
  type?: ChangeRequestType;
}
export interface ProblemMatch {
  kind: "QUESTION" | "FOLLOW_UP";
  questionId: number;
  followUpId: number | null;
  roundName: string;
  snippet: string;
}
export interface MetaMatch {
  kind: "META";
  questionId: null;
  followUpId: null;
  roundName: string | null;
  snippet: string;
}
export type SearchMatch = ProblemMatch | MetaMatch;
export interface InterviewSummary {
  id: number;
  company: Company;
  department: string | null;
  position: Position;
  recruitType: RecruitType;
  firstInterviewDate: string | null;
  firstInterviewDatePrecision: DatePrecision | null;
  rounds: string[];
  tags: string[];
  matches?: SearchMatch[];
}
export type InterviewList = PageResponse<InterviewSummary>;
export interface InterviewFiltersResponse {
  total: number;
  /** 「全部」= 忽略该维度、保留其余条件后的结果数（岗位维度的未分类记录计入 positionCategoryTotal）。 */
  companyTotal: number;
  positionCategoryTotal: number;
  recruitTypeTotal: number;
  companies: (Company & { count: number })[];
  positionCategories: {
    value: PositionCategory;
    label: string;
    count: number;
  }[];
  recruitTypes: { value: RecruitType; label: string; count: number }[];
}
export interface FollowUp {
  id: number;
  content: string;
}
export interface Question {
  id: number;
  content: string;
  /** 用户可见的唯一题目链接（后端合并：reference_url ?? leetcode_url）。 */
  referenceUrl: string | null;
  questionType: "NORMAL" | "ALGORITHM";
  /** 历史兼容字段：新投稿不再写入，仅历史数据读取时返回。 */
  sectionLabel?: string | null;
  contextNote?: string | null;
  algorithmTitle?: string | null;
  algorithmDescription?: string | null;
  algorithmRequirements?: string | null;
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
export interface InterviewDetailResponse {
  id: number;
  company: Company;
  department: string | null;
  position: Position;
  recruitType: RecruitType;
  tags: Tag[];
  firstInterviewDate: string | null;
  firstInterviewDatePrecision: DatePrecision | null;
  originalPositionName: string | null;
  inferredPositionName: string | null;
  note: string | null;
  rounds: InterviewRound[];
  sources: Source[];
}
export type InterviewDetail = InterviewDetailResponse;
export type InterviewSummaryResponse = InterviewSummary;
export interface FollowUpInput {
  id?: number | null;
  content: string;
}
/** 写入模型（V1 简化冻结）：正文 + 可选题目链接 + 追问；questionType 由后端按链接推断。 */
export interface QuestionInput {
  id?: number | null;
  content: string;
  referenceUrl?: string | null;
  followUps: FollowUpInput[];
}
/** 写入模型（V1 简化冻结）：日期只有 YYYY-MM-DD 或 null，没有精度概念。 */
export interface RoundInput {
  id?: number | null;
  roundType: RoundType;
  roundNo: number | null;
  interviewDate: string | null;
  questions: QuestionInput[];
}
export interface InterviewChangePayload {
  company: SelectionInput;
  position: SelectionInput;
  department: string | null;
  recruitType: RecruitType | null;
  tagIds: number[];
  proposedTags: string[];
  rounds: RoundInput[];
  sourceUrl: string | null;
}
export interface InterviewUpsertRequest extends InterviewChangePayload {
  version: number;
}
export interface InterviewActions {
  canEdit: boolean;
  canSubmit: boolean;
  canDeleteDraft: boolean;
  canRequestChange: boolean;
  canRequestDelete: boolean;
}
export interface EditableInterview {
  id: number;
  status: InterviewStatus;
  version: number;
  company: CatalogSelectionView | null;
  position: CatalogSelectionView | null;
  department: string | null;
  recruitType: RecruitType | null;
  tags: CatalogSelectionView[];
  rounds: InterviewRound[];
  sourceUrl: string | null;
  updateTime: string;
}
export interface MyInterviewDetailResponse extends EditableInterview {
  rejectionReason: string | null;
  createTime: string;
  actions: InterviewActions;
}
export interface MyInterviewListItem {
  id: number;
  company: CatalogSelectionView | null;
  position: CatalogSelectionView | null;
  department: string | null;
  recruitType: RecruitType | null;
  status: InterviewStatus;
  version: number;
  rejectionReason: string | null;
  firstInterviewDate: string | null;
  firstInterviewDatePrecision: DatePrecision | null;
  roundCount: number;
  questionCount: number;
  hasPendingChangeRequest: boolean;
  createTime: string;
  updateTime: string;
  actions: InterviewActions;
}
export type MyInterviewListResponse = PageResponse<MyInterviewListItem>;
export interface InterviewSaveResponse<T = EditableInterview> {
  interview: T;
  warnings: Warning[];
}
export interface InterviewMutationResponse {
  id: number;
  status: InterviewStatus;
  version: number;
  updateTime: string;
  warnings: Warning[];
}
export interface DeleteDraftResponse {
  id: number;
  deleted: true;
}
export interface Candidate {
  id: number;
  type: "COMPANY" | "POSITION" | "TAG";
  value: string;
  suggestedMatches: Company[];
}
export type ResolveCandidateRequest =
  | { version: number; action: "USE_EXISTING"; targetId: number }
  | { version: number; action: "CREATE_NEW"; name: string }
  | { version: number; action: "REMOVE" };
export interface ResolveCandidateResponse {
  resolvedCandidateId: number;
  interview: Omit<InterviewMutationResponse, "warnings">;
}
export interface AdminReviewListItem {
  id: number;
  company: CatalogSelectionView | null;
  position: CatalogSelectionView | null;
  author: Author;
  status: InterviewStatus;
  version: number;
  candidateCount: number;
  submitTime: string | null;
  updateTime: string;
}
export interface SubmissionSnapshot {
  id: number;
  createTime: string;
  content: InterviewChangePayload;
}
export interface AdminReviewResponse {
  interview: EditableInterview & {
    createTime: string;
    rejectionReason?: string | null;
  };
  author: Author;
  candidates: Candidate[];
  submissionSnapshot: SubmissionSnapshot | null;
}
export interface PublishedInterview {
  id: number;
  status: InterviewStatus;
  version: number;
  company: Company;
  department: string | null;
  position: Position;
  recruitType: RecruitType;
  tags: Tag[];
  rounds: InterviewRound[];
  sources: Source[];
  originalPositionName?: string | null;
  inferredPositionName?: string | null;
  note?: string | null;
  updateTime?: string;
}
export interface AdminPublishedInterviewResponse {
  interview: PublishedInterview;
  pendingChangeRequest: {
    id: number;
    type: ChangeRequestType;
    baseVersion: number;
    updateTime: string;
  } | null;
  actions: { canEditDirectly: boolean };
}
export interface AdminPublishedInterviewUpdateRequest extends Omit<
  InterviewUpsertRequest,
  "sourceUrl"
> {
  sourceUrls: string[];
}
export type ChangeRequestType = "UPDATE" | "DELETE";
export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SaveChangeRequestRequest =
  | { type: "UPDATE"; baseVersion: number; payload: InterviewChangePayload }
  | { type: "DELETE"; baseVersion: number; reason: string };
export interface ChangeRequestResponse {
  id: number;
  requestVersion: number;
  interviewId?: number;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  baseVersion: number;
  payload: InterviewChangePayload | null;
  reason: string | null;
  createTime: string;
  updateTime: string;
}
export interface ChangeInterviewBaseline extends Omit<
  PublishedInterview,
  "status" | "sources"
> {
  sourceUrl: string | null;
}
export interface MyChangeRequestResponse {
  interview: ChangeInterviewBaseline;
  changeRequest: ChangeRequestResponse | null;
}
export interface AdminChangeRequestListItem {
  id: number;
  requestVersion: number;
  type: ChangeRequestType;
  status: ChangeRequestStatus;
  baseVersion: number;
  interview: {
    id: number;
    companyName: string;
    positionName: string;
    status: InterviewStatus;
    version: number;
  };
  requester: Author;
  reason: string | null;
  createTime: string;
  updateTime: string;
}
export interface AdminChangeRequestResponse {
  changeRequest: ChangeRequestResponse;
  currentInterview: PublishedInterview;
  requester: Author;
}
export interface ChangeRequestMutationResponse {
  changeRequest: {
    id: number;
    status: ChangeRequestStatus;
    reviewTime: string;
  };
  interview: { id: number; status: InterviewStatus; version: number };
}
export interface ApiErrorBody {
  code: string;
  message: string;
}

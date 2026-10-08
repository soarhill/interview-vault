import cards from "./fixtures/cards.json";
import detail from "./fixtures/detail.json";
import type {
  Author,
  Candidate,
  Company,
  CurrentUserResponse,
  DatePrecision,
  InterviewChangePayload,
  InterviewDetailResponse,
  MyInterviewDetailResponse,
  Position,
  Source,
  SubmissionSnapshot,
  Tag,
  ChangeRequestResponse,
} from "./types";

export const mockUsers: Record<"USER" | "ADMIN", CurrentUserResponse> = {
  USER: { id: 100, githubLogin: "offer-seeker", avatarUrl: null, role: "USER" },
  ADMIN: {
    id: 200,
    githubLogin: "offer-reviewer",
    avatarUrl: null,
    role: "ADMIN",
  },
};
/** mock 方向目录（V7 目录化）：key=目录 id 字符串，value=方向名。 */
export const positionCategoryCatalog: { id: number; name: string }[] = [
  { id: 1, name: "Agent 开发" },
  { id: 2, name: "AI 应用" },
  { id: 3, name: "AI Infra" },
  { id: 4, name: "后端开发" },
  { id: 99, name: "其他" },
];
export interface MockRecord {
  interview: MyInterviewDetailResponse;
  author: Author;
  candidates: Candidate[];
  submissionSnapshot: SubmissionSnapshot | null;
  sources: Source[];
  originalPositionName: string | null;
  inferredPositionName: string | null;
  note: string | null;
}
export interface MockState {
  schema: 2;
  cheerCount: number;
  nextId: number;
  companies: Company[];
  positions: Position[];
  tags: Tag[];
  records: MockRecord[];
  changeRequests: (ChangeRequestResponse & {
    interviewId: number;
    requester: Author;
  })[];
}
const initialTime = "2026-10-06T02:00:00.000Z";
function baseDraft(id: number): MyInterviewDetailResponse {
  return {
    id,
    status: "DRAFT",
    version: 0,
    rejectionReason: null,
    company: null,
    position: null,
    department: null,
    recruitType: null,
    tags: [],
    rounds: [],
    sourceUrl: null,
    createTime: initialTime,
    updateTime: initialTime,
    actions: {
      canEdit: true,
      canSubmit: true,
      canDeleteDraft: true,
      canRequestChange: false,
      canRequestDelete: false,
    },
  };
}
export function interviewPayload(
  interview: MyInterviewDetailResponse,
): InterviewChangePayload {
  const selection = (value: MyInterviewDetailResponse["company"]) => ({
    existingId: value?.source === "OFFICIAL" ? value.id : null,
    proposedName: value?.source === "PROPOSED" ? value.name : null,
  });
  return {
    company: selection(interview.company),
    position: selection(interview.position),
    department: interview.department,
    recruitType: interview.recruitType,
    tagIds: interview.tags.flatMap((tag) => (tag.id === null ? [] : [tag.id])),
    proposedTags: interview.tags
      .filter((tag) => tag.source === "PROPOSED")
      .map((tag) => tag.name),
    rounds: interview.rounds.map((round) => ({
      id: round.id,
      roundType: round.roundType,
      roundNo: round.roundNo,
      interviewDate: round.interviewDate,
      questions: round.questions.map((question) => ({
        id: question.id,
        content: question.content,
        referenceUrl: question.referenceUrl ?? question.leetcodeUrl ?? null,
        followUps: question.followUps,
      })),
    })),
    sourceUrl: interview.sourceUrl,
  };
}
export function createMockState(): MockState {
  const companies = Array.from(
    new Map(
      cards.map(({ company }) => [
        company.id,
        { id: company.id, name: company.name },
      ]),
    ).values(),
  );
  const positions: Position[] = positionCategoryCatalog.map((c, index) => ({
    id: index + 10,
    name: c.name === "后端开发" ? "Java 后端开发" : c.name,
    category: c.name,
  }));
  const tags: Tag[] = [
    { id: 3, name: "Redis" },
    { id: 7, name: "MySQL" },
    { id: 12, name: "JUC" },
  ];
  const records: MockRecord[] = cards.map((card, index) => {
    const shift = index * 100000;
    // V6 五类：fixtures 里的 ai_backend 归入 BACKEND（与真实库归并口径一致）
    const code = card.roleCategory.code;
    const category =
      code === "ai_app"
        ? "AI 应用"
        : code === "ai_backend"
          ? "后端开发"
          : code === "agent"
            ? "Agent 开发"
            : code === "platform_infra"
              ? "AI Infra"
              : code === "other"
                ? "其他"
                : "后端开发";
    const position = positions.find((item) => item.category === category)!;
    const date = card.interviewDate
      ? card.interviewDate.length === 7
        ? `${card.interviewDate}-01`
        : card.interviewDate.length === 4
          ? `${card.interviewDate}-01-01`
          : card.interviewDate
      : null;
    const rounds = detail.rounds.map((round) => ({
      id: round.id + shift,
      roundType: round.name.startsWith("HR")
        ? ("HR" as const)
        : ("TECHNICAL" as const),
      roundNo: round.name.startsWith("HR") ? null : round.seq,
      displayName: round.name,
      remark: round.note,
      interviewDate: date,
      interviewDatePrecision: card.datePrecision as DatePrecision | null,
      questions: round.questions.map((question) => ({
        id: question.id + shift,
        content: question.content,
        // V1 简化冻结：读侧 referenceUrl = reference_url ?? leetcode_url（与后端一致）
        referenceUrl: question.algorithm?.leetcodeUrl ?? null,
        questionType: question.type as "NORMAL" | "ALGORITHM",
        sectionLabel: question.sectionLabel,
        contextNote: question.contextNote,
        algorithmTitle: question.algorithm?.title ?? null,
        algorithmDescription: question.algorithm?.description ?? null,
        algorithmRequirements: question.algorithm?.requirements ?? null,
        leetcodeNumber: question.algorithm?.leetcodeNumber ?? null,
        leetcodeUrl: question.algorithm?.leetcodeUrl ?? null,
        followUps: question.followUps.map((follow) => ({
          id: follow.id + shift,
          content: follow.content,
        })),
      })),
    }));
    return {
      interview: {
        ...baseDraft(card.id),
        status: "PUBLISHED",
        version: 15,
        company: {
          id: card.company.id,
          name: card.company.name,
          source: "OFFICIAL",
        },
        position: { ...position, source: "OFFICIAL" },
        department: index === 0 ? "抖音电商" : null,
        recruitType:
          card.recruitmentType === "INTERNSHIP" ? "INTERN" : "CAMPUS",
        tags: tags.map((tag) => ({ ...tag, source: "OFFICIAL" })),
        rounds,
        sourceUrl: null,
      },
      author: { id: 101, githubLogin: "seed-contributor", avatarUrl: null },
      candidates: [],
      submissionSnapshot: null,
      sources: [
        {
          id: 10 + shift,
          url: `https://www.nowcoder.com/discuss/mock-${card.id}-a`,
        },
        {
          id: 11 + shift,
          url: `https://www.nowcoder.com/discuss/mock-${card.id}-b`,
        },
      ],
      originalPositionName: card.roleOriginal,
      inferredPositionName: card.roleInferred,
      note: index === 0 ? detail.note : null,
    };
  });
  const example = structuredClone(records[0]);
  for (const [id, status] of [
    [1001, "DRAFT"],
    [1002, "PENDING_REVIEW"],
    [1003, "REJECTED"],
    [1004, "PUBLISHED"],
  ] as const) {
    const record = structuredClone(example);
    record.interview.id = id;
    record.interview.status = status;
    record.interview.version = status === "DRAFT" ? 0 : 3;
    record.interview.rounds = structuredClone(record.interview.rounds)
      .filter((round) => round.questions.length > 0)
      .map((round) => ({
        ...round,
        id: round.id + id * 100000,
        questions: round.questions.map((question) => ({
          ...question,
          id: question.id + id * 100000,
          followUps: question.followUps.map((follow) => ({
            ...follow,
            id: follow.id + id * 100000,
          })),
        })),
      }));
    record.author = {
      id: mockUsers.USER.id,
      githubLogin: mockUsers.USER.githubLogin,
      avatarUrl: mockUsers.USER.avatarUrl,
    };
    record.sources = [
      { id: id * 100000, url: `https://example.com/interview-${id}` },
    ];
    record.interview.sourceUrl = record.sources[0].url;
    record.originalPositionName = null;
    record.inferredPositionName = null;
    record.note = null;
    if (status === "DRAFT") record.interview.rounds = [];
    if (status === "PENDING_REVIEW") {
      record.interview.position = {
        id: null,
        name: "Agent Infra Engineer",
        category: null,
        source: "PROPOSED",
      };
      record.interview.tags.push({
        id: null,
        name: "Agent Memory",
        source: "PROPOSED",
      });
      record.candidates = [
        {
          id: 901,
          type: "POSITION",
          value: "Agent Infra Engineer",
          suggestedMatches: [{ id: 10, name: "Agent" }],
        },
        { id: 902, type: "TAG", value: "Agent Memory", suggestedMatches: [] },
      ];
    }
    if (status === "REJECTED")
      record.interview.rejectionReason =
        "请补充面试过程中的具体问题，并核对来源。";
    if (status !== "DRAFT")
      record.submissionSnapshot = {
        id: id + 7000,
        createTime: initialTime,
        content: interviewPayload(record.interview),
      };
    records.push(record);
  }
  return {
    schema: 2,
    cheerCount: 1283,
    nextId: 400000000,
    companies,
    positions,
    tags,
    records,
    changeRequests: [],
  };
}
export function publicDetail(record: MockRecord): InterviewDetailResponse {
  const { interview } = record;
  if (
    !interview.company?.id ||
    !interview.position?.id ||
    !interview.position.category ||
    !interview.recruitType
  )
    throw new Error("Mock 的公开面经缺少正式目录");
  const first = interview.rounds
    .filter((round) => round.interviewDate)
    .sort((a, b) => a.interviewDate!.localeCompare(b.interviewDate!))[0];
  return {
    id: interview.id,
    company: { id: interview.company.id, name: interview.company.name },
    department: interview.department,
    position: {
      id: interview.position.id,
      name: interview.position.name,
      category: interview.position.category,
    },
    recruitType: interview.recruitType,
    tags: interview.tags.flatMap((tag) =>
      tag.id === null ? [] : [{ id: tag.id, name: tag.name }],
    ),
    firstInterviewDate: first?.interviewDate ?? null,
    firstInterviewDatePrecision: first?.interviewDatePrecision ?? null,
    originalPositionName: record.originalPositionName,
    inferredPositionName: record.inferredPositionName,
    note: record.note,
    rounds: interview.rounds,
    sources: record.sources,
  };
}

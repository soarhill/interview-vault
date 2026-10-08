import { ApiError } from "./errors";
import {
  positionCategoryCatalog,
  createMockState,
  interviewPayload,
  mockUsers,
  publicDetail,
  type MockRecord,
  type MockState,
} from "./mock-data";
import type {
  AdminPublishedInterviewUpdateRequest,
  Candidate,
  CatalogSelectionView,
  ChangeRequestResponse,
  CurrentUserResponse,
  EditableInterview,
  InterviewChangePayload,
  InterviewMutationResponse,
  InterviewRound,
  InterviewSummary,
  InterviewUpsertRequest,
  ListQuery,
  PageResponse,
  PositionCategory,
  PublishedInterview,
  ResolveCandidateRequest,
  SaveChangeRequestRequest,
  SearchMatch,
  SelectionInput,
  UserRole,
  Warning,
} from "./types";

const STATE_KEY = "interview-vault.public-beta.mock.v1";
const ROLE_KEY = "interview-vault.public-beta.mock.role";
let memoryState: MockState | null = null;
let memoryRole: UserRole | null = null;
function readState(): MockState {
  if (typeof window === "undefined")
    return structuredClone((memoryState ??= createMockState()));
  const saved = window.localStorage.getItem(STATE_KEY);
  if (!saved) {
    const initial = createMockState();
    window.localStorage.setItem(STATE_KEY, JSON.stringify(initial));
    return initial;
  }
  const parsed: unknown = JSON.parse(saved);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("schema" in parsed) ||
    (parsed.schema !== 1 && parsed.schema !== 2)
  )
    throw new Error("演示数据版本不兼容，请重置演示数据。");
  // schema 1 → 2：补充加油计数字段
  if (parsed.schema === 1) {
    parsed.schema = 2;
    (parsed as MockState).cheerCount = 1283;
  }
  for (const change of (parsed as MockState).changeRequests) change.requestVersion ??= 0;
  return parsed as MockState;
}
function writeState(state: MockState): void {
  if (typeof window === "undefined") memoryState = structuredClone(state);
  else window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
export function resetMockState(): void {
  writeState(createMockState());
}
function currentUser(): CurrentUserResponse | null {
  const role =
    typeof window === "undefined"
      ? memoryRole
      : window.sessionStorage.getItem(ROLE_KEY);
  return role === "USER" || role === "ADMIN" ? mockUsers[role] : null;
}
export function selectMockRole(
  role: UserRole | null,
): CurrentUserResponse | null {
  if (typeof window === "undefined") memoryRole = role;
  else if (role) window.sessionStorage.setItem(ROLE_KEY, role);
  else window.sessionStorage.removeItem(ROLE_KEY);
  return currentUser();
}
function requireUser(admin = false): CurrentUserResponse {
  const user = currentUser();
  if (!user) throw new ApiError(401, "AUTH_REQUIRED", "请先使用 GitHub 登录。");
  if (admin && user.role !== "ADMIN")
    throw new ApiError(403, "ACCESS_DENIED", "当前账号没有管理员权限。");
  return user;
}
function recordById(state: MockState, id: number, owner = false): MockRecord {
  const record = state.records.find((item) => item.interview.id === id);
  if (!record) throw new ApiError(404, "INTERVIEW_NOT_FOUND", "面经不存在。");
  if (owner && record.author.id !== requireUser().id)
    throw new ApiError(403, "INTERVIEW_NOT_OWNER", "你无权修改这份投稿。");
  return record;
}
function checkVersion(record: MockRecord, version: number): void {
  if (record.interview.version !== version)
    throw new ApiError(
      409,
      "INTERVIEW_VERSION_CONFLICT",
      "当前内容已经发生变化，请刷新后重新确认。",
    );
}
function checkStatus(record: MockRecord, allowed: string[]): void {
  if (!allowed.includes(record.interview.status))
    throw new ApiError(
      409,
      "INTERVIEW_STATUS_CONFLICT",
      "当前面经状态已经发生变化，请刷新后重试。",
    );
}
function now(): string {
  return new Date().toISOString();
}
function authorView(user: CurrentUserResponse) {
  return {
    id: user.id,
    githubLogin: user.githubLogin,
    avatarUrl: user.avatarUrl,
  };
}
function mutation(
  record: MockRecord,
  warnings: Warning[] = [],
): InterviewMutationResponse {
  const { id, status, version, updateTime } = record.interview;
  return { id, status, version, updateTime, warnings };
}
function advance(record: MockRecord): void {
  record.interview.version += 1;
  record.interview.updateTime = now();
}
function canonical(record: MockRecord): EditableInterview {
  const {
    id,
    status,
    version,
    company,
    position,
    department,
    recruitType,
    tags,
    rounds,
    sourceUrl,
    updateTime,
  } = record.interview;
  return {
    id,
    status,
    version,
    company,
    position,
    department,
    recruitType,
    tags,
    rounds,
    sourceUrl,
    updateTime,
  };
}
function published(record: MockRecord): PublishedInterview {
  const data = publicDetail(record);
  return {
    id: data.id,
    status: record.interview.status,
    version: record.interview.version,
    company: data.company,
    position: data.position,
    department: data.department,
    recruitType: data.recruitType,
    tags: data.tags,
    rounds: data.rounds,
    sources: data.sources,
    originalPositionName: data.originalPositionName,
    inferredPositionName: data.inferredPositionName,
    note: data.note,
    updateTime: record.interview.updateTime,
  };
}
function pendingRequest(state: MockState, id: number) {
  return (
    state.changeRequests.find(
      (request) => request.interviewId === id && request.status === "PENDING",
    ) ?? null
  );
}
function changeView(
  change: MockState["changeRequests"][number],
): ChangeRequestResponse {
  return {
    id: change.id,
    requestVersion: change.requestVersion,
    type: change.type,
    status: change.status,
    baseVersion: change.baseVersion,
    payload: change.payload,
    reason: change.reason,
    createTime: change.createTime,
    updateTime: change.updateTime,
  };
}
function actions(record: MockRecord) {
  const status = record.interview.status;
  return {
    canEdit: ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(status),
    canSubmit: status === "DRAFT",
    canDeleteDraft: status === "DRAFT" && record.submissionSnapshot === null,
    canRequestChange: status === "PUBLISHED",
    canRequestDelete: status === "PUBLISHED",
  };
}
function page<T>(items: T[], query: Record<string, unknown>): PageResponse<T> {
  const number = Number(query.page ?? 1),
    size = Number(query.size ?? 20);
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new ApiError(400, "VALIDATION_ERROR", "分页参数非法。");
  return {
    items: items.slice((number - 1) * size, number * size),
    total: items.length,
    page: number,
    size,
  };
}
function validateSelection(input: SelectionInput): void {
  if (
    !input ||
    typeof input !== "object" ||
    (input.existingId != null &&
      (!Number.isInteger(input.existingId) || input.existingId <= 0))
  )
    throw new ApiError(400, "VALIDATION_ERROR", "目录 ID 不合法。");
  if (input.existingId != null && input.proposedName != null)
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "已有目录项与新增名称只能选择一个。",
    );
  if (input.proposedName != null && !input.proposedName.trim())
    throw new ApiError(400, "VALIDATION_ERROR", "新增名称不能为空白。");
}
function validatePayload(
  payload: InterviewChangePayload,
  complete = false,
): void {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.rounds) ||
    !Array.isArray(payload.tagIds) ||
    !Array.isArray(payload.proposedTags)
  )
    throw new ApiError(400, "VALIDATION_ERROR", "投稿请求格式不正确。");
  validateSelection(payload.company);
  validateSelection(payload.position);
  if (payload.department != null && !payload.department.trim())
    throw new ApiError(400, "VALIDATION_ERROR", "部门名称不能为空白。");
  if (payload.sourceUrl && !/^https?:\/\//i.test(payload.sourceUrl))
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "来源必须是 HTTP 或 HTTPS 链接。",
    );
  if (
    payload.recruitType != null &&
    !["INTERN", "CAMPUS"].includes(payload.recruitType)
  )
    throw new ApiError(400, "VALIDATION_ERROR", "招聘类型不合法。");
  const proposed = payload.proposedTags.map((tag) => tag.trim().toLowerCase());
  if (
    proposed.some((tag) => !tag) ||
    new Set(proposed).size !== proposed.length
  )
    throw new ApiError(400, "VALIDATION_ERROR", "新增标签不能为空或重复。");
  const technical = new Set<number>();
  for (const round of payload.rounds) {
    if (
      !Array.isArray(round.questions) ||
      !["TECHNICAL", "HR", "UNKNOWN"].includes(round.roundType)
    )
      throw new ApiError(400, "VALIDATION_ERROR", "轮次格式不合法。");
    if (round.roundType === "TECHNICAL") {
      if (
        round.roundNo === null ||
        !Number.isInteger(round.roundNo) ||
        round.roundNo < 1 ||
        round.roundNo > 5 ||
        technical.has(round.roundNo)
      )
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "技术面轮次必须为 1 至 5，且不能重复。",
        );
      technical.add(round.roundNo);
    } else if (round.roundNo !== null)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "HR 面与历史未知轮次不能填写技术轮次编号。",
      );
    if (round.interviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(round.interviewDate))
      throw new ApiError(400, "VALIDATION_ERROR", "日期格式不合法。");
    for (const question of round.questions) {
      if (!Array.isArray(question.followUps))
        throw new ApiError(400, "VALIDATION_ERROR", "问题格式不合法。");
      if (question.referenceUrl && !/^https?:\/\//.test(question.referenceUrl))
        throw new ApiError(400, "VALIDATION_ERROR", "题目链接必须是 HTTP/HTTPS URL。");
    }
  }
  if (
    complete &&
    (!(payload.company.existingId || payload.company.proposedName) ||
      !(payload.position.existingId || payload.position.proposedName) ||
      !payload.recruitType ||
      !payload.rounds.length ||
      !payload.rounds.some((round) => round.questions.length) ||
      payload.rounds.some((round) =>
        round.questions.some(
          (question) =>
            !question.content.trim() ||
            question.followUps.some((follow) => !follow.content.trim()),
        ),
      ))
  )
    throw new ApiError(
      400,
      "INTERVIEW_INCOMPLETE",
      "请填写公司、岗位、招聘类型、面试轮次和具体问题。",
    );
}
function selectCatalog(
  state: MockState,
  kind: "COMPANY" | "POSITION" | "TAG",
  input: SelectionInput,
  formal: boolean,
): CatalogSelectionView | null {
  const list =
    kind === "COMPANY"
      ? state.companies
      : kind === "POSITION"
        ? state.positions
        : state.tags;
  if (input.existingId != null) {
    const target = list.find((item) => item.id === input.existingId);
    if (!target)
      throw new ApiError(400, `${kind}_NOT_FOUND`, "选择的目录项不存在。");
    return { ...target, source: "OFFICIAL" };
  }
  const name = input.proposedName?.trim();
  if (!name) return null;
  if (!formal)
    return {
      id: null,
      name,
      source: "PROPOSED",
      ...(kind === "POSITION" ? { category: null } : {}),
    };
  let target = list.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  if (!target) {
    target = {
      id: state.nextId++,
      name,
      ...(kind === "POSITION" ? { category: "OTHER" as PositionCategory } : {}),
    };
    if (kind === "POSITION")
      state.positions.push(target as MockState["positions"][number]);
    else list.push(target);
  }
  return { ...target, source: "OFFICIAL" };
}
function reconcileRounds(
  state: MockState,
  record: MockRecord,
  payload: InterviewChangePayload,
): InterviewRound[] {
  const oldRounds = record.interview.rounds;
  const seenRounds = new Set<number>();
  function stableId(
    id: number | null | undefined,
    allowed: number[],
    seen: Set<number>,
  ): number {
    if (id == null) return state.nextId++;
    if (!allowed.includes(id) || seen.has(id))
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "子项 ID 不属于当前面经，或被重复使用。",
      );
    seen.add(id);
    return id;
  }
  return payload.rounds.map((input) => {
    const oldRound = oldRounds.find((item) => item.id === input.id);
    const seenQuestions = new Set<number>();
    // 日期与库中一致 → 保留历史月 / 年精度；变化 → DAY；清空 → 同空（与后端一致）
    const precision =
      input.interviewDate == null
        ? null
        : oldRound?.interviewDate != null &&
            oldRound.interviewDate === input.interviewDate
          ? (oldRound.interviewDatePrecision ?? "DAY")
          : "DAY";
    return {
      id: stableId(
        input.id,
        oldRounds.map((item) => item.id),
        seenRounds,
      ),
      roundType: input.roundType,
      roundNo: input.roundNo,
      displayName:
        input.roundType === "HR"
          ? "HR 面"
          : input.roundType === "UNKNOWN"
            ? oldRound?.displayName || "历史轮次"
            : `${["", "一", "二", "三", "四", "五"][input.roundNo ?? 0]}面`,
      remark: oldRound?.remark ?? null,
      interviewDate: input.interviewDate,
      interviewDatePrecision: precision,
      questions: input.questions.map((question) => {
        const oldQuestion = oldRound?.questions.find(
          (item) => item.id === question.id,
        );
        const seenFollowUps = new Set<number>();
        const referenceUrl = question.referenceUrl?.trim() || null;
        return {
          id: stableId(
            question.id,
            oldRound?.questions.map((item) => item.id) ?? [],
            seenQuestions,
          ),
          content: question.content,
          referenceUrl,
          // 带链接 → ALGORITHM；无链接保留历史类型（只升不降）
          questionType: referenceUrl
            ? "ALGORITHM"
            : (oldQuestion?.questionType ?? "NORMAL"),
          sectionLabel: oldQuestion?.sectionLabel ?? null,
          contextNote: oldQuestion?.contextNote ?? null,
          algorithmTitle: oldQuestion?.algorithmTitle ?? null,
          algorithmDescription: oldQuestion?.algorithmDescription ?? null,
          algorithmRequirements: oldQuestion?.algorithmRequirements ?? null,
          leetcodeNumber: oldQuestion?.leetcodeNumber ?? null,
          leetcodeUrl: referenceUrl ? (oldQuestion?.leetcodeUrl ?? null) : null,
          followUps: question.followUps.map((follow) => ({
            id: stableId(
              follow.id,
              oldQuestion?.followUps.map((item) => item.id) ?? [],
              seenFollowUps,
            ),
            content: follow.content,
          })),
        };
      }),
    };
  });
}
function applyPayload(
  state: MockState,
  record: MockRecord,
  payload: InterviewChangePayload,
  formal = false,
  sourceUrls?: string[],
): Warning[] {
  validatePayload(payload, formal);
  const company = selectCatalog(state, "COMPANY", payload.company, formal),
    position = selectCatalog(state, "POSITION", payload.position, formal);
  const tags = [
    ...payload.tagIds.map((id) =>
      selectCatalog(state, "TAG", { existingId: id }, formal)!,
    ),
    ...payload.proposedTags.map((proposedName) =>
      selectCatalog(state, "TAG", { proposedName }, formal)!,
    ),
  ];
  const rounds = reconcileRounds(state, record, payload);
  Object.assign(record.interview, {
    company,
    position,
    department: payload.department,
    recruitType: payload.recruitType,
    tags,
    rounds,
    sourceUrl: payload.sourceUrl,
  });
  record.candidates = [];
  if (!formal) {
    for (const [type, item] of [
      ["COMPANY", company],
      ["POSITION", position],
      ...tags.map((tag) => ["TAG", tag]),
    ] as [Candidate["type"], CatalogSelectionView | null][]) {
      if (item?.source === "PROPOSED")
        record.candidates.push({
          id: state.nextId++,
          type,
          value: item.name,
          suggestedMatches: [],
        });
    }
  }
  const urls = sourceUrls ?? (payload.sourceUrl ? [payload.sourceUrl] : []);
  record.sources = urls.map(
    (url) =>
      record.sources.find((source) => source.url === url) ?? {
        id: state.nextId++,
        url,
      },
  );
  return payload.sourceUrl &&
    state.records.some(
      (item) =>
        item !== record &&
        item.sources.some((source) => source.url === payload.sourceUrl),
    )
    ? [
        {
          code: "SOURCE_URL_DUPLICATE_SUSPECTED",
          message: "该来源链接已有相关面经，请确认是否为同一份内容。",
        },
      ]
    : [];
}
function searchMatches(record: MockRecord, q: string): SearchMatch[] {
  if (!q.trim()) return [];
  const terms = q.toLowerCase().trim().split(/\s+/);
  const matches: SearchMatch[] = [];
  for (const round of record.interview.rounds)
    for (const question of round.questions) {
      if (
        terms.some((term) =>
          [
            question.content,
            question.algorithmTitle,
            question.algorithmDescription,
            question.contextNote,
            question.sectionLabel,
          ].some((text) => text?.toLowerCase().includes(term)),
        )
      )
        matches.push({
          kind: "QUESTION",
          questionId: question.id,
          followUpId: null,
          roundName: round.displayName,
          snippet: question.content,
        });
      for (const follow of question.followUps)
        if (terms.some((term) => follow.content.toLowerCase().includes(term)))
          matches.push({
            kind: "FOLLOW_UP",
            questionId: question.id,
            followUpId: follow.id,
            roundName: round.displayName,
            snippet: follow.content,
          });
    }
  return matches.length
    ? matches
    : [
        {
          kind: "META",
          questionId: null,
          followUpId: null,
          roundName: null,
          snippet: [
            record.interview.company?.name,
            record.interview.position?.name,
            ...record.interview.tags.map((tag) => tag.name),
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ];
}
function filtered(state: MockState, query: ListQuery): MockRecord[] {
  return state.records.filter((record) => {
    const data = record.interview;
    if (
      data.status !== "PUBLISHED" ||
      (query.companyId && data.company?.id !== Number(query.companyId)) ||
      (query.positionCategory &&
        data.position?.category !== query.positionCategory) ||
      (query.recruitType && data.recruitType !== query.recruitType)
    )
      return false;
    const text = [
      data.company?.name,
      data.position?.name,
      data.department,
      record.originalPositionName,
      record.inferredPositionName,
      ...data.tags.map((tag) => tag.name),
      ...data.rounds.flatMap((round) =>
        round.questions.flatMap((question) => [
          question.content,
          question.algorithmTitle,
          question.algorithmDescription,
          question.contextNote,
          ...question.followUps.map((follow) => follow.content),
        ]),
      ),
    ]
      .join(" ")
      .toLowerCase();
    return (
      !query.q ||
      query.q
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .every((term) => text.includes(term))
    );
  });
}
function summary(record: MockRecord, q = ""): InterviewSummary {
  const data = publicDetail(record);
  return {
    id: data.id,
    company: data.company,
    position: data.position,
    department: data.department,
    recruitType: data.recruitType,
    firstInterviewDate: data.firstInterviewDate,
    firstInterviewDatePrecision: data.firstInterviewDatePrecision,
    rounds: data.rounds.map((round) => round.displayName),
    tags: data.tags.map((tag) => tag.name),
    matches: searchMatches(record, q),
  };
}
function response(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ code: "SUCCESS", message: "success", data }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
function dispatch(
  state: MockState,
  path: string,
  query: Record<string, unknown>,
  body: unknown,
  method: string,
): Response {
  if (query.q === "__error__" || path === "/interviews/500")
    throw new ApiError(500, "INTERNAL_ERROR", "演示服务暂时不可用。");
  if (path === "/auth/csrf") {
    if (typeof document !== "undefined")
      document.cookie = "XSRF-TOKEN=mock-csrf-token; Path=/; SameSite=Lax";
    return response(null);
  }
  if (path === "/auth/me") return response(requireUser());
  if (path === "/auth/logout" && method === "POST") {
    requireUser();
    selectMockRole(null);
    return response(null);
  }
  if (path.startsWith("/admin/")) requireUser(true);
  if (path.startsWith("/me/")) requireUser();
  if (path === "/position-categories") {
    return response({ items: positionCategoryCatalog });
  }
  if (["/companies", "/positions", "/tags"].includes(path)) {
    const list =
      path === "/companies"
        ? state.companies
        : path === "/positions"
          ? state.positions
          : state.tags;
    return response({
      items: list.filter(
        (item) =>
          (!query.q ||
            item.name.toLowerCase().includes(String(query.q).toLowerCase())) &&
          (!query.category ||
            ("category" in item && item.category === query.category)),
      ),
    });
  }
  if (path === "/interviews")
    return response(
      page(
        filtered(state, query).map((record) =>
          summary(record, String(query.q ?? "")),
        ),
        query,
      ),
    );
  if (path === "/cheers" && method === "POST") {
    state.cheerCount += 1;
    return response({ count: state.cheerCount });
  }
  if (path === "/cheers") {
    return response({ count: state.cheerCount });
  }
  if (path === "/interview-filters") {
    const common = { q: String(query.q ?? "") };
    // url 上的 positionCategory 是目录 id；内部匹配统一用方向名
    const selectedCategoryName =
      query.positionCategory != null && query.positionCategory !== ""
        ? positionCategoryCatalog.find(
            (c) => String(c.id) === String(query.positionCategory),
          )?.name ?? ""
        : "";
    const commonWithCategory = { ...common, positionCategory: selectedCategoryName };
    return response({
      total: filtered(state, query).length,
      companyTotal: filtered(state, { ...common, companyId: "" }).length,
      positionCategoryTotal: filtered(state, {
        ...common,
        positionCategory: "",
      }).length,
      recruitTypeTotal: filtered(state, { ...common, recruitType: "" })
        .length,
      companies: state.companies.map((company) => ({
        ...company,
        count: filtered(state, {
          ...commonWithCategory,
          recruitType: String(query.recruitType ?? ""),
          companyId: company.id,
        }).length,
      })),
      positionCategories: positionCategoryCatalog
        .filter((c) => c.name !== "其他")
        .map((c) => ({
          value: String(c.id),
          label: c.name,
          count: filtered(state, {
            ...commonWithCategory,
            companyId: query.companyId as number | undefined,
            recruitType: String(query.recruitType ?? ""),
            positionCategory: c.name,
          }).length,
        }))
        .filter((c) => c.count > 0),
      recruitTypes: (["INTERN", "CAMPUS"] as const).map((value) => ({
        value,
        label: value === "INTERN" ? "实习" : "校招",
        count: filtered(state, {
          ...commonWithCategory,
          companyId: query.companyId as number | undefined,
          recruitType: value,
        }).length,
      })),
    });
  }
  const publicMatch = /^\/interviews\/(\d+)$/.exec(path);
  if (publicMatch) {
    const record = recordById(state, Number(publicMatch[1]));
    if (record.interview.status === "REMOVED")
      throw new ApiError(404, "INTERVIEW_REMOVED", "该面经已下架。");
    if (record.interview.status !== "PUBLISHED")
      throw new ApiError(404, "INTERVIEW_NOT_FOUND", "面经不存在。");
    return response(publicDetail(record));
  }
  if (path === "/me/interviews") {
    const user = requireUser();
    if (method === "POST") {
      const id = state.nextId++,
        time = now();
      const record: MockRecord = {
        interview: {
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
          createTime: time,
          updateTime: time,
          actions: {
            canEdit: true,
            canSubmit: true,
            canDeleteDraft: true,
            canRequestChange: false,
            canRequestDelete: false,
          },
        },
        author: {
          id: user.id,
          githubLogin: user.githubLogin,
          avatarUrl: user.avatarUrl,
        },
        candidates: [],
        submissionSnapshot: null,
        sources: [],
        originalPositionName: null,
        inferredPositionName: null,
        note: null,
      };
      state.records.unshift(record);
      return response(mutation(record), 201);
    }
    return response(
      page(
        state.records
          .filter(
            (record) =>
              record.author.id === user.id &&
              record.interview.status !== "REMOVED" &&
              (!query.status || record.interview.status === query.status),
          )
          .map((record) => {
            const data = record.interview,
              first = data.rounds.find((round) => round.interviewDate);
            return {
              id: data.id,
              company: data.company,
              position: data.position,
              department: data.department,
              recruitType: data.recruitType,
              status: data.status,
              version: data.version,
              rejectionReason: data.rejectionReason,
              firstInterviewDate: first?.interviewDate ?? null,
              firstInterviewDatePrecision:
                first?.interviewDatePrecision ?? null,
              roundCount: data.rounds.length,
              questionCount: data.rounds.reduce(
                (total, round) => total + round.questions.length,
                0,
              ),
              hasPendingChangeRequest: pendingRequest(state, data.id) !== null,
              createTime: data.createTime,
              updateTime: data.updateTime,
              actions: actions(record),
            };
          }),
        query,
      ),
    );
  }
  const myMatch =
    /^\/me\/interviews\/(\d+)(?:\/(submit|change-request))?$/.exec(path);
  if (myMatch) {
    const record = recordById(state, Number(myMatch[1]), true);
    if (myMatch[2] === "change-request") {
      checkStatus(record, ["PUBLISHED"]);
      if (method === "GET") {
        const data = published(record);
        const pending = pendingRequest(state, record.interview.id);
        return response({
          interview: {
            id: data.id,
            version: data.version,
            company: data.company,
            position: data.position,
            department: data.department,
            recruitType: data.recruitType,
            tags: data.tags,
            rounds: data.rounds,
            sourceUrl: record.interview.sourceUrl,
          },
          changeRequest: pending ? changeView(pending) : null,
        });
      }
      const request = body as SaveChangeRequestRequest;
      checkVersion(record, request.baseVersion);
      if (request.type === "UPDATE") {
        validatePayload(request.payload, true);
        // 与当前正式内容完全一致的 UPDATE 不进入审核队列（与后端同一规则）
        if (
          JSON.stringify(request.payload) ===
          JSON.stringify(interviewPayload(record.interview))
        )
          throw new ApiError(
            400,
            "VALIDATION_ERROR",
            "内容没有任何变化，无需提交修改申请。",
          );
      } else if (request.type !== "DELETE" || !request.reason?.trim())
        throw new ApiError(400, "VALIDATION_ERROR", "请填写删除原因。");
      let change = pendingRequest(state, record.interview.id);
      if (change) change.requestVersion++;
      if (!change) {
        change = {
          id: state.nextId++,
          requestVersion: 0,
          interviewId: record.interview.id,
          requester: authorView(requireUser()),
          type: request.type,
          status: "PENDING",
          baseVersion: request.baseVersion,
          payload: null,
          reason: null,
          createTime: now(),
          updateTime: now(),
        };
        state.changeRequests.push(change);
      }
      Object.assign(change, {
        type: request.type,
        baseVersion: request.baseVersion,
        payload:
          request.type === "UPDATE" ? structuredClone(request.payload) : null,
        reason: request.type === "DELETE" ? request.reason.trim() : null,
        updateTime: now(),
      });
      return response({
        ...changeView(change),
        interviewId: change.interviewId,
      });
    }
    if (myMatch[2] === "submit") {
      checkStatus(record, ["DRAFT"]);
      checkVersion(record, (body as { version: number }).version);
      validatePayload(interviewPayload(record.interview), true);
      record.submissionSnapshot = {
        id: state.nextId++,
        createTime: now(),
        content: interviewPayload(record.interview),
      };
      record.interview.status = "PENDING_REVIEW";
      advance(record);
      return response(mutation(record));
    }
    if (method === "GET")
      return response({ ...record.interview, actions: actions(record) });
    if (method === "DELETE") {
      if (!actions(record).canDeleteDraft)
        throw new ApiError(
          409,
          "INTERVIEW_STATUS_CONFLICT",
          "只有从未提交过审核的草稿可以删除。",
        );
      state.records = state.records.filter((item) => item !== record);
      return response({ id: record.interview.id, deleted: true });
    }
    checkStatus(record, ["DRAFT", "PENDING_REVIEW", "REJECTED"]);
    checkVersion(record, (body as InterviewUpsertRequest).version);
    const warnings = applyPayload(
      state,
      record,
      body as InterviewUpsertRequest,
    );
    if (record.interview.status === "REJECTED") {
      record.interview.status = "DRAFT";
      record.interview.rejectionReason = null;
    }
    advance(record);
    return response({ interview: canonical(record), warnings });
  }
  if (path === "/admin/reviews/interviews")
    return response(
      page(
        state.records
          .filter(
            (record) =>
              record.interview.status === (query.status ?? "PENDING_REVIEW"),
          )
          .map((record) => ({
            id: record.interview.id,
            company: record.interview.company,
            position: record.interview.position,
            author: record.author,
            status: record.interview.status,
            version: record.interview.version,
            candidateCount: record.candidates.length,
            submitTime: record.submissionSnapshot?.createTime ?? null,
            updateTime: record.interview.updateTime,
          })),
        query,
      ),
    );
  const reviewMatch =
    /^\/admin\/reviews\/interviews\/(\d+)(?:\/(publish|reject|candidates\/(\d+)\/resolve))?$/.exec(
      path,
    );
  if (reviewMatch) {
    const record = recordById(state, Number(reviewMatch[1]));
    if (method === "GET")
      return response({
        interview: {
          ...canonical(record),
          createTime: record.interview.createTime,
          rejectionReason: record.interview.rejectionReason,
        },
        author: record.author,
        candidates: record.candidates,
        submissionSnapshot: record.submissionSnapshot,
      });
    checkStatus(record, ["PENDING_REVIEW"]);
    checkVersion(record, (body as { version: number }).version);
    if (reviewMatch[2]?.startsWith("candidates")) {
      const candidateId = Number(reviewMatch[3]),
        candidate = record.candidates.find((item) => item.id === candidateId),
        request = body as ResolveCandidateRequest;
      if (!candidate)
        throw new ApiError(
          409,
          "CANDIDATE_ALREADY_RESOLVED",
          "该候选项已经被处理，请刷新。",
        );
      if (request.action === "REMOVE" && candidate.type !== "TAG")
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "公司和岗位不能移除，请选择正式目录项。",
        );
      const target =
        request.action === "REMOVE"
          ? null
          : selectCatalog(
              state,
              candidate.type,
              request.action === "USE_EXISTING"
                ? { existingId: request.targetId }
                : { proposedName: request.name },
              true,
            );
      if (candidate.type === "COMPANY") record.interview.company = target;
      else if (candidate.type === "POSITION")
        record.interview.position = target;
      else
        record.interview.tags = record.interview.tags.flatMap((tag) =>
          tag.source === "PROPOSED" && tag.name === candidate.value
            ? target
              ? [target]
              : []
            : [tag],
        );
      record.candidates = record.candidates.filter(
        (item) => item.id !== candidateId,
      );
      advance(record);
      const { id, status, version, updateTime } = mutation(record);
      return response({
        resolvedCandidateId: candidateId,
        interview: { id, status, version, updateTime },
      });
    }
    if (reviewMatch[2] === "publish") {
      if (record.candidates.length)
        throw new ApiError(
          409,
          "CANDIDATE_NOT_RESOLVED",
          "请先处理所有候选目录项。",
        );
      validatePayload(interviewPayload(record.interview), true);
      record.interview.status = "PUBLISHED";
      advance(record);
      return response(mutation(record));
    }
    if (reviewMatch[2] === "reject") {
      const reason = (body as { reason: string }).reason?.trim();
      if (!reason)
        throw new ApiError(400, "VALIDATION_ERROR", "请填写拒绝原因。");
      record.interview.status = "REJECTED";
      record.interview.rejectionReason = reason;
      advance(record);
      return response(mutation(record));
    }
    const warnings = applyPayload(
      state,
      record,
      body as InterviewUpsertRequest,
    );
    advance(record);
    return response({ interview: canonical(record), warnings });
  }
  const adminMatch = /^\/admin\/interviews\/(\d+)$/.exec(path);
  if (adminMatch) {
    const record = recordById(state, Number(adminMatch[1]));
    checkStatus(record, ["PUBLISHED"]);
    const pending = pendingRequest(state, record.interview.id);
    if (method === "GET")
      return response({
        interview: published(record),
        pendingChangeRequest: pending
          ? {
              id: pending.id,
              type: pending.type,
              baseVersion: pending.baseVersion,
              updateTime: pending.updateTime,
            }
          : null,
        actions: { canEditDirectly: !pending },
      });
    if (pending)
      throw new ApiError(
        409,
        "CHANGE_REQUEST_CONFLICT",
        "当前存在待处理申请，请先处理申请后再编辑。",
      );
    const request = body as AdminPublishedInterviewUpdateRequest;
    checkVersion(record, request.version);
    if (
      !Array.isArray(request.sourceUrls) ||
      request.sourceUrls.some((url) => !/^https?:\/\//i.test(url))
    )
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "来源必须是 HTTP 或 HTTPS 链接。",
      );
    const warnings = applyPayload(
      state,
      record,
      { ...request, sourceUrl: request.sourceUrls[0] ?? null },
      true,
      request.sourceUrls,
    );
    advance(record);
    return response({ interview: published(record), warnings });
  }
  if (path === "/admin/change-requests")
    return response(
      page(
        state.changeRequests
          .filter(
            (request) =>
              request.status === (query.status ?? "PENDING") &&
              (!query.type || request.type === query.type),
          )
          .map((request) => {
            const record = recordById(state, request.interviewId);
            return {
              id: request.id,
              requestVersion: request.requestVersion,
              type: request.type,
              status: request.status,
              baseVersion: request.baseVersion,
              interview: {
                id: record.interview.id,
                companyName: record.interview.company?.name ?? "",
                positionName: record.interview.position?.name ?? "",
                status: record.interview.status,
                version: record.interview.version,
              },
              requester: request.requester,
              reason: request.reason,
              createTime: request.createTime,
              updateTime: request.updateTime,
            };
          }),
        query,
      ),
    );
  const changeMatch =
    /^\/admin\/change-requests\/(\d+)(?:\/(approve|reject))?$/.exec(path);
  if (changeMatch) {
    const change = state.changeRequests.find(
      (request) => request.id === Number(changeMatch[1]),
    );
    if (!change)
      throw new ApiError(404, "CHANGE_REQUEST_NOT_FOUND", "变更申请不存在。");
    const record = recordById(state, change.interviewId);
    if (method === "GET")
      return response({
        changeRequest: changeView(change),
        currentInterview: published(record),
        requester: change.requester,
      });
    const expectedRequestVersion = (body as { expectedRequestVersion?: number } | null)?.expectedRequestVersion;
    if (!Number.isSafeInteger(expectedRequestVersion) || expectedRequestVersion! < 0)
      throw new ApiError(400, "VALIDATION_ERROR", "请求参数非法。");
    if (expectedRequestVersion !== change.requestVersion)
      throw new ApiError(409, "CHANGE_REQUEST_CONFLICT", "申请已更新，请重新核对。");
    if (change.status !== "PENDING")
      throw new ApiError(
        409,
        "CHANGE_REQUEST_CONFLICT",
        "该申请已经处理，请刷新。",
      );
    if (changeMatch[2] === "approve") {
      if (
        record.interview.version !== change.baseVersion ||
        record.interview.status !== "PUBLISHED"
      )
        throw new ApiError(
          409,
          "CHANGE_REQUEST_CONFLICT",
          "正式内容已发生变化，请重新核对申请。",
        );
      if (change.type === "UPDATE" && change.payload)
        applyPayload(state, record, change.payload, true);
      else record.interview.status = "REMOVED";
      advance(record);
      change.status = "APPROVED";
    } else change.status = "REJECTED";
    return response({
      changeRequest: {
        id: change.id,
        status: change.status,
        reviewTime: now(),
      },
      interview: {
        id: record.interview.id,
        status: record.interview.status,
        version: record.interview.version,
      },
    });
  }
  throw new ApiError(404, "INTERVIEW_NOT_FOUND", "请求的资源不存在。");
}
function delay(signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      },
      typeof window === "undefined" ? 1 : 120,
    );
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function mockRequest(
  path: string,
  query: object,
  body: unknown,
  init: RequestInit,
): Promise<Response> {
  await delay(init.signal);
  const execute = () => {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const state = readState();
    try {
      const result = dispatch(
        state,
        path,
        query as Record<string, unknown>,
        body,
        init.method ?? "GET",
      );
      if (init.method !== "GET") writeState(state);
      return result;
    } catch (error) {
      if (error instanceof ApiError)
        return new Response(
          JSON.stringify({
            code: error.code,
            message: error.message,
            data: null,
          }),
          {
            status: error.httpStatus,
            headers: { "Content-Type": "application/json" },
          },
        );
      throw error;
    }
  };
  // 各标签页共享数据；短锁保证版本检查与写入作为一个演示事务完成。
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(
      STATE_KEY,
      { signal: init.signal ?? undefined },
      execute,
    );
  return execute();
}

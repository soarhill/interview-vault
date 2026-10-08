import assert from "node:assert/strict";
import { test } from "node:test";
import { queryString, request } from "../src/lib/api/client";
import { ApiError } from "../src/lib/api/errors";
import { getCurrentUser, logout, setMockRole } from "../src/lib/api/auth";
import {
  createInterview,
  deleteDraft,
  getInterviewDetail,
  getMyInterview,
  listInterviewFilters,
  listInterviews,
  saveChangeRequest,
  saveInterview,
  submitInterview,
} from "../src/lib/api/interviews";
import {
  approveChangeRequest,
  getAdminInterview,
  getReviewDetail,
  publishInterview,
  rejectChangeRequest,
  rejectInterview,
  resolveCandidate,
  saveAdminInterview,
} from "../src/lib/api/reviews";
import { resetMockState, selectMockRole } from "../src/lib/api/mock";
import { interviewPayload } from "../src/lib/api/mock-data";
import type { InterviewChangePayload } from "../src/lib/api/types";

const originalMode = process.env.NEXT_PUBLIC_API_MOCK;
process.env.NEXT_PUBLIC_API_MOCK = "true";
test.beforeEach(() => {
  process.env.NEXT_PUBLIC_API_MOCK = "true";
  resetMockState();
  selectMockRole(null);
});
test.after(() => {
  if (originalMode === undefined) delete process.env.NEXT_PUBLIC_API_MOCK;
  else process.env.NEXT_PUBLIC_API_MOCK = originalMode;
});
const hasError = (status: number, code: string) => (error: unknown) =>
  error instanceof ApiError &&
  error.httpStatus === status &&
  error.code === code;
const completePayload = (): InterviewChangePayload => ({
  company: { existingId: 1 },
  position: { existingId: 14 },
  department: "平台研发",
  recruitType: "CAMPUS",
  tagIds: [3],
  proposedTags: [],
  rounds: [
    {
      id: null,
      roundType: "TECHNICAL",
      roundNo: 1,
      interviewDate: "2026-10-06",
      questions: [
        {
          id: null,
          content: "如何设计可靠的任务调度器？",
          followUps: [{ id: null, content: "失败后怎么重试？" }],
        },
      ],
    },
  ],
  sourceUrl: "https://example.com/new-interview",
});

test("query serialization preserves literal text and omits absent values", () => {
  assert.equal(
    queryString({
      companyId: 1,
      q: "Redis & Lua",
      page: 2,
      recruitType: "CAMPUS",
      empty: "",
      absent: undefined,
    }),
    "companyId=1&q=Redis+%26+Lua&page=2&recruitType=CAMPUS",
  );
});
test("mock permissions preserve anonymous, USER, ADMIN and ownership semantics", async () => {
  await assert.rejects(getCurrentUser(), hasError(401, "AUTH_REQUIRED"));
  assert.ok((await listInterviews()).items.length > 0);
  await setMockRole("USER");
  assert.equal((await getCurrentUser()).role, "USER");
  await assert.rejects(getReviewDetail(1002), hasError(403, "ACCESS_DENIED"));
  await assert.rejects(
    getMyInterview(123),
    hasError(403, "INTERVIEW_NOT_OWNER"),
  );
  await logout();
  await assert.rejects(getMyInterview(1001), hasError(401, "AUTH_REQUIRED"));
});
test("public responses use new contract, stable follow-up IDs and faceted counts", async () => {
  const list = await listInterviews({ q: "Memory", size: 2 });
  assert.equal(list.items.length, 2);
  const match = list.items[0].matches?.find((item) => item.kind === "FOLLOW_UP");
  assert.ok(match?.followUpId);
  const detail = await getInterviewDetail(list.items[0].id);
  assert.ok(
    detail.rounds
      .flatMap((round) => round.questions)
      .some((question) =>
        question.followUps.some((follow) => follow.id === match.followUpId),
      ),
  );
  assert.equal(detail.firstInterviewDatePrecision, "MONTH");
  assert.equal(
    (await listInterviews({ q: "腾讯" })).items[0].matches?.[0].kind,
    "META",
  );
  const before = await listInterviewFilters({ positionCategory: "BACKEND" });
  const after = await listInterviewFilters({
    companyId: 1,
    positionCategory: "BACKEND",
  });
  assert.deepEqual(before.companies, after.companies);
  assert.equal((await listInterviews({ q: "constructor __proto__" })).total, 0);
});
test("canonical IDs, submission versions, rejection edits and immutable audit snapshots", async () => {
  await setMockRole("USER");
  const draft = await createInterview();
  await assert.rejects(
    submitInterview(draft.id, draft.version),
    hasError(400, "INTERVIEW_INCOMPLETE"),
  );
  const saved = await saveInterview(draft.id, {
    ...completePayload(),
    version: draft.version,
  });
  assert.equal(saved.interview.version, 1);
  assert.ok(saved.interview.rounds[0].questions[0].followUps[0].id > 0);
  const stale = { ...completePayload(), version: 0 },
    inputBefore = structuredClone(stale);
  await assert.rejects(
    saveInterview(draft.id, stale),
    hasError(409, "INTERVIEW_VERSION_CONFLICT"),
  );
  assert.deepEqual(stale, inputBefore);
  const submitted = await submitInterview(draft.id, saved.interview.version);
  assert.equal(submitted.status, "PENDING_REVIEW");
  await setMockRole("ADMIN");
  const originalSnapshot = (await getReviewDetail(draft.id)).submissionSnapshot;
  await rejectInterview(draft.id, submitted.version, "请补充具体追问");
  await setMockRole("USER");
  const rejected = await getMyInterview(draft.id);
  assert.equal(
    (
      await saveInterview(draft.id, {
        ...interviewPayload(rejected),
        version: rejected.version,
      })
    ).interview.status,
    "DRAFT",
  );
  assert.equal((await getMyInterview(draft.id)).rejectionReason, null);
  assert.equal((await getMyInterview(draft.id)).actions.canDeleteDraft, false);
  await assert.rejects(
    deleteDraft(draft.id),
    hasError(409, "INTERVIEW_STATUS_CONFLICT"),
  );
  await setMockRole("ADMIN");
  assert.deepEqual(
    (await getReviewDetail(draft.id)).submissionSnapshot,
    originalSnapshot,
  );
});
test("candidate resolve returns the next version used by later resolve and publish", async () => {
  await setMockRole("ADMIN");
  const detail = await getReviewDetail(1002);
  const first = await resolveCandidate(1002, detail.candidates[0].id, {
    version: detail.interview.version,
    action: "CREATE_NEW",
    name: "Agent Infra Engineer",
  });
  assert.equal(first.interview.version, detail.interview.version + 1);
  await assert.rejects(
    resolveCandidate(1002, detail.candidates[1].id, {
      version: detail.interview.version,
      action: "REMOVE",
    }),
    hasError(409, "INTERVIEW_VERSION_CONFLICT"),
  );
  const second = await resolveCandidate(1002, detail.candidates[1].id, {
    version: first.interview.version,
    action: "REMOVE",
  });
  const published = await publishInterview(1002, second.interview.version);
  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.version, detail.interview.version + 3);
  assert.equal((await getReviewDetail(1002)).candidates.length, 0);
});
test("two concurrent editors with one version produce one save and one conflict", async () => {
  await setMockRole("USER");
  const baseline = await getMyInterview(1001);
  const results = await Promise.allSettled([
    saveInterview(1001, { ...completePayload(), version: baseline.version }),
    saveInterview(1001, {
      ...completePayload(),
      department: "第二个编辑器",
      version: baseline.version,
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failure = results.find((result) => result.status === "rejected");
  assert.ok(
    failure?.status === "rejected" &&
      hasError(409, "INTERVIEW_VERSION_CONFLICT")(failure.reason),
  );
});
test("mock data persists across tabs while their demonstration identities stay separate", async () => {
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
  function storage() {
    const entries = new Map<string, string>();
    return {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    };
  }
  const shared = storage();
  const authorTab = { localStorage: shared, sessionStorage: storage() };
  const reviewTab = { localStorage: shared, sessionStorage: storage() };
  const activate = (tab: typeof authorTab) =>
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: tab,
    });
  try {
    activate(authorTab);
    resetMockState();
    await setMockRole("USER");
    const authorBaseline = await getMyInterview(1002);
    activate(reviewTab);
    await setMockRole("ADMIN");
    assert.equal(
      (await getReviewDetail(1002)).interview.version,
      authorBaseline.version,
    );
    await rejectInterview(1002, authorBaseline.version, "请补充来源");
    activate(authorTab);
    assert.equal((await getCurrentUser()).role, "USER");
    assert.equal((await getMyInterview(1002)).status, "REJECTED");
    await assert.rejects(
      saveInterview(1002, {
        ...interviewPayload(authorBaseline),
        version: authorBaseline.version,
      }),
      hasError(409, "INTERVIEW_VERSION_CONFLICT"),
    );
  } finally {
    if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("change request overwrite keeps identity, blocks direct edits and distinguishes REMOVED", async () => {
  await setMockRole("USER");
  const baseline = await getMyInterview(1004);
  const update = await saveChangeRequest(1004, {
    type: "UPDATE",
    baseVersion: baseline.version,
    // 带真实修改：与当前内容完全一致的空跑申请会被 400 拒绝
    payload: { ...interviewPayload(baseline), department: "变更申请测试部门" },
  });
  const deletion = await saveChangeRequest(1004, {
    type: "DELETE",
    baseVersion: baseline.version,
    reason: "不再希望公开",
  });
  assert.equal(deletion.id, update.id);
  assert.equal(deletion.payload, null);
  assert.equal((await getInterviewDetail(1004)).id, 1004);
  await setMockRole("ADMIN");
  assert.equal((await getAdminInterview(1004)).actions.canEditDirectly, false);
  await assert.rejects(
    saveAdminInterview(1004, {
      ...interviewPayload(baseline),
      version: baseline.version,
      sourceUrls: [baseline.sourceUrl!],
    }),
    hasError(409, "CHANGE_REQUEST_CONFLICT"),
  );
  assert.equal(
    (await approveChangeRequest(deletion.id, deletion.requestVersion)).interview.status,
    "REMOVED",
  );
  await assert.rejects(
    getInterviewDetail(1004),
    hasError(404, "INTERVIEW_REMOVED"),
  );
  await assert.rejects(
    getInterviewDetail(999999),
    hasError(404, "INTERVIEW_NOT_FOUND"),
  );
  await assert.rejects(
    approveChangeRequest(deletion.id, deletion.requestVersion),
    hasError(409, "CHANGE_REQUEST_CONFLICT"),
  );
});
test("UPDATE approval resolves new catalogs; rejection preserves the published version", async () => {
  await setMockRole("USER");
  const baseline = await getMyInterview(1004),
    payload = interviewPayload(baseline);
  const proposed = await saveChangeRequest(1004, {
    type: "UPDATE",
    baseVersion: baseline.version,
    payload: {
      ...payload,
      position: { proposedName: "New Applied AI Role" },
      proposedTags: ["New Tag"],
    },
  });
  await setMockRole("ADMIN");
  const approved = await approveChangeRequest(proposed.id, proposed.requestVersion);
  assert.equal(approved.interview.version, baseline.version + 1);
  assert.equal(
    (await getInterviewDetail(1004)).position.name,
    "New Applied AI Role",
  );
  await setMockRole("USER");
  const deletion = await saveChangeRequest(1004, {
    type: "DELETE",
    baseVersion: approved.interview.version,
    reason: "测试拒绝",
  });
  await setMockRole("ADMIN");
  const rejected = await rejectChangeRequest(deletion.id, deletion.requestVersion);
  assert.equal(rejected.interview.version, approved.interview.version);
  assert.equal(rejected.interview.status, "PUBLISHED");
});
test("published edits preserve historical fields, algorithms, precision, sources and child IDs", async () => {
  await setMockRole("ADMIN");
  const { interview } = await getAdminInterview(123),
    before = structuredClone(interview);
  const saved = await saveAdminInterview(123, {
    version: interview.version,
    company: { existingId: interview.company.id },
    position: { existingId: interview.position.id },
    department: "更新部门",
    recruitType: interview.recruitType,
    tagIds: interview.tags.map((tag) => tag.id),
    proposedTags: [],
    rounds: interview.rounds,
    sourceUrls: interview.sources.map((source) => source.url),
  });
  assert.equal(saved.interview.version, interview.version + 1);
  assert.deepEqual(saved.interview.rounds, before.rounds);
  assert.deepEqual(saved.interview.sources, before.sources);
  assert.equal(
    saved.interview.originalPositionName,
    before.originalPositionName,
  );
  assert.equal(saved.interview.note, before.note);
  assert.equal(saved.interview.rounds[0].interviewDatePrecision, "MONTH");
  assert.equal(saved.interview.rounds[0].questions[1].leetcodeNumber, 104);
});
test("real transport unwraps Result, includes credentials and reads the CSRF cookie", async () => {
  process.env.NEXT_PUBLIC_API_MOCK = "false";
  const fetchBefore = globalThis.fetch,
    baseBefore = process.env.NEXT_PUBLIC_API_BASE_URL,
    documentBefore = Object.getOwnPropertyDescriptor(globalThis, "document");
  const calls: { url: string; init: RequestInit | undefined }[] = [],
    fakeDocument = { cookie: "" };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://backend.example/";
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/auth/csrf")) {
        fakeDocument.cookie = "XSRF-TOKEN=token%2Bvalue";
        return new Response(
          JSON.stringify({ code: "SUCCESS", message: "success", data: null }),
        );
      }
      return new Response(
        JSON.stringify({
          code: "SUCCESS",
          message: "success",
          data: { id: 42 },
        }),
      );
    };
    assert.deepEqual(
      await request<{ id: number }>("/me/interviews", { method: "POST" }),
      { id: 42 },
    );
    assert.equal(calls[0].url, "https://backend.example/api/v1/auth/csrf");
    assert.equal(calls[1].init?.credentials, "include");
    assert.equal(
      new Headers(calls[1].init?.headers).get("X-XSRF-TOKEN"),
      "token+value",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "INTERVIEW_VERSION_CONFLICT",
          message: "请刷新",
          data: null,
        }),
        { status: 409 },
      );
    await assert.rejects(
      getInterviewDetail(42),
      hasError(409, "INTERVIEW_VERSION_CONFLICT"),
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "private database stack trace",
          data: null,
        }),
        { status: 500 },
      );
    await assert.rejects(
      getInterviewDetail(42),
      (error: unknown) =>
        error instanceof ApiError && !error.message.includes("private"),
    );
    globalThis.fetch = async () =>
      new Response("<html>upstream failure</html>", { status: 502 });
    await assert.rejects(getInterviewDetail(42), hasError(502, "HTTP_ERROR"));
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 42 }));
    await assert.rejects(
      getInterviewDetail(42),
      hasError(200, "INVALID_RESPONSE"),
    );
  } finally {
    globalThis.fetch = fetchBefore;
    if (baseBefore === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = baseBefore;
    if (documentBefore)
      Object.defineProperty(globalThis, "document", documentBefore);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
test("cancellation and timeouts remain distinct from network errors", async () => {
  const controller = new AbortController(),
    pending = listInterviews({}, controller.signal);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof Error && error.name === "AbortError",
  );
  process.env.NEXT_PUBLIC_API_MOCK = "false";
  const fetchBefore = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    await assert.rejects(
      request("/interviews", { timeoutMs: 5 }),
      hasError(0, "TIMEOUT"),
    );
    const failure = new TypeError("offline");
    globalThis.fetch = async () => {
      throw failure;
    };
    await assert.rejects(
      listInterviews(),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === "NETWORK_ERROR" &&
        error.cause === failure,
    );
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
test("production rejects an enabled mock configuration before issuing requests", async () => {
  const environment: Record<string, string | undefined> = process.env;
  const originalEnvironment = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    await assert.rejects(
      listInterviews(),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("生产构建禁止启用 Mock"),
    );
  } finally {
    if (originalEnvironment === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = originalEnvironment;
  }
});

test("stale request revisions cannot approve or reject an overwritten application", async () => {
  await setMockRole("USER");
  const baseline = await getMyInterview(1004);
  const original = await saveChangeRequest(1004, {
    type: "UPDATE", baseVersion: baseline.version,
    payload: { ...interviewPayload(baseline), department: "First request" },
  });
  const updated = await saveChangeRequest(1004, {
    type: "UPDATE", baseVersion: baseline.version,
    payload: { ...interviewPayload(baseline), department: "Latest request" },
  });
  assert.equal(updated.id, original.id);
  assert.equal(updated.requestVersion, original.requestVersion + 1);
  await setMockRole("ADMIN");
  await assert.rejects(approveChangeRequest(original.id, original.requestVersion), hasError(409, "CHANGE_REQUEST_CONFLICT"));
  await assert.rejects(rejectChangeRequest(original.id, original.requestVersion), hasError(409, "CHANGE_REQUEST_CONFLICT"));
  assert.notEqual((await getInterviewDetail(1004)).department, "Latest request");
  await approveChangeRequest(updated.id, updated.requestVersion);
  assert.equal((await getInterviewDetail(1004)).department, "Latest request");
});

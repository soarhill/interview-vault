import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api/errors";
import {
  candidateResolved,
  publishedUpdateRequest,
  reviewConflict,
} from "../src/components/review/review-state";
import type {
  AdminReviewResponse,
  InterviewChangePayload,
} from "../src/lib/api/types";

const payload: InterviewChangePayload = {
  company: { existingId: 1 },
  position: { existingId: 12 },
  department: "研发",
  recruitType: "CAMPUS",
  tagIds: [3],
  proposedTags: [],
  sourceUrl: "https://example.com/only-user-source",
  rounds: [
    {
      id: 201,
      roundType: "TECHNICAL",
      roundNo: 1,
      interviewDate: "2026-01-01",
      questions: [
        {
          id: 3001,
          content: "实现一个 LRU",
          referenceUrl: "https://leetcode.com/problems/lru-cache/",
          followUps: [{ id: 4001, content: "线程安全怎么做？" }],
        },
      ],
    },
  ],
};

test("候选处理沿用响应version，保持快照不变且只移除已处理候选", () => {
  const detail: AdminReviewResponse = {
    interview: {
      id: 1001,
      status: "PENDING_REVIEW",
      version: 7,
      company: null,
      position: null,
      department: null,
      recruitType: "CAMPUS",
      tags: [],
      rounds: [],
      sourceUrl: null,
      createTime: "2026-10-01T10:00:00+08:00",
      updateTime: "2026-10-05T10:00:00+08:00",
    },
    author: { id: 100, githubLogin: "contributor", avatarUrl: null },
    candidates: [
      { id: 901, type: "TAG", value: "JUC", suggestedMatches: [] },
      { id: 902, type: "COMPANY", value: "OpenAI", suggestedMatches: [] },
    ],
    submissionSnapshot: {
      id: 7001,
      createTime: "2026-10-05T10:00:00+08:00",
      content: payload,
    },
  };
  const result = candidateResolved(detail, {
    resolvedCandidateId: 901,
    interview: {
      id: 1001,
      status: "PENDING_REVIEW",
      version: 24,
      updateTime: "2026-10-06T10:00:00+08:00",
    },
  });
  assert.equal(result.interview.version, 24);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    [902],
  );
  assert.equal(result.submissionSnapshot, detail.submissionSnapshot);
  assert.equal(detail.interview.version, 7);
  assert.equal(detail.candidates.length, 2);
});

test("已发布更新使用完整sourceUrls并保留稳定ID与题目链接", () => {
  const urls = ["https://example.com/first", "https://example.com/second"];
  const request = publishedUpdateRequest(payload, 15, urls);
  assert.equal("sourceUrl" in request, false);
  assert.deepEqual(request.sourceUrls, urls);
  assert.notEqual(request.sourceUrls, urls);
  assert.equal(request.version, 15);
  assert.deepEqual(request.rounds, payload.rounds);
  assert.equal(
    request.rounds[0].questions[0].referenceUrl,
    "https://leetcode.com/problems/lru-cache/",
  );
  assert.equal(request.rounds[0].questions[0].followUps[0].id, 4001);
});

test("审核区分已处理、版本冲突、待变更冲突，其他409也停止操作", () => {
  assert.equal(
    reviewConflict(new ApiError(409, "INTERVIEW_VERSION_CONFLICT", "changed")),
    "version",
  );
  assert.equal(
    reviewConflict(new ApiError(409, "CANDIDATE_ALREADY_RESOLVED", "done")),
    "handled",
  );
  assert.equal(
    reviewConflict(new ApiError(409, "INTERVIEW_STATUS_CONFLICT", "done")),
    "handled",
  );
  assert.equal(
    reviewConflict(new ApiError(409, "CHANGE_REQUEST_CONFLICT", "pending")),
    "change-request",
  );
  assert.equal(
    reviewConflict(new ApiError(409, "CANDIDATE_NOT_RESOLVED", "pending")),
    "other",
  );
  assert.equal(
    reviewConflict(new ApiError(403, "ACCESS_DENIED", "denied")),
    null,
  );
  assert.equal(reviewConflict(new Error("network")), null);
});

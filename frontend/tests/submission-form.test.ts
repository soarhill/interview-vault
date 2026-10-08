import test from "node:test";
import assert from "node:assert/strict";
import {
  editorPayload,
  editorValueFromPayload,
  emptyInterviewPayload,
  moveItem,
  payloadFromInterview,
  validateInterview,
} from "../src/components/submission/form-model";
import type { EditableInterview } from "../src/lib/api/types";

const historical: EditableInterview = {
  id: 1001,
  status: "PENDING_REVIEW",
  version: 9,
  updateTime: "2026-10-06T10:00:00+08:00",
  company: { id: 1, name: "字节跳动", source: "OFFICIAL" },
  position: {
    id: null,
    name: "Agent Infra Engineer",
    source: "PROPOSED",
    category: null,
  },
  department: "抖音电商",
  recruitType: "CAMPUS",
  tags: [
    { id: 3, name: "Redis", source: "OFFICIAL" },
    { id: null, name: "Agent Memory", source: "PROPOSED" },
  ],
  sourceUrl: "https://example.com/interview",
  rounds: [
    {
      id: 201,
      displayName: "一面",
      roundType: "TECHNICAL",
      roundNo: 1,
      remark: "现场编程",
      interviewDate: "2025-06-01",
      interviewDatePrecision: "MONTH",
      questions: [
        {
          id: 3001,
          content: "最长回文子串",
          referenceUrl:
            "https://leetcode.com/problems/longest-palindromic-substring/",
          questionType: "ALGORITHM",
          sectionLabel: "算法",
          contextNote: "需要说明复杂度",
          algorithmTitle: "Longest Palindromic Substring",
          algorithmDescription: "给定字符串 s，找出最长回文子串",
          algorithmRequirements: "解释时间复杂度",
          leetcodeNumber: 5,
          leetcodeUrl:
            "https://leetcode.com/problems/longest-palindromic-substring/",
          followUps: [{ id: 4001, content: "如何优化空间？" }],
        },
      ],
    },
  ],
};

test("draft accepts incomplete content while submit guides all required fields", () => {
  const payload = editorPayload(
    editorValueFromPayload(emptyInterviewPayload()),
  );
  assert.deepEqual(validateInterview(payload, "draft"), []);
  const issues = validateInterview(payload, "submit");
  for (const field of [
    "company",
    "position",
    "recruitType",
    "rounds.0.questions.0",
  ])
    assert.ok(issues.some((issue) => issue.field === field));
});
test("editing ordinary fields preserves stable IDs and keeps the write payload minimal", () => {
  const original = payloadFromInterview(historical);
  const editor = editorValueFromPayload(original);
  editor.department = "调整后的部门";
  const output = editorPayload(editor);
  assert.deepEqual(output.rounds, original.rounds);
  assert.equal(output.rounds[0].interviewDate, "2025-06-01");
  assert.equal(
    output.rounds[0].questions[0].referenceUrl,
    "https://leetcode.com/problems/longest-palindromic-substring/",
  );
  assert.equal(output.rounds[0].questions[0].followUps[0].id, 4001);
  // 写入合同不再携带历史整理字段：精度 / 分组 / 算法结构化信息由后端保留
  const serialized = JSON.stringify(output);
  assert.ok(!serialized.includes("clientKey"));
  assert.ok(!serialized.includes("displayName"));
  assert.ok(!serialized.includes("interviewDatePrecision"));
  assert.ok(!serialized.includes("sectionLabel"));
  assert.ok(!serialized.includes("algorithm"));
  assert.ok(!serialized.includes("leetcodeNumber"));
});
test("canonical save assigns database IDs without replacing new input identity", () => {
  const original = editorValueFromPayload(emptyInterviewPayload());
  original.rounds[0].questions[0].followUps = [
    { id: null, content: "新增追问", clientKey: crypto.randomUUID() },
  ];
  const canonical = editorPayload(original);
  canonical.rounds[0].id = 202;
  canonical.rounds[0].questions[0].id = 3002;
  canonical.rounds[0].questions[0].followUps[0].id = 4002;
  const saved = editorValueFromPayload(canonical, original);
  assert.equal(saved.rounds[0].clientKey, original.rounds[0].clientKey);
  assert.equal(
    saved.rounds[0].questions[0].clientKey,
    original.rounds[0].questions[0].clientKey,
  );
  assert.equal(
    saved.rounds[0].questions[0].followUps[0].clientKey,
    original.rounds[0].questions[0].followUps[0].clientKey,
  );
  assert.equal(editorPayload(saved).rounds[0].questions[0].id, 3002);
});
test("reordering retains database and local identities", () => {
  const first = editorValueFromPayload(payloadFromInterview(historical))
    .rounds[0];
  const second = editorValueFromPayload(emptyInterviewPayload()).rounds[0];
  const moved = moveItem([first, second], 0, 1);
  assert.equal(moved[1].id, 201);
  assert.equal(moved[1].clientKey, first.clientKey);
  assert.equal(moved[1].questions[0].id, 3001);
});
test("server reorder, deletion and insertion never share React keys across entity identities", () => {
  const payload = payloadFromInterview(historical);
  const templateRound = payload.rounds[0];
  const templateQuestion = templateRound.questions[0];
  payload.rounds = [
    templateRound,
    {
      ...templateRound,
      id: 202,
      roundNo: 2,
      questions: [
        { ...templateQuestion, id: 3002 },
        {
          ...templateQuestion,
          id: 3003,
          followUps: [
            { id: 4002, content: "旧追问 A" },
            { id: 4003, content: "保留的追问 B" },
          ],
        },
      ],
    },
  ];
  const previous = editorValueFromPayload(payload);
  const oldRound = previous.rounds[1];
  const oldQuestion = oldRound.questions[1];
  const canonical = {
    ...payload,
    rounds: [
      {
        ...payload.rounds[1],
        questions: [
          {
            ...payload.rounds[1].questions[1],
            followUps: [
              { id: 4003, content: "保留的追问 B" },
              { id: 4004, content: "服务器新增追问" },
            ],
          },
          { ...templateQuestion, id: 3004, followUps: [] },
        ],
      },
      {
        ...templateRound,
        id: 203,
        roundNo: 3,
        questions: [{ ...templateQuestion, id: 3005, followUps: [] }],
      },
    ],
  };
  const refreshed = editorValueFromPayload(canonical, previous);
  assert.equal(refreshed.rounds[0].clientKey, oldRound.clientKey);
  assert.equal(
    refreshed.rounds[0].questions[0].clientKey,
    oldQuestion.clientKey,
  );
  assert.equal(
    refreshed.rounds[0].questions[0].followUps[0].clientKey,
    oldQuestion.followUps[1].clientKey,
  );
  assert.notEqual(refreshed.rounds[1].clientKey, oldRound.clientKey);
  assert.notEqual(
    refreshed.rounds[0].questions[1].clientKey,
    oldQuestion.clientKey,
  );
  assert.notEqual(
    refreshed.rounds[0].questions[0].followUps[1].clientKey,
    oldQuestion.followUps[1].clientKey,
  );
  const keys = refreshed.rounds.flatMap((round) => [
    round.clientKey,
    ...round.questions.flatMap((question) => [
      question.clientKey,
      ...question.followUps.map((followUp) => followUp.clientKey),
    ]),
  ]);
  assert.equal(new Set(keys).size, keys.length);
});
test("format errors are shown before draft save without mutating user input", () => {
  const payload = payloadFromInterview(historical);
  payload.sourceUrl = "javascript:alert(1)";
  payload.proposedTags = ["Redis", "redis"];
  const before = JSON.stringify(payload);
  const errors = validateInterview(payload, "draft");
  assert.ok(errors.some((issue) => issue.field === "sourceUrl"));
  assert.ok(errors.some((issue) => issue.field === "tags"));
  assert.equal(JSON.stringify(payload), before);
});
test("question link is validated as an HTTP URL before save", () => {
  const payload = payloadFromInterview(historical);
  payload.rounds[0].questions[0].referenceUrl = "ftp://example.com/p/1";
  assert.ok(
    validateInterview(payload, "draft").some(
      (issue) => issue.field === "rounds.0.questions.0",
    ),
  );
  payload.rounds[0].questions[0].referenceUrl =
    "https://leetcode.cn/problems/two-sum/";
  assert.deepEqual(
    validateInterview(payload, "draft").filter(
      (issue) => issue.field === "rounds.0.questions.0",
    ),
    [],
  );
});
test("UNKNOWN round and edited date round-trip through the editor without precision fields", () => {
  const payload = payloadFromInterview(historical);
  payload.rounds[0].roundType = "UNKNOWN";
  payload.rounds[0].roundNo = null;
  payload.rounds[0].interviewDate = "2024-05-06";
  assert.deepEqual(editorPayload(editorValueFromPayload(payload)), payload);
});
test("clearing the date picker submits null and blank links are trimmed away", () => {
  const value = editorValueFromPayload(payloadFromInterview(historical));
  value.rounds[0].interviewDate = null;
  value.rounds[0].questions[0].referenceUrl = "   ";
  const payload = editorPayload(value);
  assert.equal(payload.rounds[0].interviewDate, null);
  assert.equal(payload.rounds[0].questions[0].referenceUrl, null);
});
test("published editing preserves an existing empty HR round without weakening user submit", () => {
  const payload = payloadFromInterview(historical);
  payload.rounds.push({
    id: 202,
    roundType: "HR",
    roundNo: null,
    interviewDate: null,
    questions: [],
  });
  assert.deepEqual(validateInterview(payload, "published"), []);
  assert.ok(
    validateInterview(payload, "submit").some(
      (issue) => issue.field === "rounds.1",
    ),
  );
  payload.rounds[1].id = null;
  assert.ok(
    validateInterview(payload, "published").some(
      (issue) => issue.field === "rounds.1",
    ),
  );
});
test("published editing still requires real question content and one question in the aggregate", () => {
  const payload = payloadFromInterview(historical);
  payload.rounds[0].questions[0].followUps[0].content = " ";
  assert.ok(
    validateInterview(payload, "published").some((issue) =>
      issue.field.endsWith("followUps.0"),
    ),
  );
  payload.rounds[0].questions[0].content = " ";
  assert.ok(
    validateInterview(payload, "published").some(
      (issue) => issue.field === "rounds.0.questions.0",
    ),
  );
  payload.rounds[0].questions = [];
  assert.ok(
    validateInterview(payload, "published").some(
      (issue) => issue.field === "rounds",
    ),
  );
  assert.deepEqual(validateInterview(payload, "draft"), []);
});

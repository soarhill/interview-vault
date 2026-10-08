import test from "node:test";
import assert from "node:assert/strict";
import { changeRequestDiff } from "../src/components/review/change-request-diff";
import type { InterviewChangePayload } from "../src/lib/api/types";

const catalog = {
  companies: [{ id: 1, name: "测试公司" }],
  positions: [{ id: 12, name: "后端开发", category: "BACKEND" as const }],
  tags: [
    { id: 3, name: "Agent" },
    { id: 7, name: "场景设计" },
  ],
};
const original: InterviewChangePayload = {
  company: { existingId: 1 },
  position: { existingId: 12 },
  department: "研发",
  recruitType: "INTERN",
  tagIds: [3, 7],
  proposedTags: [],
  sourceUrl: null,
  rounds: [
    {
      id: 201,
      roundType: "TECHNICAL",
      roundNo: 1,
      interviewDate: "2026-10-06",
      questions: [
        { id: 301, content: "设计一个缓存", referenceUrl: null, followUps: [] },
        {
          id: 302,
          content: "原问题",
          referenceUrl: null,
          followUps: [{ id: 401, content: "原追问" }],
        },
      ],
    },
  ],
};

test("同轮多个问题修改分别计数，差异只定位到对应问题", () => {
  const current = structuredClone(original);
  current.rounds[0].questions[0].content = "新问题一";
  current.rounds[0].questions[1].content = "新问题二";
  const changes = changeRequestDiff(original, current, catalog);
  assert.equal(changes.length, 2);
  assert.deepEqual(
    changes.map((change) => change.currentPath),
    ["rounds.0.questions.0.content", "rounds.0.questions.1.content"],
  );
  assert.equal(changes[1].before, "原问题");
  assert.equal(changes[1].after, "新问题二");
  assert.equal(original.rounds[0].questions[1].content, "原问题");
});

test("问题前插新内容不会误报后续稳定 ID 的问题被修改", () => {
  const current = structuredClone(original);
  current.rounds[0].questions.unshift({
    id: null,
    content: "新增问题",
    followUps: [],
  });
  const changes = changeRequestDiff(original, current, catalog);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].originalPath, undefined);
  assert.equal(changes[0].currentPath, "rounds.0.questions.0");
  assert.equal(changes[0].after, "新增问题");
});

test("删除问题和追问保留原侧定位，其他问题不受数组位移影响", () => {
  const current = structuredClone(original);
  current.rounds[0].questions.shift();
  current.rounds[0].questions[0].followUps = [];
  const changes = changeRequestDiff(original, current, catalog);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].originalPath, "rounds.0.questions.0");
  assert.equal(changes[0].currentPath, undefined);
  assert.equal(changes[1].originalPath, "rounds.0.questions.1.followUps.0");
  assert.equal(changes[1].currentPath, undefined);
});

test("调整问题顺序与追问正文分别标记，不把整轮当作内容变化", () => {
  const current = structuredClone(original);
  current.rounds[0].questions.reverse();
  current.rounds[0].questions[0].followUps[0].content = "新追问";
  const changes = changeRequestDiff(original, current, catalog);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].currentPath, "rounds.0.questions.order");
  assert.equal(changes[1].currentPath, "rounds.0.questions.0.followUps.0");
});

test("轮次类型、日期和题目链接变化可见，标签集合换序不产生假差异", () => {
  const current = structuredClone(original);
  current.tagIds.reverse();
  current.rounds[0].roundType = "HR";
  current.rounds[0].interviewDate = "2026-10-07";
  current.rounds[0].questions[1].referenceUrl = "https://example.com/problem";
  const changes = changeRequestDiff(original, current, catalog);
  assert.equal(changes.length, 3);
  assert.deepEqual(
    changes.map((change) => change.currentPath),
    ["rounds.0.title", "rounds.0.date", "rounds.0.questions.1.link"],
  );
});

test("未改内容为零差异；整轮新增或删除只记一次，来源差异包含完整公开来源", () => {
  assert.equal(
    changeRequestDiff(original, structuredClone(original), catalog).length,
    0,
  );
  const current = structuredClone(original);
  current.rounds = [];
  const changes = changeRequestDiff(original, current, catalog, [
    "https://example.com/old",
  ]);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].label, "来源");
  assert.equal(changes[1].after, "已删除该轮次");
  assert.equal(changes[1].currentPath, undefined);
});

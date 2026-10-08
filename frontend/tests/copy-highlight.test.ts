import assert from "node:assert/strict";
import { test } from "node:test";
import { chainText, followUpText, questionText } from "../src/lib/copy-text";
import { highlightParts } from "../src/lib/highlight";
import type { Question } from "../src/lib/api/types";
const question: Question = {
  id: 3001,
  content: "Redis 分布式锁怎么实现？",
  referenceUrl: null,
  questionType: "NORMAL",
  sectionLabel: null,
  contextNote: null,
  algorithmTitle: null,
  algorithmDescription: null,
  algorithmRequirements: null,
  leetcodeNumber: null,
  leetcodeUrl: null,
  followUps: [
    { id: 4001, content: "为什么使用 SETNX？" },
    { id: 4002, content: "锁过期但业务没执行完怎么办？" },
    { id: 4003, content: "为什么使用 Lua？" },
  ],
};

test("single question never includes UI numbering or follow-ups", () => {
  assert.equal(questionText(question), "Redis 分布式锁怎么实现？");
});
test("Nth follow-up includes every preceding follow-up and excludes later ones", () => {
  assert.equal(
    chainText(question, 2),
    "Redis 分布式锁怎么实现？\n\n追问：\n1. 为什么使用 SETNX？\n2. 锁过期但业务没执行完怎么办？",
  );
  assert.equal(
    chainText(question),
    "Redis 分布式锁怎么实现？\n\n追问：\n1. 为什么使用 SETNX？\n2. 锁过期但业务没执行完怎么办？\n3. 为什么使用 Lua？",
  );
});
test("follow-up copy button copies only that follow-up, never the whole group", () => {
  assert.equal(followUpText(question, 3), "为什么使用 Lua？");
  assert.equal(followUpText(question, 1), "为什么使用 SETNX？");
  assert.notEqual(followUpText(question, 3), chainText(question));
});
test("algorithm copying retains original description and recorded requirements", () => {
  assert.equal(
    questionText({
      ...question,
      content: "二叉树深度",
      questionType: "ALGORITHM",
      algorithmTitle: "二叉树深度",
      algorithmDescription: "求二叉树的最大深度",
      algorithmRequirements: "手撕；说明时间复杂度",
    }),
    "二叉树深度\n\n求二叉树的最大深度\n\n手撕；说明时间复杂度",
  );
});
test("copy follows canonical array order without mutating the response", () => {
  const before = structuredClone(question);
  chainText(question, 2);
  assert.deepEqual(question, before);
});
test("visual highlighting preserves every original character and escapes regex input", () => {
  for (const [text, q] of [
    ["Agent MEMORY\nRedis 分布式锁", "agent memory"],
    ["C++ [x] a.b", "C++ [x] a.b"],
    ["RedisRedis", "Redis"],
    ["原文", ""],
  ]) {
    const parts = highlightParts(text, q);
    assert.equal(parts.map((part) => part.text).join(""), text);
    if (q) assert.ok(parts.some((part) => part.highlighted));
  }
  assert.equal(questionText(question), "Redis 分布式锁怎么实现？");
});

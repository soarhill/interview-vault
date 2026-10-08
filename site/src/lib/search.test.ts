import { describe, expect, it } from "vitest";
import {
  keywordMatch,
  parseTerms,
  selectFilters,
  selectSummaries,
  snippetWindow,
  sortInterviews,
} from "@/lib/search";
import { formatInterviewDate } from "@/lib/date";
import {
  chainText,
  followUpText,
  questionText,
} from "@/lib/copy-text";
import { highlightParts } from "@/lib/highlight";
import type { Interview, InterviewLibrary } from "@/lib/types";

function makeInterview(overrides: Partial<Interview>): Interview {
  return {
    id: 1,
    company: { id: 1, name: "测试公司" },
    department: null,
    position: { id: 1, name: "后端开发", category: "后端开发" },
    recruitType: "CAMPUS",
    firstInterviewDate: null,
    firstInterviewDatePrecision: null,
    originalPositionName: null,
    inferredPositionName: null,
    note: null,
    tags: [],
    sources: [],
    rounds: [],
    ...overrides,
  };
}

const library: InterviewLibrary = {
  schema: 1,
  generatedAt: "2026-10-08T00:00:00Z",
  provenance: "test",
  total: 3,
  interviews: [
    makeInterview({
      id: 10,
      company: { id: 2, name: "字节跳动" },
      recruitType: "INTERN",
      firstInterviewDate: "2026-08-01",
      firstInterviewDatePrecision: "DAY",
      tags: ["Redis"],
      rounds: [
        {
          id: 100,
          roundType: "TECHNICAL",
          roundNo: 1,
          displayName: "一面",
          remark: null,
          interviewDate: "2026-08-01",
          interviewDatePrecision: "DAY",
          questions: [
            {
              id: 1000,
              content: "Redis 持久化有哪些方式？",
              referenceUrl: null,
              questionType: "NORMAL",
              followUps: [{ id: 2000, content: "RDB 和 AOF 如何取舍？" }],
            },
          ],
        },
      ],
    }),
    makeInterview({
      id: 11,
      company: { id: 3, name: "腾讯" },
      position: { id: 2, name: "Agent开发", category: "Agent 开发" },
      firstInterviewDate: "2026-09-01",
      firstInterviewDatePrecision: "DAY",
      rounds: [
        {
          id: 101,
          roundType: "HR",
          roundNo: null,
          displayName: "HR 面",
          remark: null,
          interviewDate: "2026-09-01",
          interviewDatePrecision: "DAY",
          questions: [
            {
              id: 1001,
              content: "介绍一个你做过的项目。",
              referenceUrl: null,
              questionType: "NORMAL",
              followUps: [],
            },
          ],
        },
      ],
    }),
    makeInterview({ id: 9, company: { id: 4, name: "快手" }, firstInterviewDate: null }),
  ],
};

const baseState = {
  companyId: "",
  positionCategory: "",
  recruitType: "",
  q: "",
  page: 1,
};

describe("sortInterviews", () => {
  it("按首轮日期倒序，无日期置后，id 兜底", () => {
    expect(sortInterviews(library.interviews).map((item) => item.id)).toEqual([
      11, 10, 9,
    ]);
  });
});

describe("selectSummaries", () => {
  it("公司筛选", () => {
    const items = selectSummaries(library, { ...baseState, companyId: "2" });
    expect(items.map((item) => item.id)).toEqual([10]);
  });
  it("岗位方向筛选（按分类名）", () => {
    const items = selectSummaries(library, {
      ...baseState,
      positionCategory: "Agent 开发",
    });
    expect(items.map((item) => item.id)).toEqual([11]);
  });
  it("招聘类型筛选", () => {
    const items = selectSummaries(library, { ...baseState, recruitType: "INTERN" });
    expect(items.map((item) => item.id)).toEqual([10]);
  });
  it("多关键词 AND 语义：问题正文命中", () => {
    const items = selectSummaries(library, { ...baseState, q: "redis 持久化" });
    expect(items.map((item) => item.id)).toEqual([10]);
  });
  it("追问命中产生 FOLLOW_UP 匹配并可深链", () => {
    const [item] = selectSummaries(library, { ...baseState, q: "AOF" });
    expect(item.matches?.[0]).toMatchObject({
      kind: "FOLLOW_UP",
      questionId: 1000,
      followUpId: 2000,
      roundName: "一面",
    });
    expect(item.matches?.[0].snippet).toContain("AOF");
  });
  it("公司 / 标签命中产生 META 匹配", () => {
    const [item] = selectSummaries(library, { ...baseState, q: "字节" });
    expect(item.matches?.at(-1)).toMatchObject({ kind: "META" });
  });
  it("无命中返回空列表", () => {
    expect(selectSummaries(library, { ...baseState, q: "kubernetes" })).toEqual([]);
  });
});

describe("selectFilters", () => {
  it("联动计数：维度「全部」= 忽略该维度后的结果数", () => {
    const filters = selectFilters(library, { ...baseState, q: "redis" });
    expect(filters.total).toBe(1);
    expect(filters.companyTotal).toBe(1);
    expect(filters.companies[0]).toMatchObject({ id: 2, name: "字节跳动", count: 1 });
  });
  it("岗位分类计数与招聘类型计数", () => {
    const filters = selectFilters(library, baseState);
    expect(filters.positionCategoryTotal).toBe(3);
    expect(filters.positionCategories[0]).toMatchObject({
      value: "Agent 开发",
      count: 1,
    });
    expect(filters.recruitTypes).toEqual([
      { value: "INTERN", label: "实习", count: 1 },
      { value: "CAMPUS", label: "校招", count: 2 },
    ]);
  });
});

describe("keywordMatch 边界", () => {
  it("空搜索词匹配全部", () => {
    expect(keywordMatch(library.interviews[0], [])).toBe(true);
  });
  it("大小写不敏感", () => {
    expect(keywordMatch(library.interviews[0], ["REDIS"])).toBe(true);
  });
});

describe("snippetWindow", () => {
  it("截取命中位置前后约 30 字符并加省略号", () => {
    const long = "前".repeat(40) + "锚点词" + "后".repeat(40);
    const snippet = snippetWindow(long, "锚点词");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("锚点词");
  });
});

describe("lib 移植件", () => {
  it("formatInterviewDate 按精度格式化", () => {
    expect(formatInterviewDate("2026-08-01", "DAY")).toBe("2026-08-01");
    expect(formatInterviewDate("2026-08-01", "MONTH")).toBe("2026年8月");
    expect(formatInterviewDate("2026-08-01", "YEAR")).toBe("2026年");
    expect(formatInterviewDate(null, null)).toBe("");
  });
  it("copyText 组装问题 / 整组 / 单条追问", () => {
    const question = library.interviews[0].rounds[0].questions[0];
    expect(questionText(question)).toBe("Redis 持久化有哪些方式？");
    expect(chainText(question)).toBe(
      "Redis 持久化有哪些方式？\n\n追问：\n1. RDB 和 AOF 如何取舍？",
    );
    expect(followUpText(question, 1)).toBe("RDB 和 AOF 如何取舍？");
  });
  it("highlightParts 命中标记", () => {
    const parts = highlightParts("Redis 持久化", "redis");
    expect(parts).toEqual([
      { text: "Redis", highlighted: true },
      { text: " 持久化", highlighted: false },
    ]);
  });
  it("parseTerms 去重与小写化", () => {
    expect(parseTerms("  Redis redis  JAVA ")).toEqual(["redis", "java"]);
  });
});

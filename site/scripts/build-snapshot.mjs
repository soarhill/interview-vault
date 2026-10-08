#!/usr/bin/env node
/**
 * 数据快照构建（管线第 2 步）：私有原始导出 → 审核过的公开快照。
 *
 * 读取原始导出（默认 ../../iv-private-export/interviews-raw.json，不进 Git），
 * 按「公开字段白名单」裁剪、计算轮次展示名，校验通过后写入
 * public/data/interviews.json —— 只有这份文件会进入 gh-pages 并随站点发布。
 *
 * 用法：npm run snapshot [-- --raw <path>] [--check]
 *   --check  只校验已生成的 public/data/interviews.json，不重写。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../public/data/interviews.json");

const args = process.argv.slice(2);
const readArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const checkOnly = args.includes("--check");
const rawPath = resolve(
  scriptDir,
  readArg("--raw") ?? "../../../iv-private-export/interviews-raw.json",
);

const CN_ROUND = ["一", "二", "三", "四", "五"];

/** 与完整版后端 RoundDisplayNames 同规则。 */
function roundDisplayName(roundType, roundNo, remark) {
  const trimmed = remark?.trim() ?? "";
  if (roundType === "TECHNICAL" && roundNo >= 1 && roundNo <= 5)
    return trimmed ? `${CN_ROUND[roundNo - 1]}面 · ${trimmed}` : `${CN_ROUND[roundNo - 1]}面`;
  if (roundType === "HR") return trimmed ? `HR 面 · ${trimmed}` : "HR 面";
  return trimmed || "轮次";
}

/** 唯一外链守卫：与完整版 lib/url.ts 同规则，非 http(s) 一律不发布。 */
function safeUrl(value) {
  if (!value) return null;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(`snapshot 校验失败：${message}`);
  process.exit(1);
}

function assertNoForbiddenKeys(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key))
        fail(`公开快照出现禁止字段 ${path}.${key}`);
      assertNoForbiddenKeys(child, `${path}.${key}`);
    }
  }
}

/** 内部字段黑名单：任何变体进入公开快照即构建失败。 */
const FORBIDDEN_KEYS =
  /^(author.*|.*author|status|version|.*_?time|.*Time|password|secret|token|session|rejection.*|.*Reason|categoryId|sortOrder|sort_?order|normalized.*|leetcodeUrl)$/;

if (checkOnly) {
  const snapshot = JSON.parse(readFileSync(outputPath, "utf8"));
  assertNoForbiddenKeys(snapshot);
  console.log(
    `check ok: schema=${snapshot.schema} total=${snapshot.total} interviews=${snapshot.interviews.length}`,
  );
  process.exit(0);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
if (!Array.isArray(raw.interviews) || raw.interviews.length === 0)
  fail("原始导出为空或格式不正确");

const interviews = raw.interviews.map((item) => {
  const sources = (item.sources ?? [])
    .map((source) => ({ id: source.id, url: safeUrl(source.url) }))
    .filter((source) => source.url !== null);
  const rounds = (item.rounds ?? []).map((round) => ({
    id: round.id,
    roundType: round.round_type,
    roundNo: round.round_no ?? null,
    displayName: roundDisplayName(round.round_type, round.round_no, round.remark),
    remark: round.remark ?? null,
    interviewDate: round.interview_date ?? null,
    interviewDatePrecision: round.interview_date_precision ?? null,
    questions: (round.questions ?? []).map((question) => ({
      id: question.id,
      content: question.content,
      referenceUrl: safeUrl(question.reference_url ?? question.leetcode_url),
      questionType: question.question_type,
      algorithmTitle: question.algorithm_title ?? null,
      algorithmDescription: question.algorithm_description ?? null,
      algorithmRequirements: question.algorithm_requirements ?? null,
      sectionLabel: question.section_label ?? null,
      followUps: (question.follow_ups ?? []).map((followUp) => ({
        id: followUp.id,
        content: followUp.content,
      })),
    })),
  }));
  const firstInterviewDate = item.first_date ?? null;
  const firstInterviewDatePrecision = item.first_precision ?? null;
  return {
    id: item.id,
    company: { id: item.company.id, name: item.company.name },
    department: item.department ?? null,
    position: item.position
      ? {
          id: item.position.id,
          name: item.position.name,
          category: item.position.category ?? null,
        }
      : null,
    recruitType: item.recruit_type,
    firstInterviewDate,
    firstInterviewDatePrecision,
    originalPositionName: item.original_position_name ?? null,
    inferredPositionName: item.inferred_position_name ?? null,
    note: item.note ?? null,
    tags: item.tags ?? [],
    sources,
    rounds,
  };
});

/* ---------- 结构校验 ---------- */
const seenInterviewIds = new Set();
const seenQuestionIds = new Set();
const seenFollowUpIds = new Set();
let questionCount = 0;
let followUpCount = 0;
for (const interview of interviews) {
  if (seenInterviewIds.has(interview.id)) fail(`面经 id 重复：${interview.id}`);
  seenInterviewIds.add(interview.id);
  if (!["INTERN", "CAMPUS"].includes(interview.recruitType))
    fail(`面经 ${interview.id} 招聘类型非法：${interview.recruitType}`);
  if (interview.firstInterviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(interview.firstInterviewDate))
    fail(`面经 ${interview.id} 首轮日期格式非法`);
  for (const round of interview.rounds) {
    for (const question of round.questions) {
      questionCount += 1;
      if (seenQuestionIds.has(question.id)) fail(`问题 id 重复：${question.id}`);
      seenQuestionIds.add(question.id);
      if (!question.content?.trim()) fail(`问题 ${question.id} 内容为空`);
      for (const followUp of question.followUps) {
        followUpCount += 1;
        if (seenFollowUpIds.has(followUp.id)) fail(`追问 id 重复：${followUp.id}`);
        seenFollowUpIds.add(followUp.id);
        if (!followUp.content?.trim()) fail(`追问 ${followUp.id} 内容为空`);
      }
    }
  }
}

const snapshot = {
  schema: 1,
  generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  provenance:
    "面经内容整理自牛客（nowcoder.com）等公开渠道的真实面经分享，详情页保留原始来源链接。",
  total: interviews.length,
  interviews,
};

assertNoForbiddenKeys(snapshot);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `snapshot ok: ${interviews.length} 份面经 / ${questionCount} 题 / ${followUpCount} 追问 → ${outputPath}`,
);

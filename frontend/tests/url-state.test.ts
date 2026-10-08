import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apiQuery,
  changeFilter,
  detailUrl,
  listUrl,
  readUrlState,
} from "../src/lib/url-state";
import { formatInterviewDate } from "../src/lib/date";
test("URL is the canonical filter state and retains server query names", () => {
  const state = readUrlState(
    new URLSearchParams(
      "companyId=1&positionCategory=BACKEND&recruitType=INTERN&q=Agent+Memory&page=3",
    ),
  );
  assert.deepEqual(apiQuery(state), {
    companyId: "1",
    positionCategory: "BACKEND",
    recruitType: "INTERN",
    q: "Agent Memory",
    page: 3,
    size: 24,
  });
  assert.equal(
    listUrl(state),
    "/?companyId=1&positionCategory=BACKEND&recruitType=INTERN&q=Agent+Memory&page=3",
  );
  for (const key of [
    "companyId",
    "positionCategory",
    "recruitType",
    "q",
  ] as const)
    assert.equal(changeFilter(state, key, "").page, 1);
  assert.equal(listUrl(readUrlState(new URLSearchParams())), "/");
});
test("invalid URL conditions remain available to server validation", () => {
  const state = readUrlState(
    new URLSearchParams("companyId=unknown&recruitType=social&page=bad"),
  );
  assert.equal(apiQuery(state).recruitType, "social");
  assert.equal(state.companyId, "unknown");
  assert.ok(Number.isNaN(state.page));
});
test("question and follow-up links use stable IDs and encode keywords", () => {
  assert.equal(
    detailUrl(1001, "A&B", 3001, 4001),
    "/interview/1001?q=A%26B&followUpId=4001#question-3001",
  );
  assert.equal(
    detailUrl(1001, "Redis", 3001),
    "/interview/1001?q=Redis#question-3001",
  );
  assert.equal(detailUrl(1001, "Redis"), "/interview/1001?q=Redis");
});
test("historical month/year placeholders never claim a specific day", () => {
  assert.equal(formatInterviewDate("2026-06-01", "MONTH"), "2026年6月");
  assert.equal(formatInterviewDate("2026-01-01", "YEAR"), "2026年");
  assert.equal(formatInterviewDate("2026-09-20", "DAY"), "2026-09-20");
  assert.equal(formatInterviewDate(null, null), "");
});

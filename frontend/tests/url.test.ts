import assert from "node:assert/strict";
import { test } from "node:test";
import { externalHref } from "../src/lib/url";

test("放行 http / https 绝对链接", () => {
  assert.equal(
    externalHref("https://leetcode.cn/problems/maximum-subarray/"),
    "https://leetcode.cn/problems/maximum-subarray/",
  );
  assert.equal(externalHref("http://example.com/pdd"), "http://example.com/pdd");
});

test("拦截危险 scheme", () => {
  assert.equal(externalHref("javascript:alert(1)"), undefined);
  assert.equal(externalHref("JavaScript:fetch('/api/v1/me/interviews')"), undefined);
  assert.equal(externalHref(" javascript:alert(1)"), undefined);
  assert.equal(externalHref("data:text/html,<script>alert(1)</script>"), undefined);
  assert.equal(externalHref("vbscript:msgbox"), undefined);
});

test("拦截非绝对地址与非法值", () => {
  assert.equal(externalHref("/relative/path"), undefined);
  assert.equal(externalHref("example.com/leetcode"), undefined);
  assert.equal(externalHref("不是链接"), undefined);
  assert.equal(externalHref(""), undefined);
  assert.equal(externalHref(null), undefined);
  assert.equal(externalHref(undefined), undefined);
});

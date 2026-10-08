/**
 * 外链渲染守卫：仅放行 http/https 绝对链接；javascript:、data: 等危险 scheme、
 * 相对路径与无法解析的字符串一律返回 undefined（调用方不渲染为可点击链接）。
 * 入库校验之外的最后防线——存量数据或直改库产生的脏 URL 到不了 href。
 */
export function externalHref(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

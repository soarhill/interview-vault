import type { Interview, InterviewLibrary } from "./types";

/**
 * 静态数据加载：整个快照一次拉取、模块内缓存。
 * 快照由 site/scripts/build-snapshot.mjs 生成，位于 public/data/interviews.json。
 */
let cached: Promise<InterviewLibrary> | null = null;

async function fetchLibrary(): Promise<InterviewLibrary> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data/interviews.json`,
  );
  if (!response.ok) throw new Error(`数据加载失败（${response.status}）`);
  const library = (await response.json()) as InterviewLibrary;
  if (library.schema !== 1 || !Array.isArray(library.interviews))
    throw new Error("数据快照格式不兼容");
  return library;
}

export function loadLibrary(): Promise<InterviewLibrary> {
  cached ??= fetchLibrary();
  return cached;
}

/** 详情查找：快照保证 id 唯一。 */
export function findInterview(
  library: InterviewLibrary,
  id: string,
): Interview | undefined {
  if (!/^\d+$/.test(id)) return undefined;
  const numeric = Number(id);
  return library.interviews.find((interview) => interview.id === numeric);
}

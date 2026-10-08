import { ApiError } from "./errors";
import type { Result } from "./types";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}
export function isMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_API_MOCK === "true";
}
export function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
}
export function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  return params.toString();
}
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("XSRF-TOKEN=".length));
  } catch {
    return null;
  }
}
export async function refreshCsrf(signal?: AbortSignal): Promise<void> {
  await request<unknown>("/auth/csrf", { signal });
}
function isResult(body: unknown): body is Result<unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.message === "string" &&
    "data" in value
  );
}
async function readResponse<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      response.status,
      response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR",
      "服务返回了无法读取的数据，请重试。",
      error,
    );
  }
  if (!isResult(body))
    throw new ApiError(
      response.status,
      response.ok ? "INVALID_RESPONSE" : "HTTP_ERROR",
      "服务返回了无法读取的数据，请重试。",
    );
  if (!response.ok || body.code !== "SUCCESS") {
    const message =
      response.status >= 500
        ? "服务暂时不可用，请稍后重试。"
        : body.message || "请求失败，请重试。";
    if (response.status === 401 && typeof window !== "undefined") {
      // 会话失效：通知全局登录态降级（头像同步回「GitHub 登录」），
      // 避免页面提示「登录已过期」而右上角仍是登录态。
      window.dispatchEvent(new CustomEvent("interview-vault:unauthorized"));
    }
    throw new ApiError(response.status, body.code, message);
  }
  return body.data as T;
}
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const useMock = isMockEnabled();
  if (process.env.NODE_ENV === "production" && useMock)
    throw new Error(
      "生产构建禁止启用 Mock：请移除 NEXT_PUBLIC_API_MOCK=true 后重新构建",
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 15000);
  try {
    const method = options.method ?? "GET";
    if (method !== "GET" && !readCsrfCookie())
      await refreshCsrf(controller.signal);
    const headers = new Headers({ Accept: "application/json" });
    const token = readCsrfCookie();
    if (method !== "GET" && token) headers.set("X-XSRF-TOKEN", token);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
      credentials: "include",
      cache: "no-store",
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    let response: Response;
    if (useMock) {
      const { mockRequest } = await import("./mock");
      response = await mockRequest(
        path,
        options.query ?? {},
        options.body,
        init,
      );
    } else {
      const query = queryString(options.query ?? {});
      response = await fetch(
        `${apiBaseUrl()}/api/v1${path}${query ? `?${query}` : ""}`,
        init,
      );
    }
    return await readResponse<T>(response);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut) throw new ApiError(0, "TIMEOUT", "请求超时，请重试。", error);
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "暂时无法连接服务，请检查网络后重试。",
      error,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

import { apiBaseUrl, isMockEnabled, refreshCsrf, request } from "./client";
import type { CurrentUserResponse, UserRole } from "./types";

export { isMockEnabled };
export const initializeCsrf = (signal?: AbortSignal): Promise<void> =>
  refreshCsrf(signal);
export const getCurrentUser = (signal?: AbortSignal) =>
  request<CurrentUserResponse>("/auth/me", { signal });
export const getGithubLoginUrl = (): string =>
  `${apiBaseUrl()}/api/v1/auth/github`;
export async function logout(signal?: AbortSignal): Promise<void> {
  await request<unknown>("/auth/logout", { method: "POST", signal });
  await initializeCsrf(signal);
}
// 演示身份切换只作用于本地 Mock，不创建线上 HTTP 接口。
export async function setMockRole(
  role: UserRole | null,
): Promise<CurrentUserResponse | null> {
  if (!isMockEnabled()) throw new Error("当前使用真实 API，不能切换演示身份");
  const { selectMockRole } = await import("./mock");
  const user = selectMockRole(role);
  await initializeCsrf();
  return user;
}

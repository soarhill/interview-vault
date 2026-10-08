"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  initializeCsrf,
  logout as apiLogout,
  setMockRole,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import type { CurrentUserResponse } from "@/lib/api/types";

type UserStatus = "loading" | "ready" | "error";
interface UserContextValue {
  user: CurrentUserResponse | null;
  status: UserStatus;
  error: unknown;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  selectMockRole: (role: "USER" | "ADMIN" | null) => Promise<void>;
}
const UserContext = createContext<UserContextValue | null>(null);
async function loadSession(
  signal?: AbortSignal,
): Promise<CurrentUserResponse | null> {
  await initializeCsrf(signal);
  try {
    return await getCurrentUser(signal);
  } catch (cause) {
    if (cause instanceof ApiError && cause.httpStatus === 401) return null;
    throw cause;
  }
}
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [status, setStatus] = useState<UserStatus>("loading");
  const [error, setError] = useState<unknown>(null);
  const refresh = useCallback(async () => {
    try {
      setUser(await loadSession());
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setError(cause);
      setStatus("error");
    }
  }, []);
  useEffect(() => {
    // 任何接口 401（会话失效 / 服务端重启清 Session）→ 立即降级为未登录
    const onUnauthorized = () => {
      setUser(null);
      setStatus("ready");
      setError(null);
    };
    window.addEventListener("interview-vault:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener(
        "interview-vault:unauthorized",
        onUnauthorized,
      );
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal)
      .then((current) => {
        if (!controller.signal.aborted) {
          setUser(current);
          setStatus("ready");
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause);
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, []);
  const logout = async () => {
    await apiLogout();
    await refresh();
  };
  const selectMockRole = async (role: "USER" | "ADMIN" | null) => {
    await setMockRole(role);
    await refresh();
  };
  return (
    <UserContext.Provider
      value={{ user, status, error, refresh, logout, selectMockRole }}
    >
      {children}
    </UserContext.Provider>
  );
}
export function useCurrentUser() {
  const value = useContext(UserContext);
  if (!value) throw new Error("useCurrentUser requires CurrentUserProvider");
  return value;
}

"use client";
import { useEffect, useState } from "react";

type Resource<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: unknown };
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    resource: Resource<T>;
  }>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, resource: { status: "success", data } });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, resource: { status: "error", error } });
      },
    );
    return () => controller.abort();
  }, [enabled, load, requestKey]);
  const resource: Resource<T> =
    result?.key === requestKey ? result.resource : { status: "loading" };
  return {
    ...resource,
    /** 同一代请求内的乐观更新（如本地先行删除一行）；retry 仍会整页重取。 */
    setData: (update: (current: T) => T) =>
      setResult((current) =>
        current && current.key === requestKey &&
        current.resource.status === "success"
          ? {
              ...current,
              resource: {
                status: "success",
                data: update(current.resource.data),
              },
            }
          : current,
      ),
    retry: () => setAttempt((value) => value + 1),
  };
}

import { useEffect, useState } from "react";
import { loadLibrary } from "@/lib/data";
import type { InterviewLibrary } from "@/lib/types";

type LibraryState =
  | { status: "loading" }
  | { status: "success"; data: InterviewLibrary }
  | { status: "error"; error: unknown };

export type LibraryResource =
  | { status: "loading" }
  | { status: "success"; data: InterviewLibrary }
  | { status: "error"; error: unknown; retry: () => void };

/** 全站数据只加载一次；失败可重试。 */
export function useLibrary(): LibraryResource {
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadLibrary().then(
      (data) => alive && setState({ status: "success", data }),
      (error) => alive && setState({ status: "error", error }),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  if (state.status === "error") {
    return {
      status: "error",
      error: state.error,
      retry: () => {
        setState({ status: "loading" });
        setAttempt((value) => value + 1);
      },
    };
  }
  return state;
}

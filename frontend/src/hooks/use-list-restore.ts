"use client";
import { useEffect } from "react";
import { finishRestore, readListReturn } from "@/lib/navigation";

export function useListRestore(ready: boolean, url: string) {
  useEffect(() => {
    if (!ready) return;
    const entry = readListReturn();
    if (!entry?.pending || entry.url !== location.pathname + location.search)
      return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: entry.scrollY, behavior: "instant" });
        finishRestore();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
    };
  }, [ready, url]);
}

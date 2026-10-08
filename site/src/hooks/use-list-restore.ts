import { useEffect } from "react";
import { currentRouteUrl, finishRestore, readListReturn } from "@/lib/navigation";

/** 列表重新挂载时若是一次「返回」，把滚动位置恢复到进详情前的那一格。 */
export function useListRestore(ready: boolean, url: string) {
  useEffect(() => {
    if (!ready) return;
    const entry = readListReturn();
    if (!entry?.pending || entry.url !== currentRouteUrl()) return;
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

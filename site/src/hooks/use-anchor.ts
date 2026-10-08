import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * 深链定位：HashRouter 下锚点经查询参数传递（questionId/followUpId），
 * 数据就绪后滚动到目标问题或追问并高亮；目标已不存在时提示「原定位问题已变化」。
 */
export function useAnchor(ready: boolean, id: string) {
  const [invalid, setInvalid] = useState(false);
  const [params] = useSearchParams();
  const questionId = params.get("questionId");
  const followUpId = params.get("followUpId");
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let active: HTMLElement | null = null;
    const frame2 = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        active?.classList.remove("anchor-target");
        const anchor = questionId
          ? document.getElementById(`question-${questionId}`)
          : null;
        const target =
          anchor && followUpId && /^\d+$/.test(followUpId)
            ? anchor.querySelector<HTMLElement>(`[data-follow-up="${followUpId}"]`)
            : anchor;
        if (!anchor || !target) {
          setInvalid(Boolean(questionId));
          anchor?.scrollIntoView({ block: "start", behavior: "instant" });
          return;
        }
        setInvalid(false);
        target.scrollIntoView({ block: "start", behavior: "instant" });
        active = target;
        target.classList.add("anchor-target");
        target.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(frame2);
      active?.classList.remove("anchor-target");
    };
  }, [ready, id, questionId, followUpId]);
  return invalid;
}

"use client";
import { useEffect, useState } from "react";
export function useAnchor(
  ready: boolean,
  id: string,
  q: string,
  followUpId: string | null = null,
) {
  const [invalidFor, setInvalidFor] = useState("");
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let active: HTMLElement | null = null;
    const locate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        active?.classList.remove("anchor-target");
        const hash = window.location.hash;
        if (!hash) {
          setInvalidFor("");
          return;
        }
        const anchor = /^#(?:question|round)-\d+$/.test(hash)
          ? document.getElementById(hash.slice(1))
          : null;
        const followId = hash.startsWith("#question-") ? followUpId : null;
        const target =
          followId && /^\d+$/.test(followId)
            ? anchor?.querySelector<HTMLElement>(
                `[data-follow-up="${followId}"]`,
              )
            : anchor;
        if (!anchor || !target) {
          setInvalidFor(id);
          anchor?.scrollIntoView({ block: "start", behavior: "instant" });
          return;
        }
        setInvalidFor("");
        target.scrollIntoView({ block: "start", behavior: "instant" });
        active = target;
        target.classList.add("anchor-target");
        target.focus({ preventScroll: true });
      });
    };
    locate();
    window.addEventListener("hashchange", locate);
    return () => {
      cancelAnimationFrame(frame);
      active?.classList.remove("anchor-target");
      window.removeEventListener("hashchange", locate);
    };
  }, [ready, id, q, followUpId]);
  return invalidFor === id;
}

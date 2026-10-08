"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
export function UnsavedChanges({ dirty }: { dirty: boolean }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const leave = useRef<(destination: string) => void>(() => {});
  const pendingSignOut = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const guardId = crypto.randomUUID();
    const currentUrl = window.location.href;
    const initialState: unknown = window.history.state;
    const state =
      initialState && typeof initialState === "object" ? initialState : {};
    window.history.pushState(
      { ...state, interviewUnsavedGuard: guardId },
      "",
      currentUrl,
    );
    let leaving = false;
    let restoreGuard = false;
    let navigateAfterGuard: (() => void) | null = null;
    const onPopState = (event: PopStateEvent) => {
      if (leaving) return;
      event.stopImmediatePropagation();
      if (navigateAfterGuard) {
        const navigate = navigateAfterGuard;
        navigateAfterGuard = null;
        leaving = true;
        navigate();
        return;
      }
      if (restoreGuard) {
        restoreGuard = false;
        return;
      }
      restoreGuard = true;
      window.history.forward();
      setDestination("BACK");
    };
    leave.current = (target) => {
      if (target === "BACK") {
        leaving = true;
        window.history.go(-2);
        return;
      }
      const navigate =
        target === "SIGNOUT"
          ? () => {
              const proceed = pendingSignOut.current;
              pendingSignOut.current = null;
              proceed?.();
              // Keep guarding while logout is pending; a failed logout must not disable input protection.
              if (window.location.href === currentUrl) {
                window.history.pushState(
                  { ...state, interviewUnsavedGuard: guardId },
                  "",
                  currentUrl,
                );
                leaving = false;
              }
            }
          : () => {
              const url = new URL(target);
              if (url.origin === window.location.origin)
                router.push(`${url.pathname}${url.search}${url.hash}`);
              else window.location.assign(url.href);
            };
      if (window.history.state?.interviewUnsavedGuard === guardId) {
        navigateAfterGuard = navigate;
        window.history.back();
      } else {
        leaving = true;
        navigate();
      }
    };
    const onSignOut = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (
        !detail ||
        typeof detail !== "object" ||
        !("proceed" in detail) ||
        typeof detail.proceed !== "function"
      )
        return;
      event.preventDefault();
      pendingSignOut.current = detail.proceed as () => void;
      setDestination("SIGNOUT");
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      )
        return;
      const url = new URL(target.href, window.location.href);
      if (
        url.href === window.location.href ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("interview-vault:before-signout", onSignOut);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState, true);
      window.removeEventListener("interview-vault:before-signout", onSignOut);
      document.removeEventListener("click", onClick, true);
      if (
        !leaving &&
        window.location.href === currentUrl &&
        window.history.state?.interviewUnsavedGuard === guardId
      ) {
        // Remove the temporary same-page history entry after a successful save.
        window.addEventListener(
          "popstate",
          (event) => event.stopImmediatePropagation(),
          { once: true, capture: true },
        );
        window.history.back();
      }
    };
  }, [dirty, router]);
  function cancelLeave() {
    pendingSignOut.current = null;
    setDestination(null);
  }
  return (
    <Dialog
      open={destination !== null}
      onOpenChange={(open) => {
        if (!open) cancelLeave();
      }}
    >
      <DialogContent>
        <DialogTitle>还有未保存的内容</DialogTitle>
        <DialogDescription>
          离开后，这次填写的内容会丢失。可以先留在这里保存。
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={cancelLeave}>
            继续编辑
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!destination) return;
              leave.current(destination);
              setDestination(null);
            }}
          >
            放弃修改并离开
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

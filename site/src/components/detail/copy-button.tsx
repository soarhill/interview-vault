"use client";
import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/hooks/use-copy";
import { Icon } from "../shared/icon";
import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  label = "复制",
  accessibleLabel,
  secondary = false,
}: {
  text: string;
  label?: string;
  accessibleLabel: string;
  secondary?: boolean;
}) {
  const copy = useCopy();
  const [status, setStatus] = useState<"idle" | "copying" | "success">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function handleCopy() {
    if (timer.current) clearTimeout(timer.current);
    setStatus("copying");
    const success = await copy(text);
    if (!mounted.current) return;
    setStatus(success ? "success" : "idle");
    if (success) timer.current = setTimeout(() => setStatus("idle"), 1600);
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className={`copy-button${secondary ? " copy-secondary" : ""}`}
      disabled={status === "copying"}
      onClick={handleCopy}
      aria-label={
        status === "success" ? `${accessibleLabel}，已复制` : accessibleLabel
      }
    >
      <Icon name={status === "success" ? "check" : "copy"} size={14} />
      <span aria-live="polite">
        {status === "success"
          ? "已复制"
          : status === "copying"
            ? "复制中"
            : label}
      </span>
    </Button>
  );
}

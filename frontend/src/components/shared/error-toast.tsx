"use client";
import { useEffect } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";

/**
 * 轻量 toast：顶部居中浮层，4s 自动消失，可手动关。
 * error = 橙色警告；success = 绿色完成提示（可附次级操作链接）。
 */
export function ErrorToast({
  message,
  onClose,
  tone = "error",
  action,
}: {
  message: string;
  onClose: () => void;
  tone?: "error" | "success";
  action?: { label: string; href: string };
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;
  return (
    <div
      className={`error-toast toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      onClick={onClose}
    >
      <Icon size={15} aria-hidden="true" />
      <span>{message}</span>
      {action && (
        <a
          href={action.href}
          className="toast-action"
          onClick={(event) => event.stopPropagation()}
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

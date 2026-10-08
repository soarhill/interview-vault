"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { PageState } from "./page-state";
import { LoginButton } from "../auth/login-button";
export function RequestFeedback({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  if (error instanceof ApiError && error.httpStatus === 401)
    return (
      <div className="workspace-notice" role="alert">
        <p>登录已过期，请重新登录。当前未保存的输入会保留。</p>
        <LoginButton />
      </div>
    );
  if (error instanceof ApiError && error.httpStatus === 409)
    return <ConflictBanner error={error} onRefresh={retry} />;
  const denied = error instanceof ApiError && error.httpStatus === 403;
  const missing = error instanceof ApiError && error.httpStatus === 404;
  return (
    <PageState
      error
      title={denied ? "权限不足" : missing ? "内容不存在" : "暂时无法完成操作"}
      description={denied ? "你没有操作这份内容的权限。" : errorMessage(error)}
      action={retry && !denied && !missing ? "重新加载" : "返回首页"}
      onAction={retry}
      href={!retry || denied || missing ? "/" : undefined}
    />
  );
}
export function ConflictBanner({
  error,
  onRefresh,
  children,
}: {
  error: unknown;
  onRefresh?: () => void;
  children?: ReactNode;
}) {
  const changeConflict =
    error instanceof ApiError && error.code === "CHANGE_REQUEST_CONFLICT";
  return (
    <div className="workspace-conflict" role="alert">
      <strong>
        {changeConflict ? "请先处理待审核的变更申请" : "当前内容已经发生变化"}
      </strong>
      <p>
        {changeConflict
          ? "这份面经存在待处理申请，处理后才能直接修改。"
          : "请刷新最新内容并重新确认。当前未保存的输入会保留，不会自动覆盖。"}
      </p>
      <div className="workspace-actions">
        {changeConflict && (
          <Link className="text-button" href="/admin/change-requests">
            去处理申请
          </Link>
        )}
        {onRefresh && (
          <button
            type="button"
            className="secondary-button"
            onClick={onRefresh}
          >
            读取最新版本
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function WarningFeedback({
  warnings,
}: {
  warnings: { code: string; message: string }[];
}) {
  return warnings.length ? (
    <div className="workspace-notice" role="status">
      {warnings.map((warning, index) => (
        <p key={`${warning.code}-${index}`}>{warning.message}</p>
      ))}
    </div>
  ) : null;
}

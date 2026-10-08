"use client";
import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageState, Loading } from "@/components/shared/page-state";
import { LoginButton } from "./login-button";
import { RequestFeedback } from "@/components/shared/request-feedback";
export function AuthGate({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { user, status, error, refresh } = useCurrentUser();
  if (status === "loading") return <Loading detail />;
  if (status === "error")
    return <RequestFeedback error={error} retry={() => void refresh()} />;
  if (!user)
    return (
      <section className="auth-welcome">
        <span className="eyebrow">一起留下真实问题</span>
        <h1>登录后，分享你的面试经历</h1>
        <LoginButton />
      </section>
    );
  if (admin && user.role !== "ADMIN")
    return (
      <PageState
        error
        title="权限不足"
        description="这个工作区需要管理员权限。你仍然可以浏览面经或管理自己的投稿。"
        action="浏览面经"
        href="/"
      />
    );
  return children;
}

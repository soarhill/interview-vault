"use client";
import { useState } from "react";
import { GithubIcon } from "../shared/github-icon";
import { getGithubLoginUrl, isMockEnabled } from "@/lib/api/auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/errors";

export function LoginButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { selectMockRole } = useCurrentUser();
  const select = async (role: "USER" | "ADMIN") => {
    setBusy(true);
    setError("");
    try {
      await selectMockRole(role);
      setOpen(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  if (!isMockEnabled())
    return (
      <a className="login-button" href={getGithubLoginUrl()}>
        <GithubIcon size={16} />
        GitHub 登录
      </a>
    );
  return (
    <>
      <Button
        variant="outline"
        className="login-button"
        onClick={() => setOpen(true)}
      >
        <GithubIcon size={16} />
        GitHub 登录
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="about-dialog">
          <DialogTitle>本地体验登录</DialogTitle>
          <DialogDescription>
            当前使用开发 Mock。选择一个身份体验投稿或审核流程，真实环境会跳转
            GitHub 授权。
          </DialogDescription>
          <div className="workspace-actions">
            <Button disabled={busy} onClick={() => void select("USER")}>
              以投稿人体验
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void select("ADMIN")}
            >
              以管理员体验
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

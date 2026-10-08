"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronLeft, PenLine, UserRound } from "lucide-react";
import { Icon } from "./icon";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LoginButton } from "../auth/login-button";
import { errorMessage } from "@/lib/api/errors";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="面个 Offer 首页">
      <Icon name="book" size={26} />
      <span>面个 Offer</span>
    </Link>
  );
}
export function SiteHeader({ wide = false }: { wide?: boolean }) {
  const pathname = usePathname();
  const { user, status, logout } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const isEditorRoute = Boolean(
    pathname?.startsWith("/me/interviews/") &&
      (pathname.endsWith("/new") ||
        pathname.endsWith("/edit") ||
        pathname.endsWith("/change")),
  );
  const mobileTab = pathname?.startsWith("/me/interviews/new")
    ? "share"
    : pathname?.startsWith("/me/interviews")
      ? "me"
      : pathname === "/" || pathname?.startsWith("/interview/")
        ? "browse"
        : undefined;
  const performSignOut = async () => {
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const signOut = () => {
    const event = new CustomEvent("interview-vault:before-signout", {
      cancelable: true,
      detail: { proceed: () => void performSignOut() },
    });
    if (window.dispatchEvent(event)) void performSignOut();
  };
  return (
    <>
    <header
      className={`site-header mobile-layout${wide ? " site-header-wide" : ""}${!isAdminRoute && !isEditorRoute ? " has-mobile-nav" : ""}${isEditorRoute ? " site-header-editor" : ""}`}
    >
      <div className="site-header-inner">
        <Brand />
        <nav className="site-navigation" aria-label="主导航">
          <Link
            href="/"
            className="nav-browse"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            浏览面经
          </Link>
          <Link
            className="nav-contribute"
            href="/me/interviews/new"
            aria-current={pathname?.startsWith("/me/interviews/new")
              ? "page"
              : undefined}
          >
            分享面经
          </Link>
          {user && (
            <Link
              href="/me/interviews"
              aria-current={
                pathname === "/me/interviews" ||
                pathname?.startsWith("/me/interviews/") &&
                  !pathname.startsWith("/me/interviews/new")
                  ? "page"
                  : undefined
              }
            >
              我的投稿
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin/reviews"
              aria-current={pathname?.startsWith("/admin") ? "page" : undefined}
            >
              审核
            </Link>
          )}
          <Link
            href="/about"
            className="about-trigger"
            aria-current={pathname === "/about" ? "page" : undefined}
          >
            关于 / 反馈
          </Link>
          {status === "loading" ? (
            <span className="auth-loading" aria-label="正在读取登录状态" />
          ) : user ? (
            <details className="user-menu">
              <summary aria-label="用户菜单">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="user-avatar"
                    src={user.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="user-avatar user-avatar-fallback" aria-hidden="true">
                    {user.githubLogin.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="user-menu-chevron" aria-hidden="true">
                  <Icon name="chevron" size={12} />
                </span>
              </summary>
              {/* 头像菜单只管账号（我是谁 / 退出），去哪里的导航全在顶部导航里 */}
              <div className="user-menu-panel">
                <span className="user-menu-name">
                  {user.githubLogin}
                  {user.role === "ADMIN" && <small>管理员</small>}
                </span>
                <span className="user-menu-divider" aria-hidden="true" />
                <button className="user-menu-signout" disabled={busy} onClick={signOut}>
                  {busy ? "退出中…" : "退出登录"}
                </button>
                {error && <p role="alert">{error}</p>}
              </div>
            </details>
          ) : (
            <LoginButton />
          )}
        </nav>
      </div>
      {isEditorRoute && (
        <div className="mobile-editor-title">
          {/* 从底部「分享」进入的新建页退出回浏览；编辑 / 修改仍回我的投稿 */}
          <Link
            href={pathname?.endsWith("/new") ? "/" : "/me/interviews"}
            aria-label={pathname?.endsWith("/new") ? "返回浏览" : "返回我的投稿"}
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
          <strong>
            {pathname?.includes("/change")
              ? "修改面经"
              : pathname?.includes("/edit")
                ? "编辑面经"
                : "分享面经"}
          </strong>
          <span aria-hidden="true" />
        </div>
      )}
    </header>
    {!isAdminRoute && !isEditorRoute && (
      <nav className="mobile-primary-nav" aria-label="主要导航">
        <Link href="/" aria-current={mobileTab === "browse" ? "page" : undefined}>
          <BookOpen aria-hidden="true" />
          <span>浏览</span>
        </Link>
        <Link href="/me/interviews/new" aria-current={mobileTab === "share" ? "page" : undefined}>
          <PenLine aria-hidden="true" />
          <span>分享</span>
        </Link>
        <Link href="/me/interviews" aria-current={mobileTab === "me" ? "page" : undefined}>
          <UserRound aria-hidden="true" />
          <span>我的</span>
        </Link>
      </nav>
    )}
    </>
  );
}

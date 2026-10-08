import { Link, useLocation } from "react-router-dom";
import { Icon } from "./icon";
import { GithubIcon } from "./github-icon";

export const REPO_URL = "https://github.com/soarhill/interview-vault";
export const SITE_TITLE = "面个 Offer｜真实大厂面试问题";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="面个 Offer 首页">
      <Icon name="book" size={26} />
      <span>面个 Offer</span>
    </Link>
  );
}

/** 静态版头部：浏览 + 关于 + GitHub 入口。投稿/登录等完整版功能不在此提供。 */
export function SiteHeader() {
  const { pathname } = useLocation();
  return (
    <header className="site-header mobile-layout">
      <div className="site-header-inner">
        <Brand />
        <nav className="site-navigation" aria-label="主导航">
          <Link
            to="/"
            className="nav-browse"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            浏览面经
          </Link>
          <Link
            to="/about"
            className="about-trigger"
            aria-current={pathname === "/about" ? "page" : undefined}
          >
            关于 / 反馈
          </Link>
          <a
            className="nav-github"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库（新窗口打开）"
          >
            <GithubIcon size={17} />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

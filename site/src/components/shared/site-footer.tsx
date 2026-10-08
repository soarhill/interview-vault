import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { REPO_URL } from "./brand";

const COUNTER_SCRIPT_ID = "vercount-script";
const COUNTER_SCRIPT_SRC = "https://events.vercount.one/js";
const CACHE_KEY = "interview-vault:site-pv:v1";

function readCachedCount(): string {
  try {
    return localStorage.getItem(CACHE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * 站点累计访问计数（VerCount 公共服务，无需注册）。
 * 脚本必须在计数 span 已挂载后注入：vercount 启动时一次性缓存元素引用，
 * 找不到就不再重试；SPA 里 React 晚于 head 脚本挂载，所以由页脚负责注入。
 * 脚本每次页面加载只回填当时挂载的那个页脚，站内路由切换后的页脚
 * 用 localStorage 缓存值展示。服务不可达时计数段保持隐藏。
 */
function useVisitCounter(): boolean {
  const [counted, setCounted] = useState(() => readCachedCount() !== "");
  useEffect(() => {
    if (!document.getElementById(COUNTER_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = COUNTER_SCRIPT_ID;
      script.src = COUNTER_SCRIPT_SRC;
      document.body.appendChild(script);
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const value = document
        .getElementById("vercount_value_site_pv")
        ?.textContent?.trim();
      if (value && value !== "Loading" && value !== "0") {
        try {
          localStorage.setItem(CACHE_KEY, value);
        } catch {
          /* 无痕模式等场景下缓存不可用，仅影响后续路由切换的展示 */
        }
        window.clearInterval(timer);
        setCounted(true);
      } else if (tries >= 16) {
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);
  return counted;
}

/** 页脚：站点信息 + 数据快照日期 + 累计访问 + GitHub 入口。 */
export function SiteFooter({ generatedAt }: { generatedAt?: string }) {
  const counted = useVisitCounter();
  const cached = readCachedCount();
  return (
    <footer className="site-footer">
      <p>
        面个 Offer · 静态阅读版
        {generatedAt && <> · 数据快照 {generatedAt.slice(0, 10)}</>}
        <span hidden={!counted} aria-hidden={!counted}>
          {" "}
          ·{" "}
          <span className="visit-counter">
            累计访问{" "}
            <strong>
              <span id="vercount_value_site_pv">{cached || "Loading"}</span>
            </strong>{" "}
            次
          </span>
        </span>
      </p>
      <p>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          查看源码 / GitHub
        </a>
        <span aria-hidden="true"> · </span>
        <Link to="/about">关于本项目</Link>
      </p>
    </footer>
  );
}

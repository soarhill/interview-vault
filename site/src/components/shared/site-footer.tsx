import { Link } from "react-router-dom";
import { REPO_URL } from "./brand";

/** 静态版页脚：替代完整版的「加油」互动条（其依赖服务端，静态版不提供）。 */
export function SiteFooter({ generatedAt }: { generatedAt?: string }) {
  return (
    <footer className="site-footer">
      <p>
        面个 Offer · 静态阅读版
        {generatedAt && <> · 数据快照 {generatedAt.slice(0, 10)}</>}
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

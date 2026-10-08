import { GithubIcon } from "../shared/github-icon";

export function ListHeader({
  total,
  companyCount,
  loading,
}: {
  total?: number;
  companyCount?: number;
  loading: boolean;
}) {
  return (
    <div className="list-heading">
      <p className="eyebrow">真实记录 · 一起贡献</p>
      <h1>
        <span className="hero-title-part">把真实问题，</span>
        <span className="hero-title-part">留给下一次面试</span>
      </h1>
      <p className="subtitle">来自真实面试记录的大厂面试问题库</p>
      <p className="scale-info">
        {total === undefined
          ? loading
            ? "正在读取真实面经"
            : "真实面试记录"
          : `${total} 份真实面经`}
        {companyCount !== undefined && (
          <>
            <span>·</span>
            {companyCount} 家公司
          </>
        )}
        <a
          className="scale-github"
          href="https://github.com/soarhill/interview-vault"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon size={13} />
          开源在 GitHub · 欢迎 Star ↗
        </a>
      </p>
    </div>
  );
}

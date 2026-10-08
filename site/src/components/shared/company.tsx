const brands: Record<string, string> = {
  bytedance: "bytedance",
  tencent: "tencent",
  pinduoduo: "pinduoduo",
  baidu: "baidu",
  kuaishou: "kuaishou",
  didi: "didi",
  xiaohongshu: "xiaohongshu",
  dewu: "dewu",
};
const brandNames: Record<string, string> = {
  字节跳动: "bytedance",
  腾讯: "tencent",
  拼多多: "pinduoduo",
  百度: "baidu",
  快手: "kuaishou",
  滴滴: "didi",
  小红书: "xiaohongshu",
  得物: "dewu",
};
const fallbackColors = [
  ["#e8f1ff", "#2d67c8"],
  ["#e8f5ef", "#2b8060"],
  ["#fff0e8", "#c65b2d"],
  ["#f0eaff", "#6f4ab8"],
  ["#fff5d9", "#9a7418"],
  ["#e7f4f7", "#347786"],
] as const;

function stableColorIndex(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % fallbackColors.length;
}

function brandSrc(slug: string): string | null {
  return Object.hasOwn(brands, slug)
    ? `${import.meta.env.BASE_URL}brands/${slug}.svg`
    : null;
}

export function CompanyLogo({
  name,
  size = 38,
}: {
  name: string;
  size?: number;
}) {
  const knownSlug = Object.hasOwn(brandNames, name)
    ? brandNames[name]
    : null;
  const slug = knownSlug ?? "unknown";
  const src = brandSrc(slug);
  const [backgroundColor, foregroundColor] =
    fallbackColors[stableColorIndex(knownSlug ?? name)];
  // 腾讯是 5.5:1 宽字标：盒子按固有比例加宽（38 → 64），否则 contain 会压成细条。
  const width = slug === "tencent" ? Math.round((size * 64) / 38) : size;
  return (
    <span
      className={`company-logo brand-${slug}`}
      aria-hidden="true"
      style={{
        width,
        height: size,
        backgroundColor: src ? "#ffffff" : backgroundColor,
        color: foregroundColor,
      }}
    >
      {src ? (
        <img src={src} width={width} height={size} alt="" loading="lazy" />
      ) : (
        <span className="company-logo-initial">{name.trim().charAt(0) || "公"}</span>
      )}
    </span>
  );
}
export function CompanyName({ name }: { name: string }) {
  return (
    <span className="company-name">
      <CompanyLogo name={name} />
      <span>{name}</span>
    </span>
  );
}

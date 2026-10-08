import type { NextConfig } from "next";

// 默认 noindex/nofollow（Beta 站点不想被过早收录时零配置可用）；
// 站点准备好被搜索引擎收录时设 NEXT_PUBLIC_ALLOW_INDEXING=true 移除该头。
const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

const config: NextConfig = {
  agentRules: false,
  async headers() {
    if (allowIndexing) {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default config;

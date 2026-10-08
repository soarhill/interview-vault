import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { CurrentUserProvider } from "@/hooks/use-current-user";

// Umami 访问统计（可选）：两个变量同时非空才注入官方 tracker，留空即完全关闭、页面零改动。
// tracker 默认 auto-track 且已挂接 history API，App Router 客户端路由切换会自动统计，无需手动上报。
const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

export const metadata: Metadata = {
  title: "面个 Offer｜真实大厂面试问题",
  description:
    "来自真实面试记录的大厂面试问题库。筛选、搜索、阅读问题，复制到自己的 AI 继续学习。",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      {umamiScriptUrl && umamiWebsiteId && (
        <head>
          <script defer src={umamiScriptUrl} data-website-id={umamiWebsiteId} />
        </head>
      )}
      <body>
        <CurrentUserProvider>{children}</CurrentUserProvider>
      </body>
    </html>
  );
}

import type { ReactNode } from "react";

/**
 * App Router 的 template 在每次路由切换时重新挂载（layout 不重挂），
 * 为页面进入提供柔和的淡入动画（只用 opacity——transform 会创建
 * containing block，破坏页面内 position: sticky / fixed 的参照系）。
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

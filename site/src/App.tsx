import { useEffect, useRef, type ReactNode } from "react";
import {
  HashRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import { InterviewListPage } from "@/components/list/interview-list-page";
import { InterviewDetailPage } from "@/components/detail/interview-detail-page";
import { AboutPage } from "@/components/about/about-page";
import { NotFoundPage } from "@/pages/not-found";

/**
 * HashRouter：GitHub Pages 项目站没有服务端重写规则，
 * hash 路由保证深链接刷新 / 直接打开都不会 404。
 */
export function App() {
  return (
    <HashRouter>
      <PageEnter>
        <ScrollManager>
          <Routes>
            <Route path="/" element={<InterviewListPage />} />
            <Route path="/interview/:id" element={<InterviewDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ScrollManager>
      </PageEnter>
    </HashRouter>
  );
}

/** 路由切换柔和淡入（只动 opacity，避免 transform 创建 containing block 破坏 sticky）。 */
function PageEnter({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="page-enter" key={pathname}>
      {children}
    </div>
  );
}

/**
 * PUSH/REPLACE 且路由或页码变化时回到顶部；关键词与筛选变化保持滚动位置
 * （与完整版 scroll:false 一致）；POP（后退）由 useListRestore 恢复精确位置。
 */
function ScrollManager({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const navigationType = useNavigationType();
  const page = params.get("page");
  const previous = useRef({ path: location.pathname, page });
  useEffect(() => {
    const changed =
      previous.current.path !== location.pathname || previous.current.page !== page;
    previous.current = { path: location.pathname, page };
    if (navigationType !== "POP" && changed)
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [location, navigationType, page]);
  return <>{children}</>;
}

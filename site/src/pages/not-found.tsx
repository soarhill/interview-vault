import { SiteHeader } from "@/components/shared/brand";
import { SiteFooter } from "@/components/shared/site-footer";
import { PageState } from "@/components/shared/page-state";

export function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className="detail-container">
        <PageState title="页面不存在" action="返回列表" href="/" />
        <SiteFooter />
      </main>
    </>
  );
}

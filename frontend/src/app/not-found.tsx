import { SiteHeader } from "@/components/shared/brand";
import { PageState } from "@/components/shared/page-state";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="detail-container">
        <PageState title="页面不存在" action="返回列表" href="/" />
      </main>
    </>
  );
}

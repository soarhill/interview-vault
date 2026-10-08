"use client";
import { PageState } from "@/components/shared/page-state";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="detail-container">
      <PageState
        error
        title="页面读取失败"
        description="请重新加载后再试。"
        action="重新加载"
        onAction={reset}
      />
    </main>
  );
}

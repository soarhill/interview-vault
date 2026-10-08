import { Suspense } from "react";
import { InterviewDetailPage } from "@/components/detail/interview-detail-page";
import { Loading } from "@/components/shared/page-state";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <main className="detail-container">
          <Loading detail />
        </main>
      }
    >
      <InterviewDetailPage id={id} />
    </Suspense>
  );
}

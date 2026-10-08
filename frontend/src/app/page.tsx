import { Suspense } from "react";
import { InterviewListPage } from "@/components/list/interview-list-page";
import { Loading } from "@/components/shared/page-state";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="list-container">
          <Loading />
        </main>
      }
    >
      <InterviewListPage />
    </Suspense>
  );
}

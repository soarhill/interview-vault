"use client";
import { useCallback } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { SiteHeader } from "@/components/shared/brand";
import { Loading } from "@/components/shared/page-state";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { useResource } from "@/hooks/use-resource";
import { getMyInterview } from "@/lib/api/interviews";
import { SubmissionEditor } from "./submission-editor";
function ExistingSubmission({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getMyInterview(id, signal),
    [id],
  );
  const resource = useResource(`my-interview:${id}`, load);
  if (resource.status === "loading") return <Loading detail />;
  if (resource.status === "error")
    return <RequestFeedback error={resource.error} retry={resource.retry} />;
  return <SubmissionEditor initial={resource.data} />;
}
export function SubmissionEditPage({ id }: { id?: string }) {
  return (
    <>
      <SiteHeader />
      <main className="workspace-page editor-page">
        <AuthGate>
          {id ? <ExistingSubmission id={id} /> : <SubmissionEditor />}
        </AuthGate>
      </main>
    </>
  );
}

import { ApiError } from "@/lib/api/errors";
import type {
  AdminPublishedInterviewUpdateRequest,
  AdminReviewResponse,
  InterviewChangePayload,
  ResolveCandidateResponse,
} from "@/lib/api/types";

export function candidateResolved(
  detail: AdminReviewResponse,
  response: ResolveCandidateResponse,
): AdminReviewResponse {
  return {
    ...detail,
    interview: { ...detail.interview, ...response.interview },
    candidates: detail.candidates.filter(
      (candidate) => candidate.id !== response.resolvedCandidateId,
    ),
  };
}

export function reviewConflict(
  error: unknown,
): "version" | "handled" | "change-request" | "other" | null {
  if (!(error instanceof ApiError) || error.httpStatus !== 409) return null;
  if (error.code === "INTERVIEW_VERSION_CONFLICT") return "version";
  if (
    error.code === "INTERVIEW_STATUS_CONFLICT" ||
    error.code === "CANDIDATE_ALREADY_RESOLVED"
  )
    return "handled";
  if (error.code === "CHANGE_REQUEST_CONFLICT") return "change-request";
  return "other";
}

export function publishedUpdateRequest(
  payload: InterviewChangePayload,
  version: number,
  sourceUrls: string[],
): AdminPublishedInterviewUpdateRequest {
  const { sourceUrl, ...content } = payload;
  void sourceUrl;
  return { ...content, version, sourceUrls: [...sourceUrls] };
}

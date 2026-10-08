import { request } from "./client";
import type {
  AdminChangeRequestListItem,
  AdminChangeRequestResponse,
  AdminPublishedInterviewResponse,
  AdminPublishedInterviewUpdateRequest,
  AdminReviewListItem,
  AdminReviewResponse,
  ChangeRequestMutationResponse,
  ChangeRequestsQuery,
  InterviewMutationResponse,
  InterviewSaveResponse,
  InterviewUpsertRequest,
  PageResponse,
  PublishedInterview,
  ResolveCandidateRequest,
  ResolveCandidateResponse,
  ReviewsQuery,
} from "./types";

type Id = string | number;
const review = (id: Id) =>
  `/admin/reviews/interviews/${encodeURIComponent(id)}`;
const change = (id: Id) => `/admin/change-requests/${encodeURIComponent(id)}`;
const published = (id: Id) => `/admin/interviews/${encodeURIComponent(id)}`;
export const listReviews = (query: ReviewsQuery = {}, signal?: AbortSignal) =>
  request<PageResponse<AdminReviewListItem>>("/admin/reviews/interviews", {
    query,
    signal,
  });
export const getReviewDetail = (id: Id, signal?: AbortSignal) =>
  request<AdminReviewResponse>(review(id), { signal });
export const saveReview = (
  id: Id,
  body: InterviewUpsertRequest,
  signal?: AbortSignal,
) =>
  request<InterviewSaveResponse>(review(id), { method: "PUT", body, signal });
export const saveReviewInterview = saveReview;
export const resolveCandidate = (
  id: Id,
  candidateId: Id,
  body: ResolveCandidateRequest,
  signal?: AbortSignal,
) =>
  request<ResolveCandidateResponse>(
    `${review(id)}/candidates/${encodeURIComponent(candidateId)}/resolve`,
    { method: "POST", body, signal },
  );
export const publishInterview = (
  id: Id,
  version: number,
  signal?: AbortSignal,
) =>
  request<InterviewMutationResponse>(`${review(id)}/publish`, {
    method: "POST",
    body: { version },
    signal,
  });
export const rejectInterview = (
  id: Id,
  version: number,
  reason: string,
  signal?: AbortSignal,
) =>
  request<InterviewMutationResponse>(`${review(id)}/reject`, {
    method: "POST",
    body: { version, reason },
    signal,
  });
export const getAdminInterview = (id: Id, signal?: AbortSignal) =>
  request<AdminPublishedInterviewResponse>(published(id), { signal });
export const saveAdminInterview = (
  id: Id,
  body: AdminPublishedInterviewUpdateRequest,
  signal?: AbortSignal,
) =>
  request<InterviewSaveResponse<PublishedInterview>>(published(id), {
    method: "PUT",
    body,
    signal,
  });
export const listChangeRequests = (
  query: ChangeRequestsQuery = {},
  signal?: AbortSignal,
) =>
  request<PageResponse<AdminChangeRequestListItem>>("/admin/change-requests", {
    query,
    signal,
  });
export const getChangeRequest = (id: Id, signal?: AbortSignal) =>
  request<AdminChangeRequestResponse>(change(id), { signal });
export const getChangeRequestDetail = getChangeRequest;
export const approveChangeRequest = (id: Id, expectedRequestVersion: number, signal?: AbortSignal) =>
  request<ChangeRequestMutationResponse>(`${change(id)}/approve`, {
    method: "POST",
    body: { expectedRequestVersion },
    signal,
  });
export const rejectChangeRequest = (id: Id, expectedRequestVersion: number, signal?: AbortSignal) =>
  request<ChangeRequestMutationResponse>(`${change(id)}/reject`, {
    method: "POST",
    body: { expectedRequestVersion },
    signal,
  });

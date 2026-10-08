import { request } from "./client";
import type {
  DeleteDraftResponse,
  InterviewDetailResponse,
  InterviewFiltersResponse,
  InterviewList,
  InterviewMutationResponse,
  InterviewSaveResponse,
  InterviewUpsertRequest,
  ListQuery,
  MyChangeRequestResponse,
  MyInterviewDetailResponse,
  MyInterviewListResponse,
  MyInterviewsQuery,
  SaveChangeRequestRequest,
  ChangeRequestResponse,
} from "./types";

type Id = string | number;
const resource = (id: Id) => `/me/interviews/${encodeURIComponent(id)}`;
export const listInterviews = (query: ListQuery = {}, signal?: AbortSignal) =>
  request<InterviewList>("/interviews", { query, signal });
export const listInterviewFilters = (
  query: ListQuery = {},
  signal?: AbortSignal,
) => {
  const { companyId, positionCategory, recruitType, q } = query;
  return request<InterviewFiltersResponse>("/interview-filters", {
    query: { companyId, positionCategory, recruitType, q },
    signal,
  });
};
export const getInterviewDetail = (id: Id, signal?: AbortSignal) =>
  request<InterviewDetailResponse>(`/interviews/${encodeURIComponent(id)}`, {
    signal,
  });
export const createInterview = (signal?: AbortSignal) =>
  request<InterviewMutationResponse>("/me/interviews", {
    method: "POST",
    signal,
  });
export const listMyInterviews = (
  query: MyInterviewsQuery = {},
  signal?: AbortSignal,
) => request<MyInterviewListResponse>("/me/interviews", { query, signal });
export const getMyInterview = (id: Id, signal?: AbortSignal) =>
  request<MyInterviewDetailResponse>(resource(id), { signal });
export const getMyInterviewDetail = getMyInterview;
export const saveInterview = (
  id: Id,
  body: InterviewUpsertRequest,
  signal?: AbortSignal,
) =>
  request<InterviewSaveResponse>(resource(id), { method: "PUT", body, signal });
export const submitInterview = (
  id: Id,
  version: number,
  signal?: AbortSignal,
) =>
  request<InterviewMutationResponse>(`${resource(id)}/submit`, {
    method: "POST",
    body: { version },
    signal,
  });
export const deleteDraft = (id: Id, signal?: AbortSignal) =>
  request<DeleteDraftResponse>(resource(id), { method: "DELETE", signal });
export const getMyChangeRequest = (id: Id, signal?: AbortSignal) =>
  request<MyChangeRequestResponse>(`${resource(id)}/change-request`, {
    signal,
  });
export const saveChangeRequest = (
  id: Id,
  body: SaveChangeRequestRequest,
  signal?: AbortSignal,
) =>
  request<ChangeRequestResponse>(`${resource(id)}/change-request`, {
    method: "PUT",
    body,
    signal,
  });

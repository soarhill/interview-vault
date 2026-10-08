import { request } from "./client";
import type { Company, ItemsResponse, Position, Tag } from "./types";

export interface PositionCategoryOption {
  id: number;
  name: string;
}

export const listCompanies = (q = "", signal?: AbortSignal) =>
  request<ItemsResponse<Company>>("/companies", { query: { q }, signal });
export const listPositions = (
  query: { q?: string; categoryId?: number | string } = {},
  signal?: AbortSignal,
) => request<ItemsResponse<Position>>("/positions", { query, signal });
export const listTags = (q = "", signal?: AbortSignal) =>
  request<ItemsResponse<Tag>>("/tags", { query: { q }, signal });
export const listPositionCategories = (signal?: AbortSignal) =>
  request<ItemsResponse<PositionCategoryOption>>("/position-categories", {
    signal,
  });

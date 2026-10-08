import { request } from "./client";

export interface CheerCountResponse {
  count: number;
}

export const getCheers = (signal?: AbortSignal) =>
  request<CheerCountResponse>("/cheers", { signal });

export const postCheer = (signal?: AbortSignal) =>
  request<CheerCountResponse>("/cheers", { method: "POST", signal });

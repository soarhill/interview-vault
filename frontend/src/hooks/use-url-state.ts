"use client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  changeFilter,
  listUrl,
  readUrlState,
  type UrlState,
} from "@/lib/url-state";

export function useUrlState() {
  const params = useSearchParams();
  const router = useRouter();
  const state = readUrlState(params);
  return {
    state,
    change: (key: Exclude<keyof UrlState, "page">, value: string) =>
      router.push(listUrl(changeFilter(state, key, value)), { scroll: false }),
    page: (page: number) =>
      router.push(listUrl({ ...state, page }), { scroll: false }),
    reset: () => router.push("/", { scroll: false }),
  };
}

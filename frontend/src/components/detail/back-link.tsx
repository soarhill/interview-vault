"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { readListReturn, subscribeListReturn } from "@/lib/navigation";
import { Icon } from "../shared/icon";

export function BackLink({ id, company }: { id: string; company?: string }) {
  const router = useRouter();
  const fallbackHref = company
    ? `/?${new URLSearchParams({ companyId: company })}`
    : "/";
  const href = useSyncExternalStore(
    subscribeListReturn,
    () => readListReturn(`/interview/${id}`)?.url ?? fallbackHref,
    () => fallbackHref,
  );
  return (
    <Link
      href={href}
      className="back-link"
      scroll={false}
      onClick={(event) => {
        if (
          event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        router.push(href, { scroll: false });
      }}
    >
      <Icon name="back" size={18} />
      返回列表
    </Link>
  );
}

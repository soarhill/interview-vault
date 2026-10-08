import { Link, useNavigate } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { readListReturn, subscribeListReturn } from "@/lib/navigation";
import { Icon } from "../shared/icon";

export function BackLink({ id, company }: { id: string; company?: string }) {
  const navigate = useNavigate();
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
      to={href}
      className="back-link"
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
        navigate(href);
      }}
    >
      <Icon name="back" size={18} />
      返回列表
    </Link>
  );
}

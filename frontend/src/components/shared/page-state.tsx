import Link from "next/link";
import { Icon } from "./icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageState({
  title,
  description,
  action,
  onAction,
  href,
  error = false,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  href?: string;
  error?: boolean;
}) {
  return (
    <Card className="page-state" role={error ? "alert" : "status"}>
      <span className="state-symbol">
        <Icon name={error ? "alert" : "search"} size={28} />
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action &&
        (href ? (
          <Button className="primary-button" asChild>
            <Link href={href}>{action}</Link>
          </Button>
        ) : (
          <Button className="primary-button" onClick={onAction}>
            {action}
          </Button>
        ))}
    </Card>
  );
}
export function Loading({ detail = false }: { detail?: boolean }) {
  return (
    <div
      role="status"
      aria-label="正在加载面经"
      className={detail ? "detail-skeleton" : "card-grid"}
    >
      {Array.from({ length: detail ? 3 : 6 }, (_, index) => (
        <Card className="skeleton-card" key={index}>
          <Skeleton className="skeleton w-1/3" />
          <Skeleton className="skeleton w-4/5" />
          <Skeleton className="skeleton w-2/3" />
        </Card>
      ))}
      <span className="sr-only">正在加载面经</span>
    </div>
  );
}

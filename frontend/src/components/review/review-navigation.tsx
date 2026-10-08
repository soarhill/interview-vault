import Link from "next/link";
import styles from "./review-navigation.module.css";

export function ReviewNavigation({
  current,
  appearance,
}: {
  current: "reviews" | "changes";
  appearance?: "tabs";
}) {
  return (
    <nav className={appearance === "tabs" ? styles.tabs : "review-tabs"} aria-label="内容治理">
      <Link
        href="/admin/reviews"
        aria-current={current === "reviews" ? "page" : undefined}
      >
        投稿审核
      </Link>
      <Link
        href="/admin/change-requests"
        aria-current={current === "changes" ? "page" : undefined}
      >
        变更申请
      </Link>
    </nav>
  );
}

export function ReviewPagination({
  page,
  size,
  total,
  path,
}: {
  page: number;
  size: number;
  total: number;
  path: string;
}) {
  if (total <= size && page === 1) return null;
  const lastPage = Math.max(1, Math.ceil(total / size));
  return (
    <nav className="workspace-pager" aria-label="审核列表分页">
      {page > 1 ? (
        <Link href={page === 2 ? path : `${path}?page=${page - 1}`}>
          上一页
        </Link>
      ) : (
        <span aria-disabled="true">上一页</span>
      )}
      <span>
        第 {page} / {lastPage} 页
      </span>
      {page < lastPage ? (
        <Link href={`${path}?page=${page + 1}`}>下一页</Link>
      ) : (
        <span aria-disabled="true">下一页</span>
      )}
    </nav>
  );
}

export function reviewTime(value: string | null | undefined) {
  if (!value) return "时间未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

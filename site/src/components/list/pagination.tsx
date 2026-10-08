import { Button } from "@/components/ui/button";
import { Icon } from "../shared/icon";

export function Pagination({
  page,
  size,
  total,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(total / size);
  if (pages <= 1 && page === 1) return null;
  return (
    <nav className="pagination" aria-label="面经分页">
      <Button
        variant="outline"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        <Icon name="back" size={15} />
        上一页
      </Button>
      <span>
        第 {page} 页 / {Math.max(1, pages)} 页
      </span>
      <Button
        variant="outline"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
      >
        下一页
        <Icon name="arrow" size={15} />
      </Button>
    </nav>
  );
}

import { Icon } from "../shared/icon";
import { Button } from "@/components/ui/button";

export function ResultSummary({
  total,
  filtered,
  reset,
  loading,
}: {
  total?: number;
  filtered: boolean;
  reset: () => void;
  loading: boolean;
}) {
  return (
    <div className="result-summary" id="results">
      <p aria-live="polite">
        {total === undefined ? (
          loading ? (
            "正在查找面经…"
          ) : (
            "结果暂不可用"
          )
        ) : (
          <>
            共找到 <strong>{total}</strong> 份面经
          </>
        )}
      </p>
      <div className="summary-actions">
        {filtered && (
          <Button variant="ghost" className="text-button" onClick={reset}>
            <Icon name="reset" size={15} />
            重置
          </Button>
        )}
        <span className="sort-label">
          <Icon name="sort" size={14} />
          最新优先
        </span>
      </div>
    </div>
  );
}

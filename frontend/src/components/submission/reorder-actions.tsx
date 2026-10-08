import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ReorderActions({
  label,
  index,
  total,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="editor-toolbar">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`上移${label}`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`下移${label}`}
        disabled={index === total - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`删除${label}`}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}

import type { CSSProperties } from "react";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

const icons = {
  book: BookOpen,
  search: Search,
  arrow: ArrowRight,
  back: ArrowLeft,
  copy: Copy,
  check: Check,
  chevron: ChevronDown,
  external: ExternalLink,
  close: X,
  file: FileText,
  reset: RotateCcw,
  alert: TriangleAlert,
  sort: ArrowDownWideNarrow,
};
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: keyof typeof icons;
  size?: number;
  style?: CSSProperties;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      aria-hidden="true"
      size={size}
      strokeWidth={1.8}
      style={{ width: size, height: size, ...style }}
    />
  );
}

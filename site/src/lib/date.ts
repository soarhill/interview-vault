import type { DatePrecision } from "./types";
export function formatInterviewDate(
  date: string | null | undefined,
  precision: DatePrecision | null | undefined,
): string {
  if (!date || !precision) return "";
  if (precision === "YEAR") return `${date.slice(0, 4)}年`;
  if (precision === "MONTH")
    return `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;
  return date.slice(0, 10);
}

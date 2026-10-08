import { highlightParts } from "@/lib/highlight";

export function Highlight({ text, q = "" }: { text: string; q?: string }) {
  return highlightParts(text, q).map((part, index) =>
    part.highlighted ? <mark key={index}>{part.text}</mark> : part.text,
  );
}

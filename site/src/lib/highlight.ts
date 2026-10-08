export interface TextPart {
  text: string;
  highlighted: boolean;
}

export function highlightParts(text: string, q: string): TextPart[] {
  const terms = [...new Set(q.trim().split(/\s+/).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!terms.length) return [{ text, highlighted: false }];
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const expression = new RegExp(escaped.join("|"), "giu");
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    const index = match.index;
    if (index > cursor)
      parts.push({ text: text.slice(cursor, index), highlighted: false });
    parts.push({ text: match[0], highlighted: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), highlighted: false });
  return parts;
}

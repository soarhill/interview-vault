import type { Interview } from "@/lib/types";
import { externalHref } from "@/lib/url";
import { Icon } from "../shared/icon";

export function SourceLinks({
  sources,
  result,
}: {
  sources: Interview["sources"];
  result?: string | null;
}) {
  return (
    <footer className="source-links">
      {result && <p>原记录结果：{result}</p>}
      {sources.length > 0 && (
        <>
          <h2>原始来源</h2>
          <ol>
            {sources.map((source, index) => (
              <li key={source.id}>
                {externalHref(source.url) ? (
                  <a
                    href={externalHref(source.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    来源 {index + 1}
                    <span>{source.url}</span>
                    <Icon name="external" size={13} />
                  </a>
                ) : (
                  <span>
                    来源 {index + 1}
                    <span>{source.url}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </footer>
  );
}

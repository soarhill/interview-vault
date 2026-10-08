"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { listCompanies, listPositions, listTags } from "@/lib/api/catalog";
import type { SelectionInput } from "@/lib/api/types";

interface CatalogItem {
  id: number;
  name: string;
}
type Kind = "company" | "position" | "tag";
function CatalogSearch({
  kind,
  label,
  selectedIds = [],
  onSelect,
  onPropose,
  allowProposed = true,
  autoFocus = false,
}: {
  kind: Kind;
  label: string;
  selectedIds?: number[];
  onSelect: (item: CatalogItem) => void;
  onPropose: (name: string) => void;
  allowProposed?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setFailed(false);
      try {
        const response =
          kind === "company"
            ? await listCompanies(query, signal)
            : kind === "position"
              ? await listPositions({ q: query }, signal)
              : await listTags(query, signal);
        if (!signal.aborted) setItems(response.items);
      } catch {
        if (!signal.aborted) setFailed(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [kind, query],
  );
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, load]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  function finish(action: () => void) {
    action();
    setQuery("");
    setOpen(false);
  }
  return (
    <div className="editor-catalog" ref={root}>
      <label className="sr-only" htmlFor={id}>
        搜索{label}
      </label>
      <input
        id={id}
        type="search"
        className="editor-input"
        placeholder={`搜索${label}名称`}
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-controls={`${id}-results`}
        onFocus={() => {
          setLoading(true);
          setOpen(true);
        }}
        onChange={(event) => {
          setLoading(true);
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div
          id={`${id}-results`}
          className="editor-catalog-results"
          aria-label={`${label}搜索结果`}
        >
          {loading && (
            <p className="editor-help" role="status">
              正在查找…
            </p>
          )}
          {failed && (
            <p className="editor-error" role="alert">
              目录暂时无法加载，请重新输入搜索。
            </p>
          )}
          {!loading && !failed && items.length === 0 && (
            <p className="editor-help">暂未找到相关{label}。</p>
          )}
          {!loading &&
            !failed &&
            items.map((item) => (
              <button
                type="button"
                className="editor-catalog-option"
                key={item.id}
                disabled={selectedIds.includes(item.id)}
                onClick={() => finish(() => onSelect(item))}
              >
                {item.name}
                {selectedIds.includes(item.id) && <span>已添加</span>}
              </button>
            ))}
          {query.trim() && (
            <button
              type="button"
              className="editor-catalog-option editor-propose"
              onClick={() => finish(() => onPropose(query.trim()))}
            >
              ＋ 新增{label}「{query.trim()}」
              <small>
                {allowProposed
                  ? "目录里还没有，随本次投稿一起审核"
                  : "保存时由管理员创建正式目录"}
              </small>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SingleCatalogSelector({
  kind,
  label,
  value,
  onChange,
}: {
  kind: "company" | "position";
  label: string;
  value: SelectionInput;
  onChange: (value: SelectionInput) => void;
}) {
  // 自由文本（与部门一致）：用户直接打字提交，不强制从目录挑选；
  // 联想只是顺手帮忙——点了建议关联正式目录，不理会就作为新增候选由管理员归并。
  const [text, setText] = useState("");
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.existingId == null) return;
    const controller = new AbortController();
    const request =
      kind === "company"
        ? listCompanies("", controller.signal)
        : listPositions({}, controller.signal);
    request
      .then((response) => {
        if (controller.signal.aborted) return;
        setFetchedName(
          response.items.find((item) => item.id === value.existingId)?.name ??
            null,
        );
      })
      .catch(() => {
        /* 显示兜底「#id」，输入功能不受影响。 */
      });
    return () => controller.abort();
  }, [kind, value.existingId]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const query = text.trim();
  useEffect(() => {
    if (!open || !query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      const request =
        kind === "company"
          ? listCompanies(query, controller.signal)
          : listPositions({ q: query }, controller.signal);
      request
        .then((response) => {
          if (!controller.signal.aborted) {
            setItems(response.items);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setFailed(true);
            setLoading(false);
          }
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, kind]);

  const resolvedName = value.existingId == null ? null : fetchedName;
  const shown = text !== "" ? text : (resolvedName ?? value.proposedName ?? "");
  const matches = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="editor-field" data-field={kind}>
      <span className="editor-label">
        {label} <span aria-hidden="true">*</span>
      </span>
      <div className="editor-catalog" ref={root}>
        <input
          type="text"
          className="editor-input"
          placeholder={kind === "company" ? "如 字节跳动" : "如 Java 后端开发"}
          value={shown}
          autoComplete="off"
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            const trimmed = next.trim();
            onChange(
              trimmed
                ? { existingId: null, proposedName: trimmed }
                : { existingId: null, proposedName: null },
            );
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && query !== "" && (
          <div
            className="editor-catalog-results"
            aria-label={`${label}联想`}
          >
            {loading && (
              <p className="editor-help" role="status">
                正在查找…
              </p>
            )}
            {failed && (
              <p className="editor-help" role="alert">
                联想暂时不可用，直接填写即可，管理员会统一归并。
              </p>
            )}
            {!loading &&
              !failed &&
              matches.map((item) => (
                <button
                  type="button"
                  className="editor-catalog-option"
                  key={item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setText(item.name);
                    onChange({ existingId: item.id, proposedName: null });
                    setOpen(false);
                  }}
                >
                  {item.name}
                </button>
              ))}
            {!loading && !failed && matches.length === 0 && (
              <p className="editor-help">
                目录里还没有「{query}」，将作为新增提交，由管理员确认归并。
              </p>
            )}
          </div>
        )}
      </div>
      <p className="editor-help">
        目录里没有{label}也没关系，直接填写即可，管理员会统一归并。
      </p>
    </div>
  );
}
export function CompanySelector({
  value,
  onChange,
}: {
  value: SelectionInput;
  onChange: (value: SelectionInput) => void;
  allowProposed?: boolean;
}) {
  return <SingleCatalogSelector value={value} onChange={onChange} kind="company" label="公司" />;
}
export function PositionSelector({
  value,
  onChange,
}: {
  value: SelectionInput;
  onChange: (value: SelectionInput) => void;
  allowProposed?: boolean;
}) {
  return <SingleCatalogSelector value={value} onChange={onChange} kind="position" label="岗位" />;
}
/** 常见考点快选（正式标签中最常用的 12 个）：点一下即选/取消；目录里没有时走新增候选。 */
const QUICK_TAGS = [
  "场景设计", "Agent", "RAG", "AI Coding", "Memory", "评测",
  "Java", "JUC", "MySQL", "Redis", "网络", "MCP",
];

export function TagSelector({
  tagIds,
  proposedTags,
  onChange,
  allowProposed = true,
}: {
  tagIds: number[];
  proposedTags: string[];
  onChange: (tagIds: number[], proposedTags: string[]) => void;
  allowProposed?: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    listTags("", controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setCatalog(response.items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tagIds]);
  return (
    <div className="editor-field" data-field="tags">
      <span className="editor-label">
        标签 / 考点 <small>可选</small>
      </span>
      <div className="editor-chip-list">
        {tagIds.map((id) => (
          <span className="editor-chip" key={id}>
            {catalog.find((item) => item.id === id)?.name ?? `标签 #${id}`}
            <button
              type="button"
              aria-label={`移除标签 ${catalog.find((item) => item.id === id)?.name ?? id}`}
              onClick={() =>
                onChange(
                  tagIds.filter((item) => item !== id),
                  proposedTags,
                )
              }
            >
              ×
            </button>
          </span>
        ))}
        {proposedTags.map((name, index) => (
          <span className="editor-chip" key={`${name}:${index}`}>
            {name}
            <small>{allowProposed ? "待审核" : "保存时创建"}</small>
            <button
              type="button"
              aria-label={`移除标签 ${name}`}
              onClick={() =>
                onChange(
                  tagIds,
                  proposedTags.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <CatalogSearch
        kind="tag"
        label="标签"
        selectedIds={tagIds}
        allowProposed={allowProposed}
        onSelect={(item) => {
          setCatalog((previous) => [
            ...previous.filter((tag) => tag.id !== item.id),
            item,
          ]);
          onChange([...tagIds, item.id], proposedTags);
        }}
        onPropose={(name) => onChange(tagIds, [...proposedTags, name])}
      />
      <div className="tag-quick-row" aria-label="常见考点">
        {QUICK_TAGS.map((name) => {
          const official = catalog.find(
            (item) => item.name.toLowerCase() === name.toLowerCase(),
          );
          const picked = official
            ? tagIds.includes(official.id)
            : proposedTags.some(
                (item) => item.toLowerCase() === name.toLowerCase(),
              );
          return (
            <button
              type="button"
              key={name}
              className={`tag-quick-chip${picked ? " tag-quick-chip-on" : ""}`}
              aria-pressed={picked}
              onClick={() => {
                if (true) {
                  if (official) {
                    onChange(
                      picked
                        ? tagIds.filter((id) => id !== official.id)
                        : [...tagIds, official.id],
                      proposedTags,
                    );
                  } else if (picked) {
                    onChange(
                      tagIds,
                      proposedTags.filter(
                        (item) => item.toLowerCase() !== name.toLowerCase(),
                      ),
                    );
                  } else {
                    onChange(tagIds, [...proposedTags, name]);
                  }
                }
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="editor-help">
        选择最能描述这份面经的标签即可，不需要为每道问题都添加。
      </p>
    </div>
  );
}

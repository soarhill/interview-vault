"use client";

import { useCallback, useDeferredValue, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDown, Check, Search, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestFeedback } from "@/components/shared/request-feedback";
import { useResource } from "@/hooks/use-resource";
import {
  listCompanies,
  listPositionCategories,
  listPositions,
  listTags,
} from "@/lib/api/catalog";
import type { Candidate, ResolveCandidateRequest } from "@/lib/api/types";
import styles from "./review-workbench.module.css";

export function CandidateResolver({
  candidate,
  version,
  disabled,
  pending,
  onResolve,
  index = 0,
}: {
  candidate: Candidate;
  version: number;
  disabled: boolean;
  pending: boolean;
  onResolve: (candidateId: number, request: ResolveCandidateRequest) => void;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(candidate.value);
  const [categoryName, setCategoryName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(
    null,
  );
  const search = useDeferredValue(query);
  const categoryResource = useResource(
    "position-categories",
    useCallback(
      async (signal: AbortSignal) =>
        (await listPositionCategories(signal)).items,
      [],
    ),
    candidate.type === "POSITION" && creating,
  );
  const typeLabel =
    candidate.type === "COMPANY"
      ? "公司"
      : candidate.type === "POSITION"
        ? "岗位"
        : "标签";
  const load = useCallback(
    async (signal: AbortSignal) => {
      const response =
        candidate.type === "COMPANY"
          ? await listCompanies(search, signal)
          : candidate.type === "POSITION"
            ? await listPositions({ q: search }, signal)
            : await listTags(search, signal);
      return response.items;
    },
    [candidate.type, search],
  );
  const resource = useResource(
    `candidate:${candidate.id}:${search}`,
    load,
    open && !creating,
  );

  function confirmExisting(targetId: number) {
    if (!disabled)
      onResolve(candidate.id, { version, action: "USE_EXISTING", targetId });
  }

  return (
    <section
      className={styles.candidate}
      id={`review-candidate-${candidate.id}`}
      tabIndex={-1}
      aria-label={`${typeLabel}候选：${candidate.value}`}
      aria-busy={pending}
    >
      <div className={styles.candidateHeading}>
        <span className={styles.step}>{index + 1}</span>
        <h3>{typeLabel}</h3>
        <span className={styles.userProposed}>用户提交</span>
        {pending && (
          <LoaderCircle
            className={styles.spinner}
            size={16}
            aria-hidden="true"
          />
        )}
      </div>
      <div className={styles.candidateBody}>
        <p className={styles.candidateValue}>{candidate.value}</p>
        {creating ? (
          <div className={styles.createCatalog}>
            <label htmlFor={`candidate-name-${candidate.id}`}>
              正式{typeLabel}名称
            </label>
            <input
              id={`candidate-name-${candidate.id}`}
              className={styles.catalogInput}
              value={name}
              disabled={disabled}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            {candidate.type === "POSITION" && (
              <>
                <label htmlFor={`candidate-category-${candidate.id}`}>
                  岗位方向（决定首页筛选归属）
                </label>
                {newCategory ? (
                  <div className={styles.newCategoryRow}>
                    <input
                      className={styles.catalogInput}
                      value={newCategory}
                      disabled={disabled}
                      autoFocus
                      placeholder="新方向名称，如 算法"
                      onChange={(event) => setNewCategory(event.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => setNewCategory("")}
                    >
                      改选已有
                    </Button>
                  </div>
                ) : (
                  <select
                    id={`candidate-category-${candidate.id}`}
                    className={styles.catalogInput}
                    value={categoryName}
                    disabled={disabled}
                    onChange={(event) => {
                      if (event.target.value === "__new__") {
                        setNewCategory(" ");
                        return;
                      }
                      setCategoryName(event.target.value);
                    }}
                  >
                    <option value="">默认「其他」</option>
                    {categoryResource.status === "success" &&
                      categoryResource.data.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    <option value="__new__">＋ 新建方向…</option>
                  </select>
                )}
                <p className={styles.catalogHint}>
                  新岗位名称照常创建；方向决定它出现在首页哪一档筛选里，不够用可以随手新建。
                </p>
              </>
            )}
            <div className={styles.candidateActions}>
              <Button
                size="sm"
                disabled={disabled || !name.trim()}
                onClick={() =>
                  onResolve(candidate.id, {
                    version,
                    action: "CREATE_NEW",
                    name: name.trim(),
                    ...(candidate.type === "POSITION"
                      ? {
                          categoryName:
                            newCategory.trim() || categoryName || null,
                        }
                      : {}),
                  })
                }
              >
                确认创建
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => setCreating(false)}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={styles.catalogSelect}
                  disabled={disabled}
                  aria-label={`选择正式${typeLabel}`}
                >
                  {selected?.name || `选择正式${typeLabel}`}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className={styles.catalogPopover}
                  align="start"
                  sideOffset={5}
                  collisionPadding={12}
                  aria-label={`搜索正式${typeLabel}`}
                >
                  <div className={styles.catalogSearch}>
                    <Search size={15} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label={`搜索${typeLabel}名称`}
                      placeholder={`搜索${typeLabel}名称`}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  {resource.status === "loading" && (
                    <p className={styles.catalogHint} role="status">
                      正在查找…
                    </p>
                  )}
                  {resource.status === "error" && (
                    <RequestFeedback
                      error={resource.error}
                      retry={resource.retry}
                    />
                  )}
                  {resource.status === "success" && (
                    <div
                      className={styles.catalogOptions}
                      role="group"
                      aria-label={`${typeLabel}搜索结果`}
                    >
                      {resource.data.length === 0 && (
                        <p className={styles.catalogHint}>
                          未找到正式项，可返回创建新{typeLabel}。
                        </p>
                      )}
                      {resource.data.map((item) => (
                        <button
                          type="button"
                          className={styles.catalogOption}
                          key={item.id}
                          disabled={disabled}
                          onClick={() => {
                            setSelected(item);
                            setOpen(false);
                          }}
                        >
                          {item.name}
                          {selected?.id === item.id && (
                            <Check size={15} aria-hidden="true" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            {selected && (
              <div className={styles.selectedCatalog}>
                <span>已选择：{selected.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => confirmExisting(selected.id)}
                >
                  确认使用
                </Button>
              </div>
            )}
            {!selected && candidate.suggestedMatches.length > 0 && (
              <div className={styles.suggestions}>
                <p>相似候选</p>
                {candidate.suggestedMatches.map((item) => (
                  <div key={item.id}>
                    <span>{item.name}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`确认使用${typeLabel}「${item.name}」`}
                      onClick={() => confirmExisting(item.id)}
                    >
                      确认
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.candidateLinks}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setName(candidate.value);
                  setCreating(true);
                }}
              >
                目录里没有？创建新{typeLabel}
              </button>
              {candidate.type === "TAG" && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onResolve(candidate.id, { version, action: "REMOVE" })
                  }
                >
                  移除标签
                </button>
              )}
            </div>
          </>
        )}
        {pending && (
          <span className={styles.catalogHint} role="status">
            正在确认…
          </span>
        )}
      </div>
    </section>
  );
}

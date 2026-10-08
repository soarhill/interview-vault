"use client";
import type { InterviewFiltersResponse } from "@/lib/types";
import { useEffect, useRef } from "react";
import { type UrlState } from "@/lib/url-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyLogo } from "../shared/company";

interface Option {
  value: string;
  name: string;
  count: number;
}
function FilterRow({
  label,
  field,
  value,
  options,
  totalCount,
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  options: Option[];
  /** 「全部」= 当前筛选条件下的全部面经数；分类计数之和可能小于它（如岗位未说明的历史记录）。 */
  totalCount: number;
  onChange: (value: string) => void;
}) {
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (field !== "company") return;
    const container = chips.current;
    const selected = container?.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    if (
      !container ||
      !selected ||
      container.scrollWidth <= container.clientWidth
    )
      return;
    const left =
      container.scrollLeft +
      selected.getBoundingClientRect().left -
      container.getBoundingClientRect().left;
    container.scrollTo({
      left: left - (container.clientWidth - selected.clientWidth) / 2,
      behavior: "instant",
    });
  }, [field, value]);
  const allCount = totalCount;
  const selectedUnknown =
    value && !options.some((item) => item.value === value);
  return (
    <div className={`filter-row filter-${field}`}>
      <span className="filter-label" id={`label-${field}`}>
        {label}
      </span>
      <div
        className="filter-chips"
        ref={chips}
        role="group"
        aria-labelledby={`label-${field}`}
      >
        <Button
          variant="ghost"
          className="filter-chip"
          aria-pressed={!value}
          onClick={() => onChange("")}
        >
          <span className="filter-option-name">全部</span>
          <span>{allCount}</span>
        </Button>
        {options.map((option) => (
          <Button
            variant="ghost"
            key={option.value}
            className="filter-chip"
            aria-pressed={value === option.value}
            disabled={option.count === 0 && value !== option.value}
            onClick={() => onChange(option.value)}
          >
            {field === "company" && (
              <CompanyLogo name={option.name} size={26} />
            )}
            <span className="filter-option-name">{option.name}</span>
            <span className="filter-count">{option.count}</span>
          </Button>
        ))}
        {selectedUnknown && (
          <Button
            variant="ghost"
            className="filter-chip"
            aria-pressed="true"
            onClick={() => onChange("")}
          >
            <span className="filter-option-name">{value}</span>
            <span>0</span>
          </Button>
        )}
      </div>
      {field !== "company" && (
        <Select
        value={value || "all"}
        onValueChange={(selected) =>
          onChange(selected === "all" ? "" : selected)
        }
      >
        <SelectTrigger className="mobile-select" aria-label={`${label}筛选`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          collisionPadding={16}
          align="start"
          className="filter-select-menu"
        >
          <SelectItem value="all">全部 ({allCount})</SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.count === 0 && value !== option.value}
            >
              {option.name} ({option.count})
            </SelectItem>
          ))}
          {selectedUnknown && (
            <SelectItem value={value}>{value} (0)</SelectItem>
          )}
        </SelectContent>
        </Select>
      )}
    </div>
  );
}
export function FilterBar({
  filters,
  state,
  onChange,
}: {
  filters: InterviewFiltersResponse;
  state: UrlState;
  onChange: (
    key: "companyId" | "positionCategory" | "recruitType",
    value: string,
  ) => void;
}) {
  return (
    <section className="filter-bar" aria-label="筛选面经">
      <FilterRow
        label="公司"
        field="company"
        value={state.companyId}
        totalCount={filters.companyTotal}
        options={filters.companies.map((item) => ({
          value: String(item.id),
          name: item.name,
          count: item.count,
        }))}
        onChange={(value) => onChange("companyId", value)}
      />
      <div className="secondary-filters">
        <FilterRow
          label="岗位"
          field="role"
          value={state.positionCategory}
          totalCount={filters.positionCategoryTotal}
          options={filters.positionCategories.map((item) => ({
            value: item.value,
            name: item.label,
            count: item.count,
          }))}
          onChange={(value) => onChange("positionCategory", value)}
        />
        <FilterRow
          label="招聘类型"
          field="type"
          value={state.recruitType}
          totalCount={filters.recruitTypeTotal}
          options={filters.recruitTypes.map((item) => ({
            value: item.value,
            name: item.label,
            count: item.count,
          }))}
          onChange={(value) => onChange("recruitType", value)}
        />
      </div>
    </section>
  );
}

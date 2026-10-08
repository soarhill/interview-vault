"use client";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "../shared/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar({
  q,
  onSearch,
}: {
  q: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(q);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(draft);
  }
  // 部分内嵌 WebView 不触发表单隐式提交，Enter 显式兜底；preventDefault 避免真浏览器里双触发。
  function press(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch(draft);
    }
  }
  return (
    <form className="search-bar" role="search" onSubmit={submit}>
      <Icon name="search" size={21} />
      <label className="sr-only" htmlFor="interview-search">
        搜索岗位、公司或面试问题
      </label>
      <div className="search-field">
        <Input
          id="interview-search"
          type="search"
          enterKeyHint="search"
          placeholder="搜索岗位、公司或面试问题"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={press}
          maxLength={100}
          autoComplete="off"
        />
        {!draft && (
          <span className="mobile-search-hint" aria-hidden="true">
            <span className="search-hint-full">搜索岗位、公司或面试问题</span>
            <span className="search-hint-compact">公司、岗位、面试题</span>
          </span>
        )}
      </div>
      <Button type="submit" className="search-submit">
        搜索
        <Icon name="arrow" size={16} />
      </Button>
    </form>
  );
}

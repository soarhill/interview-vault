"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { CalendarIcon, ChevronDown, XIcon } from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import styles from "./round-date-picker.module.css";

export function RoundDatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
}) {
  const selected = value ? parseISO(value) : undefined;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const dateLabel = selected ? format(selected, "yyyy年M月d日") : "选择日期";
  const firstYear = 2026;
  const lastYear = 2027;

  function changeOpen(next: boolean) {
    if (next) setMonth(startOfMonth(selected ?? new Date()));
    setOpen(next);
  }

  function clearDate() {
    onChange(null);
    setOpen(false);
  }

  return (
    <div className={styles.field}>
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`editor-input ${styles.trigger}`}
            data-empty={!value}
            title={value ? dateLabel : undefined}
            aria-label={value ? `面试日期：${dateLabel}` : "选择面试日期"}
          >
            <CalendarIcon size={17} aria-hidden="true" />
            <span>{dateLabel}</span>
            {!value && <ChevronDown size={15} aria-hidden="true" />}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.popover}
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label="选择面试日期"
          >
            <Calendar
              className={styles.calendar}
              mode="single"
              locale={zhCN}
              weekStartsOn={1}
              captionLayout="dropdown"
              startMonth={new Date(firstYear, 0)}
              endMonth={new Date(lastYear, 11)}
              disabled={{
                before: new Date(firstYear, 0, 1),
                after: new Date(lastYear, 11, 31),
              }}
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              autoFocus
              formatters={{
                formatMonthDropdown: (date) => format(date, "M月"),
                formatYearDropdown: (date) => format(date, "yyyy年"),
                formatWeekdayName: (date) => format(date, "EEEEE", { locale: zhCN }),
              }}
              labels={{
                labelPrevious: () => "上个月",
                labelNext: () => "下个月",
                labelMonthDropdown: () => "选择月份",
                labelYearDropdown: () => "选择年份",
              }}
              onSelect={(date) => {
                onChange(date ? format(date, "yyyy-MM-dd") : null);
                setOpen(false);
              }}
            />
            <div className={styles.footer}>
              <span>不确定日期，可以留空</span>
              <button type="button" disabled={!value} onClick={clearDate}>
                清空日期
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="清除面试日期"
          onClick={clearDate}
        >
          <XIcon size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addMonths,
  buildDatePresets,
  endOfDay,
  formatShortDate,
  isSameCalendarDay,
  startOfDay,
  startOfMonth,
} from "@/lib/date-presets";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function cellButtonClassName(active = false) {
  return cn(
    "inline-flex min-h-7 w-full items-center justify-center rounded-md px-1 text-xs transition-colors outline-none hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring",
    active ? "text-foreground" : "text-muted-foreground",
  );
}

function buildCalendarDays(viewMonth) {
  const monthStart = startOfMonth(viewMonth);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function MiniCalendar({ selectedTimestamp, viewMonth, onViewMonthChange, onSelectDay }) {
  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-[252px] p-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onViewMonthChange(addMonths(viewMonth, -1))}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button
          type="button"
          onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1 font-medium">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayTimestamp = endOfDay(day).getTime();
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isSelected = isSameCalendarDay(selectedTimestamp, dayTimestamp);
          const isToday = isSameCalendarDay(Date.now(), dayTimestamp);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-xs transition-colors",
                !isCurrentMonth && "text-muted-foreground/45",
                isCurrentMonth && "text-foreground",
                isToday && !isSelected && "ring-1 ring-foreground/15",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && "hover:bg-muted",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatePickerPanel({
  selectedTimestamp,
  onSelectTimestamp,
  onClear,
  clearLabel = "No date",
}) {
  const presets = buildDatePresets();
  const [viewMonth, setViewMonth] = useState(() =>
    selectedTimestamp
      ? startOfMonth(new Date(Number(selectedTimestamp)))
      : startOfMonth(new Date()),
  );

  useEffect(() => {
    if (selectedTimestamp) {
      setViewMonth(startOfMonth(new Date(Number(selectedTimestamp))));
    }
  }, [selectedTimestamp]);

  function handlePresetSelect(timestamp) {
    setViewMonth(startOfMonth(new Date(timestamp)));
    onSelectTimestamp(timestamp);
  }

  function handleDaySelect(day) {
    const timestamp = endOfDay(day).getTime();
    setViewMonth(startOfMonth(day));
    onSelectTimestamp(timestamp);
  }

  return (
    <div className="flex">
      <div className="min-w-52 border-r border-border/60 p-1">
        <DropdownMenuItem onClick={onClear}>{clearLabel}</DropdownMenuItem>
        {presets.map((preset) => {
          const presetTimestamp = preset.date.getTime();
          const isActive = isSameCalendarDay(selectedTimestamp, presetTimestamp);

          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handlePresetSelect(presetTimestamp)}
              className={cn(
                "flex items-center justify-between gap-6",
                isActive && "bg-muted",
              )}
            >
              <span>{preset.label}</span>
              <span className="text-xs text-muted-foreground">{preset.hint}</span>
            </DropdownMenuItem>
          );
        })}
      </div>

      <MiniCalendar
        selectedTimestamp={selectedTimestamp}
        viewMonth={viewMonth}
        onViewMonthChange={setViewMonth}
        onSelectDay={handleDaySelect}
      />
    </div>
  );
}

export function DatePresetPicker({
  value,
  onChange,
  placeholder = null,
  className,
}) {
  const [open, setOpen] = useState(false);
  const displayDate = formatShortDate(value);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cn(cellButtonClassName(Boolean(displayDate)), className)} />
        }
      >
        {displayDate ? (
          displayDate
        ) : (
          placeholder ?? <Calendar className="size-3.5 text-muted-foreground/35" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-auto overflow-hidden p-0">
        <DatePickerPanel
          selectedTimestamp={value}
          onSelectTimestamp={(timestamp) => {
            onChange(timestamp);
            setOpen(false);
          }}
          onClear={() => {
            onChange(null);
            setOpen(false);
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TimelinePresetPicker({
  timeline,
  onChange,
  className,
}) {
  const [open, setOpen] = useState(false);
  const selectedEnd = timeline?.end_date ?? null;
  const range = timeline?.start_date && timeline?.end_date
    ? {
        start: formatShortDate(timeline.start_date),
        end: formatShortDate(timeline.end_date),
      }
    : timeline?.end_date
      ? {
          start: formatShortDate(timeline.end_date),
          end: formatShortDate(timeline.end_date),
        }
      : null;

  function applyEndDate(timestamp) {
    onChange({
      start_date: startOfDay(new Date()).getTime(),
      end_date: timestamp,
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cn(cellButtonClassName(Boolean(range)), className)} />
        }
      >
        {range ? (
          <span>
            {range.start}
            <span className="mx-1 text-muted-foreground/50">→</span>
            {range.end}
          </span>
        ) : (
          <Calendar className="size-3.5 text-muted-foreground/35" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-auto overflow-hidden p-0">
        <DatePickerPanel
          selectedTimestamp={selectedEnd}
          clearLabel="No timeline"
          onSelectTimestamp={(timestamp) => {
            applyEndDate(timestamp);
            setOpen(false);
          }}
          onClear={() => {
            onChange({ start_date: null, end_date: null });
            setOpen(false);
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

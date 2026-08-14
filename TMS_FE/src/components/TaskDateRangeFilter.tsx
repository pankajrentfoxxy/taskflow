'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { TaskDueDateFilterMode } from '@/lib/util';
import { cn } from '@/lib/utils';

export default function TaskDateRangeFilter({
  mode,
  fromDate,
  toDate,
  onModeChange,
  onFromDateChange,
  onToDateChange,
  onReset,
  showReset = false,
  onlineCount,
  className,
}: {
  mode: TaskDueDateFilterMode;
  fromDate: string;
  toDate: string;
  onModeChange: (mode: TaskDueDateFilterMode) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onReset?: () => void;
  showReset?: boolean;
  onlineCount?: number | null;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'today' as const, label: 'Today' },
            { key: 'range' as const, label: 'Date range' },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant={mode === opt.key ? 'default' : 'outline'}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onModeChange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
        {onlineCount != null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            aria-live="polite"
            className="h-8 cursor-default rounded-full px-3 text-xs font-normal text-muted-foreground hover:bg-background"
          >
            <span className="relative mr-1.5 flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {onlineCount} user{onlineCount === 1 ? '' : 's'} online
          </Button>
        )}
      </div>
      {mode === 'range' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="Due from date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="Due to date"
          />
        </div>
      )}
      {showReset && onReset && (
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-muted-foreground" onClick={onReset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}

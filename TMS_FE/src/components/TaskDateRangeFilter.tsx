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
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex gap-1.5">
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

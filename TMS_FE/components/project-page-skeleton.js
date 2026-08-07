import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROW_GRID =
  "grid grid-cols-[minmax(220px,2fr)_72px_88px_96px_112px_72px_120px] items-center gap-3 px-3";

function TaskRowSkeleton() {
  return (
    <div className={cn(ROW_GRID, "min-h-9 border-b border-border/40 py-2")}>
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="size-3.5 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-[min(100%,12rem)]" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="size-6 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="size-3.5" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function StatusGroupSkeleton({ rows = 4 }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="flex w-full items-center gap-2 border-b border-border/40 px-3 py-2.5">
        <Skeleton className="size-4 shrink-0" />
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-3 w-4" />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className={cn(
              ROW_GRID,
              "border-b border-border/40 py-2 text-[11px] font-medium uppercase tracking-wide",
            )}
          >
            <Skeleton className="h-3 w-10" />
            <Skeleton className="mx-auto h-3 w-12" />
            <Skeleton className="mx-auto h-3 w-14" />
            <Skeleton className="mx-auto h-3 w-12" />
            <Skeleton className="mx-auto h-3 w-10" />
            <Skeleton className="mx-auto h-3 w-14" />
            <Skeleton className="mx-auto h-3 w-14" />
          </div>

          {Array.from({ length: rows }).map((_, index) => (
            <TaskRowSkeleton key={index} />
          ))}

          <div className="flex items-center gap-2 px-3 py-2.5">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24 shrink-0 rounded-lg" />
      </div>

      <div className="space-y-3">
        <StatusGroupSkeleton rows={5} />
        <StatusGroupSkeleton rows={3} />
        <StatusGroupSkeleton rows={2} />
      </div>
    </div>
  );
}

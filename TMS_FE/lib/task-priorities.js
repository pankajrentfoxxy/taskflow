import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export const TASK_PRIORITIES = [
  {
    value: "urgent",
    label: "Urgent",
    textClass: "text-red-500",
    flagClass: "fill-red-500 text-red-500",
    filled: true,
  },
  {
    value: "high",
    label: "High",
    textClass: "text-amber-500",
    flagClass: "fill-amber-400 text-amber-500",
    filled: true,
  },
  {
    value: "medium",
    label: "Normal",
    textClass: "text-sky-500",
    flagClass: "fill-sky-500 text-sky-500",
    filled: true,
  },
  {
    value: "low",
    label: "Low",
    textClass: "text-zinc-500",
    flagClass: "text-zinc-400",
    filled: false,
  },
];

export function getPriorityConfig(priority) {
  return (
    TASK_PRIORITIES.find((item) => item.value === priority) ??
    TASK_PRIORITIES.find((item) => item.value === "medium")
  );
}

export function PriorityDisplay({ priority, className }) {
  const config = getPriorityConfig(priority);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        config.textClass,
        className,
      )}
    >
      <Flag
        className={cn(
          "size-3.5 shrink-0",
          config.flagClass,
          config.filled && "fill-current",
        )}
      />
      <span>{config.label}</span>
    </span>
  );
}

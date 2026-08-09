"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function parseTaskTargetValue(value) {
  if (value === "" || value == null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function TargetNumberInput({
  id,
  label,
  value,
  onChange,
  disabled,
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Optional"
        disabled={disabled}
        className="mt-2 max-w-xs"
      />
    </div>
  );
}

export function TaskTargetFields({
  alias,
  targetValue,
  targetCompletedValue,
  onTargetChange,
  onTargetCompletedChange,
  disabled = false,
  className,
}) {
  if (!alias) {
    return null;
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className || ""}`}>
      <TargetNumberInput
        id="task-target"
        label={`Target — how many ${alias}?`}
        value={targetValue}
        onChange={onTargetChange}
        disabled={disabled}
      />
      <TargetNumberInput
        id="task-target-completed"
        label={`Completed — how many ${alias}?`}
        value={targetCompletedValue}
        onChange={onTargetCompletedChange}
        disabled={disabled}
      />
    </div>
  );
}

// Backward-compatible single-field export.
export function TaskTargetField({
  alias,
  value,
  onChange,
  disabled = false,
  id = "task-target",
  className,
}) {
  if (!alias) {
    return null;
  }

  return (
    <div className={className}>
      <TargetNumberInput
        id={id}
        label={`Target — how many ${alias}?`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

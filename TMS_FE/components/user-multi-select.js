"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function getUserLabel(user) {
  return user?.full_name || user?.email || `User #${user?.user_id}`;
}

export function UserMultiSelect({
  users = [],
  value = [],
  onChange,
  excludeUserId,
  placeholder = "Select members",
  emptyMessage = "No users available",
  className,
}) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const selectableUsers = useMemo(
    () => users.filter((user) => user.user_id !== excludeUserId),
    [users, excludeUserId],
  );

  const selectedUsers = useMemo(
    () =>
      value
        .map((userId) => users.find((user) => user.user_id === userId))
        .filter(Boolean),
    [value, users],
  );

  function toggleUser(userId) {
    if (selectedSet.has(userId)) {
      onChange(value.filter((id) => id !== userId));
      return;
    }
    onChange([...value, userId]);
  }

  function removeUser(userId) {
    onChange(value.filter((id) => id !== userId));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-9 w-full justify-between px-2.5 py-2 font-normal"
            />
          }
        >
          <span className="truncate text-left text-sm">
            {selectedUsers.length === 0
              ? placeholder
              : `${selectedUsers.length} member${
                  selectedUsers.length === 1 ? "" : "s"
                } selected`}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--anchor-width)] p-0">
          <div className="max-h-56 overflow-y-auto p-1">
            {selectableUsers.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              selectableUsers.map((user) => {
                const isSelected = selectedSet.has(user.user_id);

                return (
                  <button
                    key={user.user_id}
                    type="button"
                    onClick={() => toggleUser(user.user_id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isSelected && "bg-accent/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input",
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {getUserLabel(user)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <li
              key={user.user_id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
            >
              <span className="truncate">{getUserLabel(user)}</span>
              <button
                type="button"
                onClick={() => removeUser(user.user_id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Remove ${getUserLabel(user)}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

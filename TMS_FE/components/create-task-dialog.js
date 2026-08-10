"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ListChecks,
  MoreHorizontal,
  Tag,
  Users,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PriorityDisplay, TASK_PRIORITIES } from "@/lib/task-priorities";
import {
  getAssigneeLabel,
  TaskAssigneePickerContent,
} from "@/components/task-assignee-picker";
import {
  getVisibleTaskTypes,
  reconcileTaskTypeSelection,
} from "@/lib/task-type-visibility";
import {
  parseTaskTargetValue,
  TaskTargetFields,
} from "@/components/task-target-field";

const PRIORITIES = TASK_PRIORITIES;

const initialForm = {
  name: "",
  description: "",
  task_status_id: "",
  task_type_id: "",
  assignee_ids: [],
  assignee_team_id: "",
  due_date: "",
  priority: "medium",
  target: "",
  target_completed: "",
};

function chipClassName(active) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none",
    active
      ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15"
      : "bg-background/70 text-muted-foreground ring-1 ring-foreground/10 hover:bg-background hover:text-foreground",
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  projectName = "Project",
  statuses = [],
  taskTypes = [],
  members = [],
  teams = [],
  defaultStatusId = "",
  onCreated,
}) {
  const { token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dateInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setForm(initialForm);
      setError("");
      setSubmitting(false);
      return;
    }

    const defaultTaskTypes = getVisibleTaskTypes(taskTypes, [], teams);

    setForm({
      ...initialForm,
      task_status_id: defaultStatusId
        ? String(defaultStatusId)
        : statuses[0]?.task_status_id
          ? String(statuses[0].task_status_id)
          : "",
      task_type_id: defaultTaskTypes[0]?.task_type_id
        ? String(defaultTaskTypes[0].task_type_id)
        : "",
    });
  }, [open, statuses, taskTypes, teams, defaultStatusId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTaskTypeId(value) {
    const nextType = visibleTaskTypes.find(
      (type) => String(type.task_type_id) === value,
    );
    setForm((current) => ({
      ...current,
      task_type_id: value,
      target: nextType?.alias ? current.target : "",
      target_completed: nextType?.alias ? current.target_completed : "",
    }));
  }

  const visibleTaskTypes = getVisibleTaskTypes(
    taskTypes,
    form.assignee_ids,
    teams,
    form.assignee_team_id,
    form.task_type_id,
  );

  const selectedStatus = statuses.find(
    (status) => String(status.task_status_id) === form.task_status_id,
  );
  const selectedType = taskTypes.find(
    (type) => String(type.task_type_id) === form.task_type_id,
  );

  function updateAssignees({ assigneeIds, assigneeTeamId }) {
    setForm((current) => {
      const nextAssigneeIds = assigneeIds.map(String);
      const nextAssigneeTeamId = assigneeTeamId || "";
      const typeSelection = reconcileTaskTypeSelection({
        taskTypes,
        assigneeIds: nextAssigneeIds,
        teams,
        assigneeTeamId: nextAssigneeTeamId,
        taskTypeId: current.task_type_id,
        target: current.target,
        targetCompleted: current.target_completed,
      });

      return {
        ...current,
        assignee_ids: nextAssigneeIds,
        assignee_team_id: nextAssigneeTeamId,
        ...typeSelection,
      };
    });
  }

  function getAssigneeChipLabel() {
    return getAssigneeLabel({
      members,
      teams,
      assigneeIds: form.assignee_ids,
      assigneeTeamId: form.assignee_team_id,
    });
  }

  function formatDueDateLabel(value) {
    if (!value) return "Due date";
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || submitting || !projectId) return;

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Task name is required.");
      return;
    }

    if (!form.task_status_id) {
      setError("Task status is required.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const payload = {
        name: trimmedName,
        description: form.description.trim() || "",
        task_status_id: Number(form.task_status_id),
        priority: form.priority,
      };

      if (form.task_type_id) {
        payload.task_type_id = Number(form.task_type_id);
      }

      if (selectedType?.alias) {
        payload.target = parseTaskTargetValue(form.target);
        payload.target_completed = parseTaskTargetValue(form.target_completed);
      }

      if (form.assignee_ids.length > 0) {
        payload.assignee_ids = form.assignee_ids.map(Number);
      }

      if (form.due_date) {
        payload.due_date = new Date(`${form.due_date}T00:00:00`).getTime();
      }

      const data = await apiPost(
        `/projects/${projectId}/tasks`,
        payload,
        { token },
      );

      if (data.task) {
        onCreated?.(data.task);
      }

      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not create task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3 pr-14">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1.5 text-sm text-foreground ring-1 ring-foreground/10">
              <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[160px] truncate">{projectName}</span>
            </div>
          </div>

          <div className="space-y-1 bg-muted/10 px-5 py-6">
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Task Name"
              maxLength={255}
              autoFocus
              className="w-full bg-transparent text-2xl font-semibold tracking-tight placeholder:text-muted-foreground outline-none"
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Add description"
              rows={5}
              className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground outline-none"
            />

            <TaskTargetFields
              alias={selectedType?.alias}
              targetValue={form.target}
              targetCompletedValue={form.target_completed}
              onTargetChange={(value) => updateField("target", value)}
              onTargetCompletedChange={(value) =>
                updateField("target_completed", value)
              }
              className="mt-4"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button type="button" className={chipClassName(true)} />
                }
              >
                {selectedStatus ? selectedStatus.name.toUpperCase() : "STATUS"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuRadioGroup
                  value={form.task_status_id}
                  onValueChange={(value) =>
                    updateField("task_status_id", value)
                  }
                >
                  {statuses.map((status) => (
                    <DropdownMenuRadioItem
                      key={status.task_status_id}
                      value={String(status.task_status_id)}
                    >
                      {status.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={chipClassName(form.assignee_ids.length > 0)}
                  />
                }
              >
                <Users className="size-3.5 shrink-0" />
                <span className="truncate">{getAssigneeChipLabel()}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 min-w-52">
                <TaskAssigneePickerContent
                  members={members}
                  teams={teams}
                  assigneeIds={form.assignee_ids}
                  assigneeTeamId={form.assignee_team_id}
                  onChange={updateAssignees}
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() =>
                dateInputRef.current?.showPicker?.() ||
                dateInputRef.current?.click()
              }
              className={chipClassName(Boolean(form.due_date))}
            >
              <Calendar className="size-3.5 shrink-0" />
              <span className="truncate">{formatDueDateLabel(form.due_date)}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={form.due_date}
              onChange={(event) => updateField("due_date", event.target.value)}
              className="sr-only"
              tabIndex={-1}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={chipClassName(form.priority !== "medium")}
                  />
                }
              >
                <PriorityDisplay priority={form.priority} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-36">
                <DropdownMenuRadioGroup
                  value={form.priority}
                  onValueChange={(value) => updateField("priority", value)}
                >
                  {PRIORITIES.map((priority) => (
                    <DropdownMenuRadioItem
                      key={priority.value}
                      value={priority.value}
                      className="gap-2"
                    >
                      <PriorityDisplay priority={priority.value} />
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={chipClassName(Boolean(form.task_type_id))}
                  />
                }
              >
                <Tag className="size-3.5 shrink-0" />
                <span className="truncate">{selectedType?.name || "Type"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuRadioGroup
                  value={form.task_type_id}
                  onValueChange={updateTaskTypeId}
                >
                  <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
                  {visibleTaskTypes.map((type) => (
                    <DropdownMenuRadioItem
                      key={type.task_type_id}
                      value={String(type.task_type_id)}
                    >
                      {type.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-md bg-background/70 text-muted-foreground ring-1 ring-foreground/10 hover:bg-background hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      assignee_ids: [],
                      assignee_team_id: "",
                      due_date: "",
                      priority: "medium",
                      task_type_id: "",
                    }))
                  }
                >
                  Clear optional fields
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {error ? (
            <p className="px-4 pb-2 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !token}>
              {submitting ? "Creating..." : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

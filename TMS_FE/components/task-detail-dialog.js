"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Circle,
  ListChecks,
  Tag,
  Users,
} from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  TimelinePresetPicker,
} from "@/components/date-preset-picker";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { TaskDrawDialog } from "@/components/task-draw-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PriorityDisplay, TASK_PRIORITIES } from "@/lib/task-priorities";

const PRIORITIES = TASK_PRIORITIES;

function chipClassName(active) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none",
    active
      ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15"
      : "bg-background/70 text-muted-foreground ring-1 ring-foreground/10 hover:bg-background hover:text-foreground",
  );
}

function timestampToDateInput(value) {
  if (!value) return "";
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskToForm(task) {
  return {
    name: task?.name || "",
    description: task?.description || "",
    task_status_id: task?.task_status_id ? String(task.task_status_id) : "",
    task_type_id: task?.task_type_id ? String(task.task_type_id) : "",
    assignee_ids: (task?.assignee_ids ||
      task?.assignees?.map((assignee) => assignee.user_id) ||
      []
    ).map(String),
    due_date: timestampToDateInput(task?.due_date),
    priority: task?.priority || "medium",
    timeline: task?.timeline || { start_date: null, end_date: null },
    scribble: task?.scribble ?? null,
  };
}

function formatDueDateLabel(value) {
  if (!value) return "Due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTimestampLabel(value) {
  if (!value) return "";
  return new Date(Number(value)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getUserLabel(user) {
  return user?.full_name || user?.email || (user?.user_id ? `User #${user.user_id}` : "Someone");
}

function formatActivityMessage(activity) {
  if (activity.description?.trim()) {
    return activity.description;
  }

  switch (activity.action) {
    case "task.create":
      return "Created this task";
    case "task.update":
      return "Updated this task";
    case "task.delete":
      return "Deleted this task";
    case "subtask.create":
      return "Created a subtask";
    case "comment.create":
      return "Added a comment";
    case "comment.update":
      return "Updated a comment";
    default:
      return activity.action?.replaceAll(".", " ") || "Activity";
  }
}

async function loadTaskActivity(token, projectId, taskId) {
  const data = await apiGet(
    `/projects/${projectId}/tasks/${taskId}/activity`,
    { token },
  );
  return data.activities || [];
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  projectId,
  projectName = "Project",
  taskId,
  task: initialTask,
  token,
  statuses = [],
  taskTypes = [],
  members = [],
  onUpdated,
}) {
  const [task, setTask] = useState(initialTask);
  const [form, setForm] = useState(() => taskToForm(initialTask));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [scribbleOpen, setScribbleOpen] = useState(false);
  const dateInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setError("");
      setSaving(false);
      setScribbleOpen(false);
      return;
    }

    setTask(initialTask);
    setForm(taskToForm(initialTask));
    setActivities([]);

    if (!token || !projectId || !taskId) return;

    let alive = true;
    setLoading(true);
    setActivityLoading(true);
    setError("");

    Promise.all([
      apiGet(`/projects/${projectId}/tasks/${taskId}`, { token }),
      loadTaskActivity(token, projectId, taskId),
    ])
      .then(([taskData, activityItems]) => {
        if (!alive) return;
        setTask(taskData.task);
        setForm(taskToForm(taskData.task));
        setActivities(activityItems);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "Could not load task details.");
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setActivityLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [open, token, projectId, taskId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleAssignee(userId) {
    const id = String(userId);
    setForm((current) => ({
      ...current,
      assignee_ids: current.assignee_ids.includes(id)
        ? current.assignee_ids.filter((value) => value !== id)
        : [...current.assignee_ids, id],
    }));
  }

  const selectedStatus = statuses.find(
    (status) => String(status.task_status_id) === form.task_status_id,
  );
  const selectedType = taskTypes.find(
    (type) => String(type.task_type_id) === form.task_type_id,
  );
  const selectedAssignees = members.filter((member) =>
    form.assignee_ids.includes(String(member.user_id)),
  );

  function getAssigneeLabel() {
    if (selectedAssignees.length === 0) return "Assignees";
    if (selectedAssignees.length === 1) {
      const member = selectedAssignees[0];
      return (
        member.user?.full_name ||
        member.user?.email ||
        `User #${member.user_id}`
      );
    }
    return `${selectedAssignees.length} assignees`;
  }

  async function handleSave() {
    if (!token || !projectId || !taskId || saving) return;

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Task name is required.");
      return;
    }

    if (!form.task_status_id) {
      setError("Task status is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: trimmedName,
        description: form.description.trim() || "",
        task_status_id: Number(form.task_status_id),
        priority: form.priority,
        timeline: form.timeline,
      };

      payload.task_type_id = form.task_type_id
        ? Number(form.task_type_id)
        : null;
      payload.assignee_ids = form.assignee_ids.map(Number);
      payload.due_date = form.due_date
        ? new Date(`${form.due_date}T00:00:00`).getTime()
        : null;

      const data = await apiPatch(
        `/projects/${projectId}/tasks/${taskId}`,
        payload,
        { token },
      );

      setTask(data.task);
      setForm(taskToForm(data.task));
      onUpdated?.(data.task);
      if (token) {
        loadTaskActivity(token, projectId, taskId)
          .then(setActivities)
          .catch(() => {});
      }
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not save task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="flex max-h-[90vh] w-[min(96vw,1024px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1024px]"
        >
          <div className="flex items-center gap-2 border-b bg-muted/20 px-4 py-3">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1.5 text-sm text-foreground ring-1 ring-foreground/10">
              <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[180px] truncate">{projectName}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    disabled={loading || saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1.5 text-sm text-foreground ring-1 ring-foreground/10 outline-none hover:bg-background disabled:opacity-60"
                  />
                }
              >
                <Circle className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{selectedType?.name || "Task"}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuRadioGroup
                  value={form.task_type_id}
                  onValueChange={(value) => updateField("task_type_id", value)}
                >
                  <DropdownMenuRadioItem value="">Task</DropdownMenuRadioItem>
                  {taskTypes.map((type) => (
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
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-h-0 overflow-y-auto">
              <div className="space-y-1 bg-muted/10 px-5 py-6">
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Task name"
                  maxLength={255}
                  disabled={loading || saving}
                  className="w-full bg-transparent text-2xl font-semibold tracking-tight placeholder:text-muted-foreground outline-none disabled:opacity-60"
                />
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Add description"
                  rows={6}
                  disabled={loading || saving}
                  className="mt-3 w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground outline-none disabled:opacity-60"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        disabled={loading || saving}
                        className={chipClassName(true)}
                      />
                    }
                  >
                    {selectedStatus
                      ? selectedStatus.name.toUpperCase()
                      : "STATUS"}
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
                        disabled={loading || saving}
                        className={chipClassName(form.assignee_ids.length > 0)}
                      />
                    }
                  >
                    <Users className="size-3.5 shrink-0" />
                    <span className="truncate">{getAssigneeLabel()}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-60 min-w-48">
                    <DropdownMenuItem onClick={() => updateField("assignee_ids", [])}>
                      Clear assignees
                    </DropdownMenuItem>
                    {members.map((member) => (
                      <DropdownMenuCheckboxItem
                        key={member.user_id}
                        checked={form.assignee_ids.includes(String(member.user_id))}
                        onCheckedChange={() => toggleAssignee(member.user_id)}
                      >
                        {member.user?.full_name ||
                          member.user?.email ||
                          `User #${member.user_id}`}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  disabled={loading || saving}
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
                        disabled={loading || saving}
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
                        disabled={loading || saving}
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
                      onValueChange={(value) => updateField("task_type_id", value)}
                    >
                      <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
                      {taskTypes.map((type) => (
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

                <div className="inline-flex">
                  <TimelinePresetPicker
                    timeline={form.timeline}
                    onChange={(value) => updateField("timeline", value)}
                    className={chipClassName(
                      Boolean(form.timeline?.start_date || form.timeline?.end_date),
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || saving || !token}
                  onClick={() => setScribbleOpen(true)}
                >
                  Scribble
                </Button>
              </div>

              {task ? (
                <section className="space-y-4 border-t px-5 py-4">
                  <h3 className="text-sm font-medium text-foreground">Details</h3>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Created</span>
                      <p className="mt-1">
                        {formatTimestampLabel(task.created_at) || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Creator</span>
                      <p className="mt-1">
                        {task.creator?.full_name ||
                          task.creator?.email ||
                          (task.created_by ? `User #${task.created_by}` : "—")}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Comments</span>
                      <p className="mt-1">{task.comment_count ?? 0}</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <section className="flex min-h-0 flex-col border-t bg-muted/10 lg:border-t-0 lg:border-l">
              <div className="shrink-0 border-b px-4 py-3">
                <h3 className="text-sm font-medium text-foreground">Activity</h3>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {activityLoading ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Loading activity…
                  </p>
                ) : activities.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No activity yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {activities.map((activity) => (
                      <li
                        key={activity.activity_id}
                        className="rounded-lg border bg-background/80 px-3 py-2.5"
                      >
                        <p className="text-xs leading-relaxed text-foreground">
                          <span className="font-medium">
                            {getUserLabel(activity.user)}
                          </span>
                          {activity.type === "comment" ? (
                            <>
                              {" commented "}
                              <span className="text-muted-foreground">
                                {activity.description}
                              </span>
                            </>
                          ) : (
                            <> {formatActivityMessage(activity)}</>
                          )}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatTimestampLabel(activity.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {error ? (
            <p className="border-t px-4 py-2 text-xs text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="border-t bg-muted/20 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !token}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TaskDrawDialog
        projectId={projectId}
        taskId={taskId}
        taskName={form.name || task?.name}
        token={token}
        scribble={form.scribble}
        open={scribbleOpen}
        onOpenChange={setScribbleOpen}
        onSaved={(updatedTask) => {
          setTask(updatedTask);
          setForm((current) => ({
            ...current,
            scribble: updatedTask.scribble ?? null,
          }));
          onUpdated?.(updatedTask);
        }}
      />
    </>
  );
}

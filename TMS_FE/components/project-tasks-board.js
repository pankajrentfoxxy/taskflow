"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Diamond,
  Flag,
  MessageSquare,
  Plus,
  UserRound,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DatePresetPicker,
  TimelinePresetPicker,
} from "@/components/date-preset-picker";
import { TaskCommentsPopover } from "@/components/task-comments-popover";
import { DrawCell } from "@/components/task-draw-dialog";
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
import {
  PriorityDisplay,
  TASK_PRIORITIES,
} from "@/lib/task-priorities";

const PRIORITIES = TASK_PRIORITIES;

const ROW_GRID =
  "grid grid-cols-[minmax(220px,2fr)_72px_88px_96px_112px_72px_120px_48px] items-center gap-3 px-3";

const STATUS_STYLES = {
  "to do": {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300",
    dot: "text-sky-600 stroke-sky-600 dark:text-sky-500 dark:stroke-sky-500",
  },
  "awaiting response": {
    badge: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-200",
    dot: "text-zinc-500 stroke-zinc-500 dark:text-zinc-400 dark:stroke-zinc-400",
  },
  "in progress": {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300",
    dot: "text-sky-600 stroke-sky-600 dark:text-sky-500 dark:stroke-sky-500",
  },
  completed: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300",
    dot: "text-emerald-600 stroke-emerald-600 dark:text-emerald-500 dark:stroke-emerald-500",
  },
  acknowledged: {
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300",
    dot: "text-violet-600 stroke-violet-600 dark:text-violet-500 dark:stroke-violet-500",
  },
  cancelled: {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300",
    dot: "text-rose-600 stroke-rose-600 dark:text-rose-500 dark:stroke-rose-500",
  },
  escalated: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300",
    dot: "text-amber-700 stroke-amber-700 dark:text-amber-500 dark:stroke-amber-500",
  },
};

const FALLBACK_STATUS_STYLES = [
  {
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300",
    dot: "text-indigo-600 stroke-indigo-600 dark:text-indigo-500 dark:stroke-indigo-500",
  },
  {
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300",
    dot: "text-teal-600 stroke-teal-600 dark:text-teal-500 dark:stroke-teal-500",
  },
  {
    badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/80 dark:text-fuchsia-300",
    dot: "text-fuchsia-600 stroke-fuchsia-600 dark:text-fuchsia-500 dark:stroke-fuchsia-500",
  },
  {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300",
    dot: "text-orange-600 stroke-orange-600 dark:text-orange-500 dark:stroke-orange-500",
  },
  {
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300",
    dot: "text-cyan-600 stroke-cyan-600 dark:text-cyan-500 dark:stroke-cyan-500",
  },
];

function getStatusStyle(name) {
  const key = name?.toLowerCase().trim() ?? "";
  if (STATUS_STYLES[key]) {
    return STATUS_STYLES[key];
  }

  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = key.charCodeAt(index) + ((hash << 5) - hash);
  }

  return FALLBACK_STATUS_STYLES[
    Math.abs(hash) % FALLBACK_STATUS_STYLES.length
  ];
}


function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatusDot({ statusName, className }) {
  const style = getStatusStyle(statusName);

  return (
    <Circle
      className={cn("shrink-0 fill-current", style.dot, className)}
    />
  );
}

function TaskStatusDot({ statusId, statusName, statuses, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/80"
            aria-label="Change task status"
          />
        }
      >
        <StatusDot statusName={statusName} className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-60 min-w-44">
        <DropdownMenuRadioGroup
          value={String(statusId)}
          onValueChange={(value) => onChange(Number(value))}
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
  );
}

function TaskTypeIcon({ typeName }) {
  const normalized = typeName?.toLowerCase() ?? "task";

  if (normalized.includes("milestone")) {
    return <Diamond className="size-3.5 shrink-0 text-muted-foreground" />;
  }

  if (normalized.includes("meeting")) {
    return <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />;
  }

  return (
    <Circle
      className="size-3.5 shrink-0 text-muted-foreground"
      strokeDasharray="2 2"
    />
  );
}

function StatusBadge({ name, className }) {
  const style = getStatusStyle(name);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        style.badge,
        className,
      )}
    >
      <StatusDot statusName={name} className="size-3" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function cellButtonClassName(active = false) {
  return cn(
    "inline-flex min-h-7 w-full items-center justify-center rounded-md px-1 text-xs transition-colors outline-none hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring",
    active ? "text-foreground" : "text-muted-foreground",
  );
}

function AssigneeCell({ assignees = [], members = [], onChange }) {
  const selectedIds = assignees.map((assignee) => String(assignee.user_id));

  function toggleAssignee(userId) {
    const id = String(userId);
    const nextIds = selectedIds.includes(id)
      ? selectedIds.filter((value) => value !== id)
      : [...selectedIds, id];
    onChange(nextIds.map(Number));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cellButtonClassName(assignees.length > 0)} />
        }
      >
        {assignees.length ? (
          <AvatarGroup className="justify-center">
            {assignees.slice(0, 3).map((assignee) => (
              <Avatar key={assignee.user_id} size="sm">
                <AvatarFallback className="text-[10px] font-medium">
                  {getInitials(assignee.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        ) : (
          <UserRound className="size-3.5 text-muted-foreground/35" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-60 min-w-44">
        <DropdownMenuItem onClick={() => onChange([])}>Clear assignees</DropdownMenuItem>
        {members.map((member) => (
          <DropdownMenuCheckboxItem
            key={member.user_id}
            checked={selectedIds.includes(String(member.user_id))}
            onCheckedChange={() => toggleAssignee(member.user_id)}
          >
            {member.user?.full_name ||
              member.user?.email ||
              `User #${member.user_id}`}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DueDateCell({ dueDate, onChange }) {
  return <DatePresetPicker value={dueDate} onChange={onChange} />;
}

function TimelineCell({ timeline, onChange }) {
  return <TimelinePresetPicker timeline={timeline} onChange={onChange} />;
}

function PriorityCell({ priority, editable = false, onChange }) {
  if (!editable) {
    return (
      <div className="flex justify-center">
        <PriorityDisplay priority={priority} />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cellButtonClassName(true)} />
        }
      >
        <PriorityDisplay priority={priority} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-36">
        <DropdownMenuRadioGroup
          value={priority}
          onValueChange={(value) => onChange(value)}
        >
          {PRIORITIES.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              className="gap-2"
            >
              <PriorityDisplay priority={item.value} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuItem onClick={() => onChange("medium")}>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="size-3.5" />
            Clear
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusCell({ statusId, statusName, statuses, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={cellButtonClassName(true)} />
        }
      >
        <StatusBadge name={statusName || "Unknown"} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="max-h-60 min-w-44">
        <DropdownMenuRadioGroup
          value={String(statusId)}
          onValueChange={(value) => onChange(Number(value))}
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
  );
}

function TaskRowShell({
  children,
  saving = false,
  isDraft = false,
  isSubtask = false,
  rowRef,
  onFocusOut,
}) {
  return (
    <div
      ref={rowRef}
      onFocusOut={onFocusOut}
      className={cn(
        ROW_GRID,
        "group min-h-9 border-b border-border/40 py-2 text-sm transition-colors",
        isDraft ? "bg-muted/20" : "hover:bg-muted/30",
        isSubtask && "bg-muted/10",
        saving && "opacity-60",
      )}
    >
      {children}
    </div>
  );
}

function EditableTaskRow({
  task,
  projectId,
  token,
  statuses,
  members,
  isSubtask = false,
  onAddSubtask,
  subtaskCount = 0,
  expanded = false,
  onToggleExpand,
  onUpdated,
}) {
  const [name, setName] = useState(task.name);
  const [saving, setSaving] = useState(false);
  const showExpandControl = !isSubtask && subtaskCount > 0;

  useEffect(() => {
    setName(task.name);
  }, [task.task_id, task.name]);

  async function patchTask(updates) {
    if (!token || saving) return;

    setSaving(true);
    try {
      const data = await apiPatch(
        `/projects/${projectId}/tasks/${task.task_id}`,
        updates,
        { token },
      );
      onUpdated?.(data.task);
    } finally {
      setSaving(false);
    }
  }

  async function handleNameBlur() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === task.name) {
      setName(task.name);
      return;
    }
    await patchTask({ name: trimmed });
  }

  return (
    <TaskRowShell saving={saving} isSubtask={isSubtask}>
      <div className="flex min-w-0 items-center gap-1">
        {showExpandControl ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ) : null}

        {isSubtask ? <span className="ml-5 shrink-0" aria-hidden /> : null}

        <TaskStatusDot
          statusId={task.task_status_id}
          statusName={task.status?.name}
          statuses={statuses}
          onChange={(value) => patchTask({ task_status_id: value })}
        />

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-full min-w-0 rounded bg-transparent px-1 text-sm outline-none focus:bg-background focus:ring-1 focus:ring-ring"
        />

        {!isSubtask && onAddSubtask ? (
          <button
            type="button"
            onClick={onAddSubtask}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted hover:text-foreground"
            aria-label="Add subtask"
            title="Add subtask"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>

      <AssigneeCell
        assignees={task.assignees}
        members={members}
        onChange={(assigneeIds) => patchTask({ assignee_ids: assigneeIds })}
      />

      <DueDateCell
        dueDate={task.due_date}
        onChange={(value) => patchTask({ due_date: value })}
      />

      <PriorityCell
        priority={task.priority}
        editable
        onChange={(value) => patchTask({ priority: value })}
      />

      <StatusCell
        statusId={task.task_status_id}
        statusName={task.status?.name}
        statuses={statuses}
        onChange={(value) => patchTask({ task_status_id: value })}
      />

      <TaskCommentsPopover
        projectId={projectId}
        taskId={task.task_id}
        token={token}
        commentCount={task.comment_count ?? 0}
        onCommentCountChange={(count) =>
          onUpdated?.({ ...task, comment_count: count })
        }
      />

      <TimelineCell
        timeline={task.timeline}
        onChange={(value) => patchTask({ timeline: value })}
      />

      <DrawCell
        projectId={projectId}
        taskId={task.task_id}
        taskName={task.name}
        token={token}
        scribble={task.scribble}
        onSaved={onUpdated}
      />
    </TaskRowShell>
  );
}

function DraftTaskRow({
  draft,
  projectId,
  token,
  statuses,
  members,
  parentTaskId = null,
  onDraftChange,
  onCreated,
  onCancel,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef(null);
  const status = statuses.find(
    (item) => item.task_status_id === draft.task_status_id,
  );

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  async function handleSave() {
    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError("Task name is required.");
      nameInputRef.current?.focus();
      return;
    }

    if (!token || saving) {
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        task_status_id: draft.task_status_id,
        priority: draft.priority,
      };

      if (draft.assignee_ids.length > 0) {
        payload.assignee_ids = draft.assignee_ids;
      }

      if (draft.due_date) {
        payload.due_date = draft.due_date;
      }

      if (draft.timeline?.start_date || draft.timeline?.end_date) {
        payload.timeline = draft.timeline;
      }

      if (draft.task_type_id) {
        payload.task_type_id = draft.task_type_id;
      }

      const endpoint = parentTaskId
        ? `/projects/${projectId}/tasks/${parentTaskId}/subtasks`
        : `/projects/${projectId}/tasks`;

      const data = await apiPost(endpoint, payload, {
        token,
      });
      onCreated?.(data.task);
    } catch (err) {
      setError(err.message || "Could not create task.");
    } finally {
      setSaving(false);
    }
  }

  function handleNameKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    }

    if (event.key === "Escape") {
      onCancel?.();
    }
  }

  const draftAssignees = members
    .filter((member) => draft.assignee_ids.includes(member.user_id))
    .map((member) => ({
      user_id: member.user_id,
      full_name: member.user?.full_name,
      email: member.user?.email,
    }));

  return (
    <div
      className={cn(
        "border-b border-border/40 bg-muted/20",
        parentTaskId && "border-l-2 border-l-border/60",
      )}
    >
      <TaskRowShell saving={saving} isDraft isSubtask={Boolean(parentTaskId)}>
        <div className="flex min-w-0 items-center gap-2">
          {parentTaskId ? <span className="ml-5 size-5 shrink-0" /> : null}
          <TaskTypeIcon typeName="Task" />
          <input
            ref={nameInputRef}
            value={draft.name}
            onChange={(event) => {
              setError("");
              onDraftChange({ ...draft, name: event.target.value });
            }}
            onKeyDown={handleNameKeyDown}
            placeholder="Task name"
            className="w-full min-w-0 rounded bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground focus:bg-background focus:ring-1 focus:ring-ring"
          />
        </div>

        <AssigneeCell
          assignees={draftAssignees}
          members={members}
          onChange={(assigneeIds) =>
            onDraftChange({ ...draft, assignee_ids: assigneeIds })
          }
        />

        <DueDateCell
          dueDate={draft.due_date}
          onChange={(value) => onDraftChange({ ...draft, due_date: value })}
        />

        <PriorityCell
          priority={draft.priority}
          editable
          onChange={(value) => onDraftChange({ ...draft, priority: value })}
        />

        <StatusCell
          statusId={draft.task_status_id}
          statusName={status?.name}
          statuses={statuses}
          onChange={(value) =>
            onDraftChange({ ...draft, task_status_id: value })
          }
        />

        <div className="flex items-center justify-center">
          <MessageSquare className="size-3.5 text-muted-foreground/35" />
        </div>

        <TimelineCell
          timeline={draft.timeline}
          onChange={(value) => onDraftChange({ ...draft, timeline: value })}
        />

        <DrawCell disabled />
      </TaskRowShell>

      <div className="flex items-center justify-end gap-2 px-3 py-2">
        {error ? (
          <p className="mr-auto text-xs text-destructive">{error}</p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving || !token}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function TaskWithSubtasks({
  task,
  projectId,
  token,
  statuses,
  taskTypes,
  members,
  onUpdated,
}) {
  const [expanded, setExpanded] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [subtasksLoaded, setSubtasksLoaded] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState(null);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [task.task_id, token]);

  async function loadSubtasks() {
    if (!token || loadingSubtasks) return;

    setLoadingSubtasks(true);
    try {
      const data = await apiGet(
        `/projects/${projectId}/tasks/${task.task_id}/subtasks`,
        { token },
      );
      setSubtasks(data.subtasks || []);
      setSubtasksLoaded(true);
    } finally {
      setLoadingSubtasks(false);
    }
  }

  async function handleToggleExpand() {
    if (subtasks.length === 0) {
      return;
    }

    if (!expanded && !subtasksLoaded) {
      await loadSubtasks();
    }
    setExpanded((current) => !current);
  }

  async function handleAddSubtask() {
    if (!subtasksLoaded) {
      await loadSubtasks();
    }
    setSubtaskDraft(createEmptyDraft(task.task_status_id, taskTypes));
  }

  function handleSubtaskUpdated(updatedSubtask) {
    setSubtasks((current) =>
      current.map((item) =>
        item.task_id === updatedSubtask.task_id ? updatedSubtask : item,
      ),
    );
    onUpdated?.(task);
  }

  const subtaskCount = subtasks.length;

  return (
    <>
      <EditableTaskRow
        task={task}
        projectId={projectId}
        token={token}
        statuses={statuses}
        members={members}
        onAddSubtask={handleAddSubtask}
        subtaskCount={subtaskCount}
        expanded={expanded}
        onToggleExpand={handleToggleExpand}
        onUpdated={onUpdated}
      />

      {expanded
        ? subtasks.map((subtask) => (
            <EditableTaskRow
              key={subtask.task_id}
              task={subtask}
              projectId={projectId}
              token={token}
              statuses={statuses}
              members={members}
              isSubtask
              onUpdated={handleSubtaskUpdated}
            />
          ))
        : null}

      {subtaskDraft ? (
        <DraftTaskRow
          draft={subtaskDraft}
          projectId={projectId}
          token={token}
          parentTaskId={task.task_id}
          statuses={statuses}
          members={members}
          onDraftChange={setSubtaskDraft}
          onCreated={(subtask) => {
            setSubtasks((current) => [...current, subtask]);
            setSubtaskDraft(null);
            setSubtasksLoaded(true);
            setExpanded(true);
          }}
          onCancel={() => setSubtaskDraft(null)}
        />
      ) : null}
    </>
  );
}

function createEmptyDraft(statusId, taskTypes) {
  return {
    name: "",
    task_status_id: statusId,
    assignee_ids: [],
    due_date: null,
    timeline: { start_date: null, end_date: null },
    priority: "medium",
    task_type_id: taskTypes[0]?.task_type_id ?? null,
  };
}

function StatusGroup({
  status,
  tasks,
  projectId,
  token,
  statuses,
  taskTypes,
  members,
  onTaskCreated,
  onTaskUpdated,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState(null);

  function startDraft() {
    setCollapsed(false);
    setDraft(createEmptyDraft(status.task_status_id, taskTypes));
  }

  const taskCount = tasks.length + (draft ? 1 : 0);

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center gap-2 border-b border-border/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        {collapsed ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
        <StatusBadge name={status.name} />
        <span className="text-xs text-muted-foreground">{taskCount}</span>
      </button>

      {!collapsed ? (
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div
              className={cn(
                ROW_GRID,
                "border-b border-border/40 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
              )}
            >
              <span>Name</span>
              <span className="text-center">Assignee</span>
              <span className="text-center">Due date</span>
              <span className="text-center">Priority</span>
              <span className="text-center">Status</span>
              <span className="text-center">Comments</span>
              <span className="text-center">Timeline</span>
              <span className="text-center">Scribble</span>
            </div>

            {tasks.length === 0 && !draft ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No tasks in this status
              </p>
            ) : (
              tasks.map((task) => (
                <TaskWithSubtasks
                  key={task.task_id}
                  task={task}
                  projectId={projectId}
                  token={token}
                  statuses={statuses}
                  taskTypes={taskTypes}
                  members={members}
                  onUpdated={onTaskUpdated}
                />
              ))
            )}

            {draft ? (
              <DraftTaskRow
                draft={draft}
                projectId={projectId}
                token={token}
                statuses={statuses}
                members={members}
                onDraftChange={setDraft}
                onCreated={(task) => {
                  setDraft(null);
                  onTaskCreated?.(task);
                }}
                onCancel={() => setDraft(null)}
              />
            ) : null}

            {!draft ? (
              <button
                type="button"
                onClick={startDraft}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add Task
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ProjectTasksBoard({
  columns,
  projectId,
  token,
  statuses,
  taskTypes,
  members,
  onTaskCreated,
  onTaskUpdated,
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {columns.map(({ status, tasks }) => (
        <StatusGroup
          key={status.task_status_id}
          status={status}
          tasks={tasks}
          projectId={projectId}
          token={token}
          statuses={statuses}
          taskTypes={taskTypes}
          members={members}
          onTaskCreated={onTaskCreated}
          onTaskUpdated={onTaskUpdated}
        />
      ))}
    </div>
  );
}

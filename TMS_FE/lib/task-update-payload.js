import { parseTaskTargetValue } from "@/components/task-target-field";
import { sanitizeTimelineInput } from "@/lib/task-timeline";

function arraysEqual(left = [], right = []) {
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function timelinesEqual(left, right) {
  const a = sanitizeTimelineInput(left);
  const b = sanitizeTimelineInput(right);
  return a.start_date === b.start_date && a.end_date === b.end_date;
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

export function buildTaskPatchPayload(form, task, taskTypes = []) {
  const payload = {};
  const trimmedName = form.name.trim();
  const trimmedDescription = form.description.trim() || "";

  const selectedType = taskTypes.find(
    (type) => String(type.task_type_id) === String(form.task_type_id),
  );
  const currentType = taskTypes.find(
    (type) => String(type.task_type_id) === String(task?.task_type_id),
  );

  if (trimmedName !== (task?.name || "")) {
    payload.name = trimmedName;
  }

  if (trimmedDescription !== (task?.description || "")) {
    payload.description = trimmedDescription;
  }

  const nextStatusId = Number(form.task_status_id);
  if (nextStatusId !== Number(task?.task_status_id)) {
    payload.task_status_id = nextStatusId;
  }

  const nextTypeId = form.task_type_id ? Number(form.task_type_id) : null;
  const currentTypeId = task?.task_type_id ?? null;
  if (nextTypeId !== currentTypeId) {
    payload.task_type_id = nextTypeId;
  }

  if (form.priority !== (task?.priority || "medium")) {
    payload.priority = form.priority;
  }

  const nextTimeline = sanitizeTimelineInput(form.timeline);
  if (!timelinesEqual(nextTimeline, task?.timeline)) {
    payload.timeline = nextTimeline;
  }

  const nextDueDate = form.due_date
    ? new Date(`${form.due_date}T00:00:00`).getTime()
    : null;
  const currentDueDate = task?.due_date ?? null;
  if (nextDueDate !== currentDueDate) {
    payload.due_date = nextDueDate;
  }

  const nextAssigneeIds = form.assignee_ids.map(Number).filter(Boolean);
  const currentAssigneeIds = (
    task?.assignee_ids ||
    task?.assignees?.map((assignee) => assignee.user_id) ||
    []
  ).map(Number);

  if (!arraysEqual(nextAssigneeIds, currentAssigneeIds)) {
    payload.assignee_ids = nextAssigneeIds;
  }

  const nextTarget = selectedType?.alias
    ? parseTaskTargetValue(form.target)
    : null;
  const nextTargetCompleted = selectedType?.alias
    ? parseTaskTargetValue(form.target_completed)
    : null;
  const currentTarget = task?.target ?? null;
  const currentTargetCompleted = task?.target_completed ?? null;

  if (selectedType?.alias || currentType?.alias) {
    if (nextTarget !== currentTarget) {
      payload.target = nextTarget;
    }
    if (nextTargetCompleted !== currentTargetCompleted) {
      payload.target_completed = nextTargetCompleted;
    }
  }

  return payload;
}

export function hasTaskFormChanges(form, task) {
  const currentDueDateInput = timestampToDateInput(task?.due_date);

  return (
    form.name.trim() !== (task?.name || "") ||
    (form.description.trim() || "") !== (task?.description || "") ||
    String(form.task_status_id) !== String(task?.task_status_id ?? "") ||
    String(form.task_type_id || "") !== String(task?.task_type_id ?? "") ||
    form.priority !== (task?.priority || "medium") ||
    !timelinesEqual(form.timeline, task?.timeline) ||
    (form.due_date || "") !== currentDueDateInput ||
    !arraysEqual(
      form.assignee_ids.map(Number).filter(Boolean),
      (
        task?.assignee_ids ||
        task?.assignees?.map((assignee) => assignee.user_id) ||
        []
      ).map(Number),
    ) ||
    String(form.target || "") !==
      (task?.target != null && task?.target !== ""
        ? String(task.target)
        : "") ||
    String(form.target_completed || "") !==
      (task?.target_completed != null && task?.target_completed !== ""
        ? String(task.target_completed)
        : "")
  );
}

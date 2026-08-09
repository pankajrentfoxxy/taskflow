function formatAssigneeChange(value) {
  if (!Array.isArray(value)) {
    return "assignees";
  }

  if (value.length === 0) {
    return "cleared assignees";
  }

  if (value.length === 1) {
    return "assignee";
  }

  return `assignees (${value.length})`;
}

function formatDueDateChange(value) {
  if (value == null) {
    return "cleared due date";
  }

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    return "due date";
  }

  return `due date to ${date.toLocaleDateString("en-GB")}`;
}

function formatTimelineChange(value) {
  if (!value || (value.start_date == null && value.end_date == null)) {
    return "cleared timeline";
  }

  return "timeline";
}

const FIELD_DESCRIPTIONS = {
  name: (value) => `name to "${value}"`,
  description: () => "description",
  task_status_id: () => "status",
  task_type_id: (value) =>
    value == null ? "cleared task type" : "task type",
  assignee_ids: formatAssigneeChange,
  due_date: formatDueDateChange,
  priority: (value) => `priority to ${value}`,
  target: (value) =>
    value == null ? "cleared target" : `target to ${value}`,
  target_completed: (value) =>
    value == null ? "cleared completed count" : `completed count to ${value}`,
  timeline: formatTimelineChange,
  scribble: (value) => (value == null ? "cleared scribble" : "scribble"),
  parent_task_id: () => "parent task",
};

export function buildTaskUpdateActivityDescription(payload = {}, taskName = "") {
  const changes = Object.keys(payload)
    .filter((field) => payload[field] !== undefined && FIELD_DESCRIPTIONS[field])
    .map((field) => FIELD_DESCRIPTIONS[field](payload[field]));

  if (changes.length === 0) {
    return taskName ? `Updated task "${taskName}"` : "Updated task";
  }

  const changeText = changes.join(", ");
  return taskName
    ? `Changed ${changeText} on "${taskName}"`
    : `Changed ${changeText}`;
}

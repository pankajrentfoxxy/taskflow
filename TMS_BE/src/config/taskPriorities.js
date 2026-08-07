export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

export function isValidTaskPriority(value) {
  return TASK_PRIORITIES.includes(value);
}

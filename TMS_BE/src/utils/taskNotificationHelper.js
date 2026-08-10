import * as notificationService from "../services/notificationService.js";

function normalizeStatusName(name) {
  return String(name || "").trim().toLowerCase();
}

function isEscalatedStatus(statusName) {
  return /escalat/.test(normalizeStatusName(statusName));
}

function isAcknowledgedStatus(statusName) {
  return /acknowledg/.test(normalizeStatusName(statusName));
}

function getActorName(actor) {
  return actor?.full_name || actor?.email || "Someone";
}

function uniqueRecipientIds(assigneeIds = [], extras = []) {
  return [...new Set([...assigneeIds, ...extras].map(Number).filter(Boolean))];
}

export async function notifyTaskCreated({ task, actor, projectId }) {
  const assigneeIds = (task.assignee_ids || []).map(Number);
  const recipients = assigneeIds.filter((id) => id !== Number(actor.user_id));

  if (recipients.length === 0) return;

  await notificationService.createNotifications(
    recipients.map((recipientUserId) => ({
      recipientUserId,
      actorUserId: actor.user_id,
      type: "assigned",
      title: `New task assigned: "${task.name}"`,
      message: `${getActorName(actor)} assigned you a task.`,
      taskId: task.task_id,
      projectId: Number(projectId),
      metadata: {
        task_name: task.name,
        priority: task.priority,
      },
    })),
  );
}

export async function notifyTaskUpdated({
  task,
  actor,
  projectId,
  previousTask,
  updateBody,
}) {
  const assigneeIds = (task.assignee_ids || []).map(Number);
  const previousAssigneeIds = (previousTask?.assignee_ids || []).map(Number);
  const payloads = [];

  const newlyAssigned = assigneeIds.filter(
    (id) => !previousAssigneeIds.includes(id) && id !== Number(actor.user_id),
  );

  for (const recipientUserId of newlyAssigned) {
    payloads.push({
      recipientUserId,
      actorUserId: actor.user_id,
      type: "assigned",
      title: `Assigned: "${task.name}"`,
      message: `${getActorName(actor)} assigned you this task.`,
      taskId: task.task_id,
      projectId: Number(projectId),
    });
  }

  const statusName = task.status?.name;
  const previousStatusName = previousTask?.status?.name;

  if (
    statusName &&
    isEscalatedStatus(statusName) &&
    !isEscalatedStatus(previousStatusName)
  ) {
    for (const recipientUserId of uniqueRecipientIds(assigneeIds, [
      previousTask?.created_by,
    ])) {
      if (recipientUserId === Number(actor.user_id)) continue;

      payloads.push({
        recipientUserId,
        actorUserId: actor.user_id,
        type: "escalated",
        title: `Escalated: "${task.name}" passed its due date`,
        message: "A written explanation from the assignee is now mandatory.",
        taskId: task.task_id,
        projectId: Number(projectId),
        metadata: {
          task_name: task.name,
          due_date: task.due_date,
        },
      });
    }
  }

  if (
    statusName &&
    isAcknowledgedStatus(statusName) &&
    !isAcknowledgedStatus(previousStatusName)
  ) {
    for (const recipientUserId of uniqueRecipientIds(assigneeIds, [
      previousTask?.created_by,
    ])) {
      if (recipientUserId === Number(actor.user_id)) continue;

      payloads.push({
        recipientUserId,
        actorUserId: actor.user_id,
        type: "acknowledged",
        title: `${getActorName(actor)} acknowledged "${task.name}"`,
        message: updateBody?.timeline?.end_date ? "ETA set." : "Task acknowledged.",
        taskId: task.task_id,
        projectId: Number(projectId),
      });
    }
  }

  if (updateBody?.task_status_id && payloads.length === 0) {
    for (const recipientUserId of assigneeIds) {
      if (recipientUserId === Number(actor.user_id)) continue;

      payloads.push({
        recipientUserId,
        actorUserId: actor.user_id,
        type: "updated",
        title: `Task updated: "${task.name}"`,
        message: `Status changed to ${statusName || "updated"}.`,
        taskId: task.task_id,
        projectId: Number(projectId),
      });
    }
  }

  if (payloads.length > 0) {
    await notificationService.createNotifications(payloads);
  }
}

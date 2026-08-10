import { randomUUID } from "crypto";
import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import {
  Task,
  User,
  TaskType,
  Attachment,
  Comment,
  CommentReaction,
  Escalation,
} from "../models/index.js";
import ApiError from "../utils/ApiError.js";
import {
  taskVisibilityWhere,
  canSeeTask,
  canEditEta,
  canReviewEscalation,
  isManagerOf,
} from "../lib/rbac.js";
import { addWorkingMinutes } from "../lib/sla.js";
import { notify, managerOf, ceoIds, logActivity } from "../lib/notify.js";
import { runSlaSweep } from "../lib/cron.js";
import { now } from "../lib/time.js";

const SUB_COUNTS = `
  (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id) AS subtask_count,
  (SELECT COUNT(*)::int FROM tasks s WHERE s.parent_id = t.id AND s.status = 'DONE') AS subtask_done,
  (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comment_count`;

export async function loadTask(id) {
  const [task] = await sequelize.query(
    `SELECT t.*, ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name,
      tt.name AS type_name
     FROM tasks t
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN users uc ON uc.id = t.creator_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return task ?? null;
}

async function explanationPending(task) {
  if (task.status !== "ESCALATED") return false;
  const [esc] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );
  return esc && !esc.explanation;
}

export const listTasks = async (user, { filter = "mine", status, q, projectId }) => {
  await runSlaSweep();

  const { sql, replacements } = taskVisibilityWhere(user);
  let where = `(${sql})`;
  const repl = { ...replacements };

  if (filter === "mine") {
    where += " AND (t.assignee_id = :mineUid";
    repl.mineUid = user.id;
    if (user.team_id) {
      where += " OR t.assigned_team_id = :mineTeamId)";
      repl.mineTeamId = user.team_id;
    } else {
      where += ")";
    }
  } else if (filter === "created") {
    where += " AND t.creator_id = :creatorId";
    repl.creatorId = user.id;
  } else if (filter === "team") {
    if (user.role === "MANAGER" && user.team_id) {
      where += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :mgrTeamId) OR t.assigned_team_id = :mgrTeamId2)";
      repl.mgrTeamId = user.team_id;
      repl.mgrTeamId2 = user.team_id;
    } else if (!["ADMIN", "CEO"].includes(user.role)) {
      return { tasks: [] };
    }
  }

  if (status) {
    where += " AND t.status = :status";
    repl.status = status;
  }
  if (q) {
    where += " AND (t.title ILIKE :q OR t.description ILIKE :q)";
    repl.q = `%${q}%`;
  }
  if (projectId) {
    where += " AND t.project_id = :projectId";
    repl.projectId = Number(projectId);
  } else {
    where += " AND t.parent_id IS NULL";
  }

  const tasks = await sequelize.query(
    `SELECT t.*, ${SUB_COUNTS},
      ua.name AS assignee_name, uc.name AS creator_name, tm.name AS team_name, p.name AS project_name,
      tt.name AS type_name
     FROM tasks t
     LEFT JOIN task_types tt ON tt.id = t.task_type_id
     LEFT JOIN users ua ON ua.id = t.assignee_id
     LEFT JOIN users uc ON uc.id = t.creator_id
     LEFT JOIN teams tm ON tm.id = t.assigned_team_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${where}
     ORDER BY CASE t.status WHEN 'ESCALATED' THEN 0 WHEN 'ASSIGNED' THEN 1 ELSE 2 END, t.due_at ASC
     LIMIT 300`,
    { replacements: repl, type: QueryTypes.SELECT }
  );

  return { tasks };
};

export const createTask = async (user, body) => {
  const {
    title,
    description = "",
    assigneeId = null,
    teamId = null,
    priority = "NORMAL",
    dueAt,
    projectId = null,
    parentId = null,
    multiple = false,
    lines = [],
    attachmentIds = [],
    boardId = null,
    taskTypeId = null,
  } = body;

  if (!dueAt) throw new ApiError(httpStatus.BAD_REQUEST, "Due date is required");
  if (!assigneeId && !teamId) throw new ApiError(httpStatus.BAD_REQUEST, "Choose an assignee (person or team)");
  if (assigneeId && teamId) throw new ApiError(httpStatus.BAD_REQUEST, "Assign to a person OR a team, not both");

  const t = now();
  let effProject = projectId ? Number(projectId) : null;
  let parent = null;

  if (parentId) {
    parent = await Task.findByPk(parentId);
    if (!parent) throw new ApiError(httpStatus.BAD_REQUEST, "Parent task not found");
    if (parent.parent_id) throw new ApiError(httpStatus.BAD_REQUEST, "Subtasks cannot have their own subtasks");
    effProject = parent.project_id;
  }

  let effType = null;
  if (taskTypeId) {
    const type = await TaskType.findOne({
      where: { id: Number(taskTypeId), is_active: true },
    });
    if (!type) throw new ApiError(httpStatus.BAD_REQUEST, "Task type not found or inactive");

    let targetTeam;
    if (teamId) {
      targetTeam = Number(teamId);
    } else {
      const assignee = await User.findByPk(Number(assigneeId), { attributes: ["team_id"] });
      targetTeam = assignee?.team_id;
    }
    if (type.team_id !== targetTeam) {
      throw new ApiError(httpStatus.BAD_REQUEST, "This task type belongs to a different team than the assignee");
    }
    effType = type.id;
  }

  const titles = multiple
    ? lines.map((l) => l.trim()).filter(Boolean)
    : [String(title || "").trim()];
  if (titles.length === 0 || !titles[0]) throw new ApiError(httpStatus.BAD_REQUEST, "Title is required");

  const batchId = titles.length > 1 ? randomUUID() : null;
  const sla = addWorkingMinutes(t, 30);
  const created = [];

  for (const tt of titles) {
    const task = await Task.create({
      title: tt,
      description,
      priority,
      creator_id: user.id,
      assignee_id: assigneeId,
      assigned_team_id: teamId,
      project_id: effProject,
      parent_id: parentId,
      batch_id: batchId,
      board_id: boardId,
      task_type_id: effType,
      target_count: null,
      due_at: dueAt,
      sla_deadline_at: sla,
      created_at: t,
      updated_at: t,
    });
    created.push(task.id);
    await logActivity(task.id, user.id, "CREATED", batchId ? { batchId } : {});
  }

  if (attachmentIds.length && created.length) {
    for (const aid of attachmentIds) {
      await Attachment.update(
        { task_id: created[0] },
        { where: { id: aid, uploader_id: user.id } }
      );
    }
  }

  const label = titles.length > 1 ? `${titles.length} new tasks` : `New task: "${titles[0]}"`;
  if (assigneeId) {
    await notify(
      [Number(assigneeId)],
      "ASSIGNED",
      label,
      `Assigned by ${user.name}. Acknowledge within 30 working minutes.`,
      created[0],
      user.id
    );
  } else if (teamId) {
    const members = await User.findAll({
      where: { team_id: teamId, is_active: true },
      attributes: ["id"],
    });
    const [teamRow] = await sequelize.query(
      "SELECT manager_id FROM teams WHERE id = :teamId",
      { replacements: { teamId }, type: QueryTypes.SELECT }
    );
    const ids = [...members.map((m) => m.id), teamRow?.manager_id].filter(Boolean);
    await notify(ids, "ASSIGNED", `${label} (team task)`, `Assigned by ${user.name} to your team.`, created[0], user.id);
  }

  if (parent?.assignee_id) {
    await notify(
      [parent.assignee_id, parent.creator_id],
      "SUBTASK",
      `Subtask added on "${parent.title}"`,
      titles[0],
      parent.id,
      user.id
    );
  }

  return { ids: created };
};

export const getTaskDetail = async (user, taskId) => {
  const task = await loadTask(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const subtasks = await sequelize.query(
    `SELECT t.*, ua.name AS assignee_name FROM tasks t
     LEFT JOIN users ua ON ua.id = t.assignee_id
     WHERE t.parent_id = :taskId ORDER BY t.id`,
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const comments = await sequelize.query(
    `SELECT c.id, c.task_id, c.author_id, c.parent_comment_id, c.body AS content,
            c.edited, c.edited_at, c.created_at, c.updated_at,
            u.name AS author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = :taskId ORDER BY c.created_at ASC, c.id ASC`,
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const activity = await sequelize.query(
    `SELECT a.*, u.name AS actor_name FROM activity a LEFT JOIN users u ON u.id = a.actor_id
     WHERE a.task_id = :taskId ORDER BY a.id DESC LIMIT 100`,
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const attachments = await sequelize.query(
    "SELECT id, file_name, mime_type, size, uploader_id, created_at FROM attachments WHERE task_id = :taskId",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const [escalation] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );

  const batchTasks = task.batch_id
    ? await sequelize.query(
        "SELECT id, title, status FROM tasks WHERE batch_id = :batchId AND id != :taskId",
        { replacements: { batchId: task.batch_id, taskId: task.id }, type: QueryTypes.SELECT }
      )
    : [];

  const isAssignee = task.assignee_id === user.id;
  const isCreator = task.creator_id === user.id;
  const isBoss = ["ADMIN", "CEO"].includes(user.role);
  const isMgr = await isManagerOf(user, task.assignee_id);
  const expPending = await explanationPending(task);
  const openSubs = subtasks.filter((s) => !["DONE", "CANCELLED"].includes(s.status)).length;

  const permissions = {
    isAssignee,
    canAcknowledge:
      task.status === "ASSIGNED" &&
      (isAssignee || (task.assigned_team_id && task.assigned_team_id === user.team_id)),
    canStart: task.status === "ACKNOWLEDGED" && isAssignee && !expPending,
    canDone:
      ["ACKNOWLEDGED", "IN_PROGRESS", "ESCALATED"].includes(task.status) &&
      (isAssignee || isBoss || isCreator) &&
      !expPending,
    canEditEta:
      (await canEditEta(user, task)) && !["DONE", "CANCELLED"].includes(task.status) && !expPending,
    canReopen:
      task.status === "DONE" &&
      (isCreator || isBoss || isMgr) &&
      now() - (task.done_at || 0) < 7 * 24 * 3600 * 1000,
    canCancel: !["DONE", "CANCELLED"].includes(task.status) && (isCreator || isBoss),
    canBlock: ["ACKNOWLEDGED", "IN_PROGRESS"].includes(task.status) && isAssignee,
    mustExplain: expPending && isAssignee,
    canReview:
      task.status === "ESCALATED" &&
      escalation?.explanation &&
      escalation?.review_status === "PENDING" &&
      (await canReviewEscalation(user, task)),
    canAddSubtask: !["DONE", "CANCELLED"].includes(task.status) && !task.parent_id,
    openSubtasks: openSubs,
  };

  return { task, subtasks, comments, activity, attachments, escalation: escalation ?? null, batchTasks, permissions };
};

export const patchTask = async (user, taskId, body) => {
  const task = await loadTask(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const t = now();
  const action = body.action;

  const isAssignee = task.assignee_id === user.id;
  const isCreator = task.creator_id === user.id;
  const isBoss = ["ADMIN", "CEO"].includes(user.role);

  if ((await explanationPending(task)) && isAssignee && action !== "noop") {
    throw new ApiError(
      httpStatus.LOCKED,
      "This task is escalated. You must submit an explanation before any other action.",
      true,
      "",
      "EXPLANATION_REQUIRED"
    );
  }

  switch (action) {
    case "acknowledge": {
      if (task.status !== "ASSIGNED") throw new ApiError(httpStatus.BAD_REQUEST, "Task is not awaiting acknowledgment");
      const claimable = task.assigned_team_id && task.assigned_team_id === user.team_id;
      if (!isAssignee && !claimable && !isBoss) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee can acknowledge");
      }
      if (!body.etaAt) throw new ApiError(httpStatus.BAD_REQUEST, "ETA is mandatory when acknowledging");

      await sequelize.query(
        `UPDATE tasks SET status = 'ACKNOWLEDGED', acknowledged_at = :t, eta_at = :etaAt,
         assignee_id = COALESCE(assignee_id, :uid),
         assigned_team_id = CASE WHEN assignee_id IS NULL THEN NULL ELSE assigned_team_id END,
         updated_at = :t2 WHERE id = :id`,
        { replacements: { t, etaAt: body.etaAt, uid: user.id, t2: t, id: task.id } }
      );
      await logActivity(task.id, user.id, "ACKNOWLEDGED", { etaAt: body.etaAt });
      await notify([task.creator_id], "ACKNOWLEDGED", `${user.name} acknowledged "${task.title}"`, "ETA set.", task.id, user.id);
      break;
    }
    case "start": {
      if (task.status !== "ACKNOWLEDGED") throw new ApiError(httpStatus.BAD_REQUEST, "Acknowledge first");
      if (!isAssignee && !isBoss) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      await Task.update({ status: "IN_PROGRESS", started_at: t, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "STARTED", {});
      break;
    }
    case "done": {
      if (["DONE", "CANCELLED"].includes(task.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Task already closed");
      }
      if (!isAssignee && !isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      const [countRow] = await sequelize.query(
        "SELECT COUNT(*)::int AS c FROM tasks WHERE parent_id = :id AND status NOT IN ('DONE','CANCELLED')",
        { replacements: { id: task.id }, type: QueryTypes.SELECT }
      );
      const openSubs = countRow?.c ?? 0;
      if (openSubs > 0) {
        const mayOverride = (isCreator || isBoss) && body.overrideReason;
        if (!mayOverride) {
          throw new ApiError(
            httpStatus.CONFLICT,
            `${openSubs} subtask(s) still open. Complete them first (creator/Admin may override with a reason).`,
            true,
            "",
            "OPEN_SUBTASKS"
          );
        }
        await logActivity(task.id, user.id, "DONE_OVERRIDE", { reason: body.overrideReason, openSubs });
      }
      await Task.update(
        { status: "DONE", done_at: t, blocked_reason: null, updated_at: t },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "DONE", {});
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "DONE",
        `Done: "${task.title}"`,
        `Marked done by ${user.name}.`,
        task.id,
        user.id
      );
      if (task.parent_id) {
        const parent = await Task.findByPk(task.parent_id);
        const [counts] = await sequelize.query(
          "SELECT COUNT(*)::int AS total, SUM(CASE WHEN status='DONE' THEN 1 ELSE 0 END)::int AS done FROM tasks WHERE parent_id = :pid",
          { replacements: { pid: task.parent_id }, type: QueryTypes.SELECT }
        );
        await notify(
          [parent.assignee_id, parent.creator_id],
          "SUBTASK_DONE",
          `Subtask done on "${parent.title}" (${counts.done}/${counts.total})`,
          task.title,
          parent.id,
          user.id
        );
        await logActivity(parent.id, user.id, "SUBTASK_DONE", {
          subtaskId: task.id,
          done: counts.done,
          total: counts.total,
        });
      }
      break;
    }
    case "update_eta": {
      if (!(await canEditEta(user, task))) {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot edit the ETA of this task");
      }
      if (!body.etaAt) throw new ApiError(httpStatus.BAD_REQUEST, "etaAt required");
      await Task.update({ eta_at: body.etaAt, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "ETA_CHANGED", { from: task.eta_at, to: body.etaAt });
      await notify(
        [task.assignee_id, task.creator_id],
        "ETA_CHANGED",
        `ETA updated on "${task.title}"`,
        `Changed by ${user.name}.`,
        task.id,
        user.id
      );
      break;
    }
    case "update_due": {
      if (!isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Only creator/manager/CEO/Admin can change the due date");
      }
      if (!body.dueAt) throw new ApiError(httpStatus.BAD_REQUEST, "dueAt required");
      await Task.update({ due_at: body.dueAt, due_soon_sent: false, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "DUE_CHANGED", { from: task.due_at, to: body.dueAt });
      await notify([task.assignee_id], "DUE_CHANGED", `Due date updated on "${task.title}"`, "", task.id, user.id);
      break;
    }
    case "reopen": {
      if (task.status !== "DONE") throw new ApiError(httpStatus.BAD_REQUEST, "Only done tasks can be reopened");
      if (!isCreator && !isBoss && !(await isManagerOf(user, task.assignee_id))) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      }
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "A reason is required to reopen");
      await sequelize.query(
        "UPDATE tasks SET status = 'IN_PROGRESS', done_at = NULL, reopen_count = reopen_count + 1, updated_at = :t WHERE id = :id",
        { replacements: { t, id: task.id } }
      );
      await logActivity(task.id, user.id, "REOPENED", { reason: body.reason });
      await notify([task.assignee_id], "REOPENED", `Reopened: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case "cancel": {
      if (!isCreator && user.role !== "ADMIN") {
        throw new ApiError(httpStatus.FORBIDDEN, "Only the creator or Admin can cancel");
      }
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "A reason is required to cancel");
      await Task.update(
        { status: "CANCELLED", cancelled_at: t, cancel_reason: body.reason, updated_at: t },
        { where: { id: task.id } }
      );
      await logActivity(task.id, user.id, "CANCELLED", { reason: body.reason });
      await notify([task.assignee_id], "CANCELLED", `Cancelled: "${task.title}"`, body.reason, task.id, user.id);
      break;
    }
    case "block": {
      if (!isAssignee) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      if (!body.reason) throw new ApiError(httpStatus.BAD_REQUEST, "Describe what is blocking you");
      await Task.update({ blocked_reason: body.reason, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "BLOCKED", { reason: body.reason });
      await notify(
        [task.creator_id, await managerOf(task.assignee_id)],
        "BLOCKED",
        `Blocked: "${task.title}"`,
        body.reason,
        task.id,
        user.id
      );
      break;
    }
    case "unblock": {
      if (!isAssignee && !isBoss) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");
      await Task.update({ blocked_reason: null, updated_at: t }, { where: { id: task.id } });
      await logActivity(task.id, user.id, "UNBLOCKED", {});
      break;
    }
    default:
      throw new ApiError(httpStatus.BAD_REQUEST, "Unknown action");
  }

  return { ok: true, task: await loadTask(task.id) };
};

async function loadCommentsWithReactions(taskId, userId) {
  const rows = await sequelize.query(
    `SELECT c.id, c.task_id, c.author_id, c.parent_comment_id, c.body AS content,
            c.edited, c.edited_at, c.created_at, c.updated_at,
            u.name AS author_name
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = :taskId ORDER BY c.created_at ASC, c.id ASC`,
    { replacements: { taskId }, type: QueryTypes.SELECT }
  );

  const reactionRows = await sequelize.query(
    `SELECT comment_id, emoji, COUNT(*)::int AS count,
            SUM(CASE WHEN user_id = :userId THEN 1 ELSE 0 END)::int AS mine
     FROM comment_reactions
     WHERE comment_id IN (SELECT id FROM comments WHERE task_id = :taskId)
     GROUP BY comment_id, emoji`,
    { replacements: { userId, taskId }, type: QueryTypes.SELECT }
  );

  const reactionsByComment = {};
  for (const r of reactionRows) {
    if (!reactionsByComment[r.comment_id]) reactionsByComment[r.comment_id] = [];
    reactionsByComment[r.comment_id].push({
      emoji: r.emoji,
      count: r.count,
      mine: r.mine > 0,
    });
  }

  return rows.map((c) => ({
    ...c,
    reactions: reactionsByComment[c.id] || [],
  }));
}

export const listComments = async (user, taskId) => {
  const task = await Task.findByPk(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const comments = await loadCommentsWithReactions(task.id, user.id);
  return { comments };
};

export const createComment = async (user, taskId, body) => {
  const task = await Task.findByPk(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const content = String(body.content || body.body || "").trim();
  const parentCommentId = body.parentCommentId ? Number(body.parentCommentId) : null;

  if (!content) throw new ApiError(httpStatus.BAD_REQUEST, "Comment cannot be empty");

  if (parentCommentId) {
    const parent = await Comment.findOne({ where: { id: parentCommentId, task_id: task.id } });
    if (!parent) throw new ApiError(httpStatus.BAD_REQUEST, "Parent comment not found");
  }

  const t = now();
  const comment = await Comment.create({
    task_id: task.id,
    author_id: user.id,
    parent_comment_id: parentCommentId,
    body: content,
    edited: false,
    created_at: t,
    updated_at: t,
  });

  await logActivity(task.id, user.id, "COMMENT", { commentId: comment.id, parentCommentId });
  await notify(
    [task.assignee_id, task.creator_id],
    "COMMENT",
    `Comment on "${task.title}"`,
    content.slice(0, 120),
    task.id,
    user.id
  );

  const comments = await loadCommentsWithReactions(task.id, user.id);
  const created = comments.find((c) => c.id === comment.id);
  return { comment: created };
};

export const toggleReaction = async (user, taskId, commentId, emoji) => {
  const task = await Task.findByPk(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const comment = await Comment.findOne({ where: { id: commentId, task_id: taskId } });
  if (!comment) throw new ApiError(httpStatus.BAD_REQUEST, "Comment not found");

  if (!emoji || typeof emoji !== "string" || emoji.length > 32) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid emoji");
  }

  const existing = await CommentReaction.findOne({
    where: { comment_id: commentId, user_id: user.id, emoji },
  });

  if (existing) {
    await existing.destroy();
    return { toggled: "removed", emoji };
  }

  await CommentReaction.create({
    comment_id: commentId,
    user_id: user.id,
    emoji,
    created_at: now(),
  });

  return { toggled: "added", emoji };
};

export const handleEscalation = async (user, taskId, body) => {
  const t = now();
  const task = await Task.findByPk(taskId);
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Not found");
  if (!(await canSeeTask(user, task))) throw new ApiError(httpStatus.FORBIDDEN, "Forbidden");

  const [esc] = await sequelize.query(
    "SELECT * FROM escalations WHERE task_id = :taskId ORDER BY id DESC LIMIT 1",
    { replacements: { taskId: task.id }, type: QueryTypes.SELECT }
  );
  if (!esc) throw new ApiError(httpStatus.BAD_REQUEST, "Task is not escalated");

  if (body.explanation !== undefined) {
    if (task.assignee_id !== user.id) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only the assignee submits the explanation");
    }
    if (esc.explanation) throw new ApiError(httpStatus.BAD_REQUEST, "Explanation already submitted");
    const text = String(body.explanation || "").trim();
    if (text.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Explanation must be at least 20 characters");
    if (!body.proposedEtaAt) throw new ApiError(httpStatus.BAD_REQUEST, "Propose a new ETA along with your explanation");

    await Escalation.update(
      {
        explanation: text,
        explanation_at: t,
        proposed_eta_at: body.proposedEtaAt,
        review_status: "PENDING",
      },
      { where: { id: esc.id } }
    );
    await logActivity(task.id, user.id, "EXPLANATION", { proposedEtaAt: body.proposedEtaAt });
    await notify(
      [task.creator_id, await managerOf(task.assignee_id), ...(await ceoIds())],
      "EXPLANATION",
      `Explanation submitted for "${task.title}"`,
      text.slice(0, 140),
      task.id,
      user.id
    );
    return { ok: true };
  }

  if (body.review) {
    if (!(await canReviewEscalation(user, task))) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only manager/CEO/Admin can review");
    }
    if (!esc.explanation || esc.review_status !== "PENDING") {
      throw new ApiError(httpStatus.BAD_REQUEST, "No explanation pending review");
    }
    if (!["ACCEPTED", "REJECTED"].includes(body.review)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "review must be ACCEPTED or REJECTED");
    }

    await Escalation.update(
      { review_status: body.review, reviewer_id: user.id, reviewed_at: t },
      { where: { id: esc.id } }
    );
    await logActivity(task.id, user.id, "REVIEW", { result: body.review });

    if (body.review === "ACCEPTED") {
      const newDue = body.newDueAt || esc.proposed_eta_at;
      await Task.update(
        {
          status: "IN_PROGRESS",
          due_at: newDue,
          eta_at: esc.proposed_eta_at,
          due_soon_sent: false,
          updated_at: t,
        },
        { where: { id: task.id } }
      );
      await notify(
        [task.assignee_id],
        "REVIEW",
        `Explanation accepted for "${task.title}"`,
        "Task re-planned with the new ETA.",
        task.id,
        user.id
      );
    } else {
      await notify(
        [task.assignee_id],
        "REVIEW",
        `Explanation rejected for "${task.title}"`,
        "This task is flagged for review.",
        task.id,
        user.id
      );
    }
    return { ok: true };
  }

  throw new ApiError(httpStatus.BAD_REQUEST, "Nothing to do");
};

export default {
  listTasks,
  createTask,
  getTaskDetail,
  patchTask,
  listComments,
  createComment,
  toggleReaction,
  handleEscalation,
};

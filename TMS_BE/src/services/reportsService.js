import { QueryTypes } from "sequelize";
import httpStatus from "http-status";
import sequelize from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import { runSlaSweep } from "../lib/cron.js";
import { now } from "../lib/time.js";

function resolveCreatedWindow({ days, createdFrom, createdTo, t }) {
  if (createdFrom && createdTo) {
    return {
      since: Number(createdFrom),
      until: Number(createdTo),
      filter: "t.created_at >= :since AND t.created_at <= :until",
    };
  }
  if (days > 0) {
    return {
      since: t - days * 24 * 3600 * 1000,
      until: null,
      filter: "t.created_at >= :since",
    };
  }
  return {
    since: 0,
    until: null,
    filter: "t.created_at >= :since",
  };
}

function createdReplacements({ since, until }) {
  return until != null ? { since, until } : { since };
}

export const getReports = async (user, { days = 0, createdFrom, createdTo, teamId, taskTypeId, listMetric, personId }) => {
  await runSlaSweep();

  const t = now();
  const { since, until, filter: createdFilter } = resolveCreatedWindow({ days, createdFrom, createdTo, t });
  const dateParams = createdReplacements({ since, until });
  const teamFilter = teamId ? Number(teamId) : null;
  const typeFilter = taskTypeId ? Number(taskTypeId) : null;

  let scope = "t.deleted = false";
  const sp = {};

  if (user.role === "MEMBER") {
    scope += " AND t.assignee_id = :scopeUid";
    sp.scopeUid = user.id;
  } else if (user.role === "MANAGER" && user.team_id) {
    scope += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :scopeTeamId) OR t.assigned_team_id = :scopeTeamId2)";
    sp.scopeTeamId = user.team_id;
    sp.scopeTeamId2 = user.team_id;
  }

  if (teamFilter && ["ADMIN", "CEO"].includes(user.role)) {
    scope += " AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = :filterTeamId) OR t.assigned_team_id = :filterTeamId2)";
    sp.filterTeamId = teamFilter;
    sp.filterTeamId2 = teamFilter;
  }
  if (typeFilter) {
    scope += " AND t.task_type_id = :typeFilter";
    sp.typeFilter = typeFilter;
  }

  if (listMetric) {
    let extra = "";
    const ep = {};
    if (personId) {
      extra = " AND t.assignee_id = :personId";
      ep.personId = Number(personId);
    }

    let cond = "";
    const cp = {};
    switch (listMetric) {
      case "total":
        cond = "1=1";
        break;
      case "open":
        cond = "t.status NOT IN ('DONE','CANCELLED')";
        break;
      case "overdue":
        cond = "t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :overdueNow";
        cp.overdueNow = t;
        break;
      case "no_response":
        cond = "t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL";
        break;
      case "esc_awaiting":
        cond =
          "t.status = 'ESCALATED' AND EXISTS (SELECT 1 FROM escalations e WHERE e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) AND e.explanation IS NULL)";
        break;
      case "esc_pending":
        cond =
          "t.status = 'ESCALATED' AND EXISTS (SELECT 1 FROM escalations e WHERE e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id) AND e.explanation IS NOT NULL AND e.review_status = 'PENDING')";
        break;
      case "due_week":
        cond = "t.status NOT IN ('DONE','CANCELLED') AND t.due_at BETWEEN :weekStart AND :weekEnd";
        cp.weekStart = t;
        cp.weekEnd = t + 7 * 24 * 3600 * 1000;
        break;
      case "done":
        cond = "t.status = 'DONE'";
        break;
      case "escalations":
        cond = "t.escalated_at IS NOT NULL";
        break;
      default:
        throw new ApiError(httpStatus.BAD_REQUEST, "Unknown metric");
    }

    const tasks = await sequelize.query(
      `SELECT t.id, t.title, t.status, t.due_at, t.sla_breached_at,
        ua.name AS assignee_name, tt.name AS type_name
       FROM tasks t
       LEFT JOIN users ua ON ua.id = t.assignee_id
       LEFT JOIN task_types tt ON tt.id = t.task_type_id
       WHERE ${scope}${extra} AND ${createdFilter} AND ${cond}
       ORDER BY t.due_at ASC LIMIT 200`,
      { replacements: { ...sp, ...ep, ...dateParams, ...cp }, type: QueryTypes.SELECT }
    );
    return { tasks };
  }

  const one = async (sql, repl) => {
    const [row] = await sequelize.query(sql, { replacements: repl, type: QueryTypes.SELECT });
    return row;
  };

  const overdue = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t AND ${createdFilter}`,
      { ...sp, t, ...dateParams }
    )
  ).c;

  const noResponse = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL AND ${createdFilter}`,
      { ...sp, ...dateParams }
    )
  ).c;

  const escalatedAwaiting = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id)
       WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NULL AND ${createdFilter}`,
      { ...sp, ...dateParams }
    )
  ).c;

  const escalatedPendingReview = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t JOIN escalations e ON e.task_id = t.id AND e.id = (SELECT MAX(id) FROM escalations WHERE task_id = t.id)
       WHERE ${scope} AND t.status = 'ESCALATED' AND e.explanation IS NOT NULL AND e.review_status = 'PENDING' AND ${createdFilter}`,
      { ...sp, ...dateParams }
    )
  ).c;

  const open = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND ${createdFilter}`,
      { ...sp, ...dateParams }
    )
  ).c;

  const dueThisWeek = (
    await one(
      `SELECT COUNT(*)::int AS c FROM tasks t WHERE ${scope} AND t.status NOT IN ('DONE','CANCELLED') AND t.due_at BETWEEN :t AND :weekEnd`,
      { ...sp, t, weekEnd: t + 7 * 24 * 3600 * 1000 }
    )
  ).c;

  const doneRow = await one(
    `SELECT COUNT(*)::int AS c, SUM(CASE WHEN t.done_at <= t.due_at THEN 1 ELSE 0 END)::int AS ontime
     FROM tasks t WHERE ${scope} AND t.status = 'DONE' AND ${createdFilter}`,
    { ...sp, ...dateParams }
  );

  const respRow = await one(
    `SELECT AVG((t.acknowledged_at - t.created_at) / 60000.0) AS m FROM tasks t
     WHERE ${scope} AND t.acknowledged_at IS NOT NULL AND ${createdFilter}`,
    { ...sp, ...dateParams }
  );

  const summary = {
    open,
    overdue,
    noResponse,
    escalatedAwaiting,
    escalatedPendingReview,
    dueThisWeek,
    done: doneRow.c,
    onTimePct: doneRow.c ? Math.round((100 * (doneRow.ontime || 0)) / doneRow.c) : null,
    avgResponseMin: respRow.m != null ? Math.round(respRow.m) : null,
  };

  let people = [];
  if (user.role !== "MEMBER") {
    people = await sequelize.query(
      `SELECT u.id, u.name, tm.name AS team_name,
        SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') THEN 1 ELSE 0 END)::int AS open,
        SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t THEN 1 ELSE 0 END)::int AS overdue,
        SUM(CASE WHEN t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL THEN 1 ELSE 0 END)::int AS no_response,
        SUM(CASE WHEN t.escalated_at IS NOT NULL THEN 1 ELSE 0 END)::int AS escalations,
        SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END)::int AS done,
        SUM(CASE WHEN t.status = 'DONE' AND t.done_at <= t.due_at THEN 1 ELSE 0 END)::int AS done_ontime,
        ROUND(AVG(CASE WHEN t.acknowledged_at IS NOT NULL THEN (t.acknowledged_at - t.created_at) / 60000.0 END))::int AS avg_response_min
       FROM users u
       LEFT JOIN teams tm ON tm.id = u.team_id
       JOIN tasks t ON t.assignee_id = u.id AND ${createdFilter} AND ${scope}
       WHERE u.is_active = true
       GROUP BY u.id, tm.name ORDER BY overdue DESC, open DESC`,
      { replacements: { ...sp, t, ...dateParams }, type: QueryTypes.SELECT }
    );
  }

  const byType = await sequelize.query(
    `SELECT tt.id, tt.name, tm.name AS team_name,
      COUNT(*)::int AS total,
      SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') THEN 1 ELSE 0 END)::int AS open,
      SUM(CASE WHEN t.status NOT IN ('DONE','CANCELLED') AND t.due_at < :t THEN 1 ELSE 0 END)::int AS overdue,
      SUM(CASE WHEN t.status = 'ASSIGNED' AND t.sla_breached_at IS NOT NULL THEN 1 ELSE 0 END)::int AS no_response,
      SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END)::int AS done
     FROM tasks t
     JOIN task_types tt ON tt.id = t.task_type_id
     JOIN teams tm ON tm.id = tt.team_id
     WHERE ${scope} AND ${createdFilter}
     GROUP BY tt.id, tt.name, tm.name
     ORDER BY tm.name, tt.name`,
    { replacements: { ...sp, t, ...dateParams }, type: QueryTypes.SELECT }
  );

  return { summary, people, byType, scope: user.role };
};

export default { getReports };

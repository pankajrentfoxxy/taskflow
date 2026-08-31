import { Op } from "sequelize";
import config from "../config/config.js";
import logger from "../config/logger.js";
import { User, Team } from "../models/index.js";
import { sendMail } from "./mailService.js";
import { taskCreatedEmailTemplate } from "./emailTemplateService.js";
import { sendInteraktTemplate, INTERAKT_TEMPLATES } from "./interaktService.js";

function appBaseUrl() {
  const origin = config.corsOrigin?.[0] || "http://localhost:6070";
  return origin.replace(/\/$/, "");
}

function fmtDue(dueAt) {
  if (dueAt == null || dueAt === "") return "";
  return new Date(Number(dueAt)).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** DD-MM-YYYY for Interakt templates */
function fmtDueWhatsApp(dueAt) {
  if (dueAt == null || dueAt === "") return "—";
  const d = new Date(Number(dueAt));
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function buildWhatsAppMessage({ role, userName, titles, creatorName, dueWhatsApp }) {
  const name = userName || "User";
  const primaryTitle = titles[0] || "New task";

  if (role === "COLLABORATOR") {
    return {
      templateName: INTERAKT_TEMPLATES.ADDED_AS_COLLABORATOR,
      bodyValues: [name, primaryTitle, creatorName || "—", dueWhatsApp],
    };
  }

  if (role === "WATCHER") {
    return {
      templateName: INTERAKT_TEMPLATES.ADDED_AS_WATCHER,
      bodyValues: [name, primaryTitle, creatorName || "—", dueWhatsApp],
    };
  }

  if (titles.length > 1) {
    return {
      templateName: INTERAKT_TEMPLATES.MULTIPLE_TASKS,
      bodyValues: [name, String(titles.length)],
    };
  }

  return {
    templateName: INTERAKT_TEMPLATES.TASK_ADD,
    bodyValues: [name, primaryTitle, creatorName || "—", dueWhatsApp],
  };
}

async function sendTaskCreatedNotificationsAsync({
  taskId,
  titles,
  dueAt,
  creatorName,
  creatorId,
  assigneeId,
  teamId,
  memberEntries = [],
}) {
  const recipients = new Map();

  if (assigneeId) {
    recipients.set(Number(assigneeId), "ASSIGNEE");
  }

  for (const { userId, role } of memberEntries) {
    if (!recipients.has(userId)) {
      recipients.set(userId, role);
    }
  }

  if (teamId) {
    const members = await User.findAll({
      where: { team_id: teamId, is_active: true },
      attributes: ["id"],
    });
    const team = await Team.findByPk(teamId, { attributes: ["manager_id"] });
    for (const id of [...members.map((m) => m.id), team?.manager_id].filter(Boolean)) {
      if (!recipients.has(id)) recipients.set(id, "ASSIGNEE");
    }
  }

  if (creatorId) recipients.delete(Number(creatorId));
  if (recipients.size === 0) return;

  const users = await User.findAll({
    where: { id: { [Op.in]: [...recipients.keys()] }, is_active: true },
    attributes: ["id", "name", "email", "phone"],
  });

  const taskUrl = `${appBaseUrl()}/tasks/${taskId}`;
  const dueLabel = fmtDue(dueAt);
  const dueWhatsApp = fmtDueWhatsApp(dueAt);
  const primaryTitle = titles[0] || "New task";
  const titleLabel = titles.length > 1 ? `${titles.length} new tasks` : primaryTitle;

  for (const user of users) {
    const role = recipients.get(user.id) || "ASSIGNEE";
    const template = taskCreatedEmailTemplate({
      userName: user.name,
      role,
      taskTitle: titleLabel,
      taskTitles: titles,
      dueAt: dueLabel,
      creatorName,
      taskUrl,
    });

    if (user.email) {
      await sendMail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }

    if (user.phone && config.interakt.apiKey) {
      const { templateName, bodyValues } = buildWhatsAppMessage({
        role,
        userName: user.name,
        titles,
        creatorName,
        dueWhatsApp,
      });

      try {
        await sendInteraktTemplate({ phone: user.phone, templateName, bodyValues });
      } catch (err) {
        logger.error(`WhatsApp to ${user.phone} failed (${templateName}): ${err.message}`);
      }
    }
  }
}

/** Fire-and-forget email + WhatsApp when a task is created (production only). */
export function sendTaskCreatedEmails(params) {
  if (config.env !== "production") return;

  setImmediate(() => {
    sendTaskCreatedNotificationsAsync(params).catch((err) => {
      logger.error(`Task created notification batch failed: ${err.message}`);
    });
  });
}

export default { sendTaskCreatedEmails };

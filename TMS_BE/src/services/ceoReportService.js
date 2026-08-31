import httpStatus from "http-status";
import Meta from "../models/Meta.js";
import User from "../models/User.js";
import config from "../config/config.js";
import logger from "../config/logger.js";
import ApiError from "../utils/ApiError.js";
import { buildReportsWorkbook } from "../lib/reportsExcel.js";
import { getReports, fetchReportTasksForExcel } from "./reportsService.js";
import { sendMail } from "./mailService.js";
import { ceoDailyReportEmail } from "./emailTemplateService.js";

/** Hardcoded daily Excel report recipients (not CEO users from DB). */
const CEO_DAILY_REPORT_RECIPIENTS = [
  "adminn@rentfoxxy.com",
  "pankkajyadav@rentfoxxy.com",
];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.ceoReport.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start/end of today in Asia/Kolkata — matches reports page "Today" filter. */
export function istTodayBounds(date = new Date()) {
  const [year, month, day] = istDateKey(date).split("-").map(Number);
  const since = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const until = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;
  return { createdFrom: since, createdTo: until };
}

async function resolveReportUser() {
  const ceo = await User.findOne({
    where: { role: "CEO", is_active: true },
    order: [["id", "ASC"]],
  });
  if (ceo) return ceo.get({ plain: true });

  const admin = await User.findOne({
    where: { role: "ADMIN", is_active: true },
    order: [["id", "ASC"]],
  });
  if (admin) return admin.get({ plain: true });

  throw new ApiError(httpStatus.NOT_FOUND, "No CEO or Admin user found to build the report");
}

async function buildCeoReportPackage() {
  const dateKey = istDateKey();
  const { createdFrom, createdTo } = istTodayBounds();
  const reportUser = await resolveReportUser();
  const reportOpts = { createdFrom, createdTo, overall: false };
  const reportData = await getReports(reportUser, reportOpts);
  const tasks = await fetchReportTasksForExcel(reportUser, { createdFrom, createdTo });
  const buffer = await buildReportsWorkbook({ reportData, tasks });
  const filename = `taskflow-reports-${dateKey}.xlsx`;
  const { subject, html, text } = ceoDailyReportEmail({
    dateKey,
    taskCount: tasks.length,
    summary: reportData.summary,
  });

  return { dateKey, filename, buffer, subject, html, text, taskCount: tasks.length, reportData };
}

export async function runDailyCeoReport({ trigger = "manual", force = false } = {}) {
  if (config.env !== "production") {
    return { skipped: true, reason: "not_production" };
  }

  const dateKey = istDateKey();
  const metaKey = `ceo_daily_report_${dateKey}`;

  if (!force) {
    const sent = await Meta.findByPk(metaKey);
    if (sent) {
      return { skipped: true, reason: "already_sent", dateKey };
    }
  }

  if (!force) {
    try {
      await Meta.create({ key: metaKey, value: String(Date.now()) });
    } catch {
      return { skipped: true, reason: "already_sent", dateKey };
    }
  }

  const pkg = await buildCeoReportPackage();

  const recipients = [];
  for (const email of CEO_DAILY_REPORT_RECIPIENTS) {
    await sendMail({
      to: email,
      subject: pkg.subject,
      html: pkg.html,
      text: pkg.text,
      attachments: [
        {
          filename: pkg.filename,
          content: Buffer.from(pkg.buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });
    recipients.push(email);
  }

  logger.info(`CEO daily report emailed to ${recipients.join(", ")} for ${pkg.dateKey} (${trigger})`);
  return { ok: true, dateKey: pkg.dateKey, recipients, taskCount: pkg.taskCount };
}

export default { runDailyCeoReport, istDateKey, istTodayBounds };

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import httpStatus from "http-status";
import Meta from "../models/Meta.js";
import User from "../models/User.js";
import config from "../config/config.js";
import logger from "../config/logger.js";
import ApiError from "../utils/ApiError.js";
import { buildReportsWorkbook } from "../lib/reportsExcel.js";
import {
  getQaPeopleFromReport,
  formatDailyReportWhatsAppDateLine,
} from "../lib/qaReportSummary.js";
import { getReports, fetchReportTasksForExcel } from "./reportsService.js";
import { sendMail } from "./mailService.js";
import { ceoDailyReportEmail } from "./emailTemplateService.js";
import { sendInteraktTemplate, INTERAKT_TEMPLATES } from "./interaktService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Daily Excel report recipients — email + WhatsApp (name, phone). */
const CEO_DAILY_REPORT_RECIPIENTS = [
  { name: "Kumar Bibhaw", email: "adminn@rentfoxxy.com", phone: "9535312310" },
  { name: "Pankaj", email: "pankkajyadav@rentfoxxy.com", phone: "8076473811" },
];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function appPublicBaseUrl() {
  const origins = config.corsOrigin || [];
  const https = origins.find((o) => o.startsWith("https://"));
  return (https || origins[0] || "http://localhost:6070").replace(/\/$/, "");
}

export function getReportsDir() {
  const base = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.join(__dirname, "../..", config.uploadDir);
  const dir = path.join(base, "reports");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function istDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.ceoReport.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start/end of a calendar day in Asia/Kolkata — matches reports page "Today" filter. */
export function istDayBounds(date = new Date()) {
  const [year, month, day] = istDateKey(date).split("-").map(Number);
  const since = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const until = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;
  return { createdFrom: since, createdTo: until };
}

/** @deprecated use istDayBounds */
export function istTodayBounds(date = new Date()) {
  return istDayBounds(date);
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

export async function buildCeoReportForDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const { createdFrom, createdTo } = istDayBounds(date);
  const reportUser = await resolveReportUser();
  const reportOpts = { createdFrom, createdTo, overall: false };
  const reportData = await getReports(reportUser, reportOpts);
  const tasks = await fetchReportTasksForExcel(reportUser, { createdFrom, createdTo });
  const buffer = await buildReportsWorkbook({ reportData, tasks });
  const filename = `taskflow-reports-${dateKey}.xlsx`;

  return {
    dateKey,
    filename,
    buffer,
    taskCount: tasks.length,
    reportData,
  };
}

function saveReportFile(filename, buffer) {
  const filePath = path.join(getReportsDir(), filename);
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
}

async function registerReportToken({ token, dateKey, filename, taskCount }) {
  const key = `ceo_report_token_${token}`;
  await Meta.upsert({
    key,
    value: JSON.stringify({ dateKey, filename, taskCount }),
  });
  return token;
}

export function publicReportPageUrl(token) {
  return `${appPublicBaseUrl()}/report/${token}`;
}

async function buildCeoReportPackage() {
  const dateKey = istDateKey();
  const built = await buildCeoReportForDateKey(dateKey);
  const token = randomUUID().replace(/-/g, "");
  saveReportFile(built.filename, built.buffer);
  await registerReportToken({
    token,
    dateKey: built.dateKey,
    filename: built.filename,
    taskCount: built.taskCount,
  });

  const downloadUrl = publicReportPageUrl(token);
  const qaPeople = getQaPeopleFromReport(built.reportData.people);
  const { subject, html, text } = ceoDailyReportEmail({
    dateKey: built.dateKey,
    taskCount: built.taskCount,
    summary: built.reportData.summary,
    downloadUrl,
    qaPeople,
  });

  return {
    dateKey: built.dateKey,
    filename: built.filename,
    buffer: built.buffer,
    subject,
    html,
    text,
    taskCount: built.taskCount,
    reportData: built.reportData,
    token,
    downloadUrl,
  };
}

async function sendDailyReportWhatsApp({ dateKey, token, qaPeople = [] }) {
  if (!config.interakt.apiKey) return [];

  const dateLine = formatDailyReportWhatsAppDateLine(dateKey, qaPeople);
  const sent = [];
  for (const recipient of CEO_DAILY_REPORT_RECIPIENTS) {
    if (!recipient.phone) {
      logger.warn(`Daily report WhatsApp skipped — no phone for ${recipient.name}`);
      continue;
    }
    try {
      await sendInteraktTemplate({
        phone: recipient.phone,
        templateName: INTERAKT_TEMPLATES.DAILY_REPORT,
        bodyValues: [recipient.name || "User", dateLine],
        buttonValues: { "0": [token] },
      });
      sent.push(recipient.phone);
    } catch (err) {
      logger.error(`Daily report WhatsApp to ${recipient.phone} failed: ${err.message}`);
    }
  }
  return sent;
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

  const emailRecipients = [];
  for (const recipient of CEO_DAILY_REPORT_RECIPIENTS) {
    await sendMail({
      to: recipient.email,
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
    emailRecipients.push(recipient.email);
  }

  const whatsappRecipients = await sendDailyReportWhatsApp({
    dateKey: pkg.dateKey,
    token: pkg.token,
    qaPeople: getQaPeopleFromReport(pkg.reportData.people),
  });

  logger.info(
    `CEO daily report for ${pkg.dateKey}: emailed ${emailRecipients.join(", ")}; WhatsApp ${whatsappRecipients.length ? whatsappRecipients.join(", ") : "none"} (${trigger})`
  );

  return {
    ok: true,
    dateKey: pkg.dateKey,
    recipients: emailRecipients,
    whatsappRecipients,
    taskCount: pkg.taskCount,
    downloadUrl: pkg.downloadUrl,
    token: pkg.token,
  };
}

export default {
  runDailyCeoReport,
  istDateKey,
  istTodayBounds,
  istDayBounds,
  buildCeoReportForDateKey,
  getReportsDir,
  publicReportPageUrl,
  appPublicBaseUrl,
};

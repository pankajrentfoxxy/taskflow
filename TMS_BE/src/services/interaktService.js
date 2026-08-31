import config from "../config/config.js";
import logger from "../config/logger.js";

const INTERAKT_URL = "https://api.interakt.ai/v1/public/message/";

export const INTERAKT_TEMPLATES = {
  TASK_ADD: "task_add",
  MULTIPLE_TASKS: "multiple_tasks",
  ADDED_AS_COLLABORATOR: "added_as_collaborator",
  ADDED_AS_WATCHER: "added_as_watcher",
};

/** Parse stored phone into 10-digit local number for Interakt. */
export function parsePhoneForInterakt(phone) {
  if (phone == null || phone === "") return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

export async function sendInteraktTemplate({ phone, templateName, bodyValues, languageCode = "en" }) {
  if (!config.interakt.apiKey) {
    logger.warn("Interakt not configured — WhatsApp skipped");
    return { ok: false, skipped: true };
  }

  const phoneNumber = parsePhoneForInterakt(phone);
  if (!phoneNumber) {
    logger.warn(`WhatsApp skipped — invalid phone: ${phone}`);
    return { ok: false, skipped: true };
  }

  const auth = Buffer.from(`${config.interakt.apiKey}:`).toString("base64");
  const payload = {
    countryCode: config.interakt.countryCode,
    phoneNumber,
    type: "Template",
    template: {
      name: templateName,
      languageCode,
      bodyValues,
    },
  };

  const res = await fetch(INTERAKT_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    logger.error(`Interakt WhatsApp failed (${res.status}): ${text}`);
    throw new Error(data?.message || data?.error || `Interakt API error ${res.status}`);
  }

  logger.info(`WhatsApp sent to ${phoneNumber} via template ${templateName}`);
  return { ok: true, data };
}

export default { sendInteraktTemplate, parsePhoneForInterakt };

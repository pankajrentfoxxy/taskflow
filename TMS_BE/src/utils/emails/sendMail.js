import nodemailer from 'nodemailer';
import config from '../../config/config.js';
import logger from '../../config/logger.js';

let cachedTransporter = null;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const { host, port, auth } = config.email.smtp;
  if (!host || !auth.user || !auth.pass) {
    throw new Error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD in .env'
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: Number(port) === 465,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
  });

  return cachedTransporter;
};

/**
 * Send an email.
 * @param {Object} opts
 * @param {string|string[]} opts.to       - recipient(s)
 * @param {string}          opts.subject  - subject line
 * @param {string}          [opts.html]   - HTML body
 * @param {string}          [opts.text]   - plain-text body (auto-generated if omitted)
 * @param {string}          [opts.from]   - override "From" (defaults to EMAIL_FROM)
 * @param {string}          [opts.replyTo]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export const sendMail = async ({ to, subject, html, text, from, replyTo }) => {
  const transporter = getTransporter();

  const mailOptions = {
    from: from || config.email.from,
    to,
    subject,
    html,
    text: text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined),
    ...(replyTo ? { replyTo } : {}),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email send failed to ${to}: ${err.message}`);
    throw err;
  }
};

export default sendMail;

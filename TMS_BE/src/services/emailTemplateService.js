import config from "../config/config.js";

function layout({ title, bodyHtml, previewText }) {
  const appName = config.app.name;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${previewText || title}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:24px 28px 8px;text-align:center;">
              <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background:#18181b;color:#fff;font-weight:800;font-size:16px;">TF</div>
              <h1 style="margin:16px 0 0;font-size:20px;color:#18181b;">${appName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5;">
              If you did not request this, you can ignore this email. This code expires in ${config.otp.expiryMinutes} minutes.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetOtpTemplate({ userName, otp }) {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 20px;">Use the verification code below to reset your ${config.app.name} password:</p>
    <div style="margin:0 0 20px;padding:16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;text-align:center;">
      <span style="display:block;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#b91c1c;margin-bottom:8px;">Your OTP</span>
      <span style="font-size:32px;font-weight:800;letter-spacing:0.35em;color:#18181b;">${otp}</span>
    </div>
    <p style="margin:0;">Enter this code on the password reset screen. Do not share it with anyone.</p>
  `;

  const subject = `${config.app.name} password reset code: ${otp}`;
  const html = layout({
    title: "Password reset",
    previewText: `Your password reset code is ${otp}`,
    bodyHtml,
  });
  const text = `${greeting}\n\nYour ${config.app.name} password reset code is: ${otp}\n\nThis code expires in ${config.otp.expiryMinutes} minutes.`;

  return { subject, html, text };
}

export default { passwordResetOtpTemplate };

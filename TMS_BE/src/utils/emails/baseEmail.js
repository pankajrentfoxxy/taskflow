// ============================================================
// Doc-Ops Clinic — Reusable Email Template
// Pass any `content` HTML string — only the middle section changes.
// ============================================================

/**
 * @param {Object}   opts
 * @param {string}   opts.content        - HTML middle section for this email
 * @param {string}  [opts.previewText]   - inbox preview line
 */
export function buildEmail({ content, previewText = 'A message from Doc-Ops Clinic' }) {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Doc-Ops Clinic</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }

    body {
      background-color: #f0f4f8;
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #1a2e3b;
      min-height: 100vh;
      padding: 0;
      margin: 0;
    }

    .email-wrapper {
      width: 100%;
      background-color: #f0f4f8;
      padding: 40px 20px;
    }

    .email-container {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .email-header {
      background-color: #0b2d42;
      padding: 36px 48px 28px;
      text-align: left;
      position: relative;
    }
    .email-header::after {
      content: '';
      display: block;
      width: 60px;
      height: 3px;
      background-color: #2abfbf;
      margin-top: 18px;
    }
    .clinic-name {
      font-family: 'Georgia', serif;
      font-size: 26px;
      font-weight: normal;
      color: #ffffff;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .clinic-name span {
      color: #2abfbf;
    }
    .clinic-tagline {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #7aabbc;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, #2abfbf 0%, #0b2d42 100%);
    }

    .email-body {
      padding: 44px 48px 36px;
    }
    .email-body p {
      font-family: 'Arial', sans-serif;
      font-size: 15px;
      line-height: 1.75;
      color: #3a4f5c;
      margin-bottom: 16px;
    }
    .email-body h2 {
      font-family: 'Georgia', serif;
      font-size: 22px;
      color: #0b2d42;
      margin-bottom: 20px;
      font-weight: normal;
      letter-spacing: 0.5px;
    }
    .email-body h3 {
      font-family: 'Georgia', serif;
      font-size: 17px;
      color: #0b5c73;
      margin-bottom: 12px;
      font-weight: normal;
    }

    .btn-cta {
      display: inline-block;
      background-color: #0b2d42;
      color: #ffffff !important;
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 2px;
      margin-top: 8px;
      margin-bottom: 8px;
    }
    .btn-cta-outline {
      display: inline-block;
      background-color: transparent;
      color: #0b2d42 !important;
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      padding: 13px 30px;
      border-radius: 2px;
      border: 2px solid #0b2d42;
      margin-top: 8px;
    }

    .divider {
      border: none;
      border-top: 1px solid #dde5eb;
      margin: 28px 0;
    }

    .info-box {
      background-color: #f0f8fa;
      border-left: 4px solid #2abfbf;
      padding: 18px 22px;
      border-radius: 0 4px 4px 0;
      margin: 24px 0;
    }
    .info-box p {
      margin-bottom: 6px !important;
      font-size: 14px !important;
      color: #2a4455 !important;
    }
    .info-box .label {
      font-size: 11px !important;
      color: #7aabbc !important;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 4px !important;
    }

    .otp-block {
      background-color: #f0f8fa;
      border: 1px solid #c9e3e9;
      border-radius: 4px;
      padding: 28px 20px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'Courier New', monospace;
      font-size: 36px;
      letter-spacing: 14px;
      color: #0b2d42;
      font-weight: bold;
    }
    .otp-meta {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      color: #7aabbc;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 10px;
    }

    .email-footer {
      background-color: #0b2d42;
      padding: 28px 48px;
      text-align: center;
    }
    .footer-links {
      margin-bottom: 16px;
    }
    .footer-links a {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #7aabbc !important;
      text-decoration: none;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 0 12px;
    }
    .footer-copy {
      font-family: 'Arial', sans-serif;
      font-size: 11px;
      color: #4a7080;
      line-height: 1.6;
      letter-spacing: 0.5px;
    }
    .footer-copy a {
      color: #2abfbf;
      text-decoration: none;
    }

    @media only screen and (max-width: 600px) {
      .email-header  { padding: 28px 24px 22px; }
      .email-body    { padding: 32px 24px 28px; }
      .email-footer  { padding: 24px; }
      .clinic-name   { font-size: 20px; }
      .otp-code      { font-size: 28px; letter-spacing: 10px; }
    }
  </style>
</head>
<body>

<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  ${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
</div>

<div class="email-wrapper">
  <table class="email-container" width="100%" cellpadding="0" cellspacing="0" role="presentation">

    <tr><td class="accent-bar"></td></tr>

    <tr>
      <td class="email-header">
        <div class="clinic-name">Doc<span>-Ops</span></div>
        <div class="clinic-tagline">Clinic &amp; Healthcare</div>
      </td>
    </tr>

    <tr>
      <td class="email-body">
        ${content}
      </td>
    </tr>

    <tr>
      <td class="email-footer">
        <div class="footer-links">
          <a href="#">Appointments</a>
          <a href="#">Patient Portal</a>
          <a href="#">Contact Us</a>
          <a href="#">Unsubscribe</a>
        </div>
        <div class="footer-copy">
          &copy; ${new Date().getFullYear()} Doc-Ops Clinic. All rights reserved.<br/>
          123 Health Avenue, New Delhi, India<br/>
          <a href="mailto:care@doc-ops.in">care@doc-ops.in</a> &nbsp;|&nbsp; +91 98765 43210
        </div>
      </td>
    </tr>

  </table>
</div>

</body>
</html>
  `.trim();
}

// Small html-escape helper, exported so templates can reuse it.
export const escapeHtml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

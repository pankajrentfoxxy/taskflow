import 'dotenv/config';
import nodemailer from 'nodemailer';

console.log('SMTP_HOST     =', JSON.stringify(process.env.SMTP_HOST));
console.log('SMTP_PORT     =', JSON.stringify(process.env.SMTP_PORT));
console.log('SMTP_USERNAME =', JSON.stringify(process.env.SMTP_USERNAME));
console.log('SMTP_PASSWORD =', JSON.stringify(process.env.SMTP_PASSWORD));
console.log('  -> password char count:', (process.env.SMTP_PASSWORD || '').length);
console.log('EMAIL_FROM    =', JSON.stringify(process.env.EMAIL_FROM));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

(async () => {
  try {
    console.log('\nVerifying transporter...');
    await transporter.verify();
    console.log('OK — transporter can talk to SMTP server.');

    console.log('\nSending test email to:', process.env.SMTP_USERNAME);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USERNAME,
      subject: 'DMS SMTP test',
      text: 'If you see this, SMTP is wired up correctly.',
    });
    console.log('Sent. messageId =', info.messageId);
  } catch (err) {
    console.error('\nFAILED:');
    console.error('  name   :', err.name);
    console.error('  code   :', err.code);
    console.error('  command:', err.command);
    console.error('  message:', err.message);
    if (err.response) console.error('  response:', err.response);
  } finally {
    transporter.close();
  }
})();

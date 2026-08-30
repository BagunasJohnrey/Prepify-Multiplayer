import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const APP_URL = process.env.CLIENT_URL || "http://localhost:5173";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    })
  : null;

function parseFrom(from) {
  const match = /^(.*)\s*<(.+)>$/.exec(from);
  if (match) return { name: match[1].trim(), email: match[2] };
  return { email: from };
}

async function sendViaBrevoApi({ to, subject, html }) {
  const from = parseFrom(process.env.SMTP_FROM || "Prepify <no-reply@prepify.app>");
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: from,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

export async function sendMail({ to, subject, html }) {
  if (process.env.BREVO_API_KEY) {
    try {
      await sendViaBrevoApi({ to, subject, html });
      console.log('[mail:sent] To:', to, '| Subject:', subject, '| Via: Brevo API');
      return true;
    } catch (err) {
      console.error('[mail:error] To:', to, '| Error:', err.message, '| Via: Brevo API');
      return false;
    }
  }
  if (!transporter) {
    console.warn('[mail:skip] No BREVO_API_KEY or SMTP_HOST configured — email not sent to:', to);
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Prepify <no-reply@prepify.app>",
      to,
      subject,
      html,
    });
    console.log('[mail:sent] To:', to, '| Subject:', subject);
    return true;
  } catch (err) {
    console.error('[mail:error] To:', to, '| Error:', err.message, '| Code:', err.code, '| Command:', err.command || '(none)');
    return false;
  }
}

export const emailVerificationTemplate = (token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return {
    subject: "Verify your Prepify account",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0b0b12;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#12121b;border-radius:20px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px;text-align:center;background:linear-gradient(180deg,rgba(0,243,255,0.08) 0%,transparent 100%);">
              <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:2px;">PREPIFY</h1>
              <p style="margin:8px 0 0;font-size:11px;color:#6b7280;letter-spacing:3px;text-transform:uppercase;">AI-Powered Exam Prep</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 30px;text-align:center;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Verify your email</h2>
              <p style="margin:0 0 8px;font-size:15px;color:#9ca3af;line-height:1.6;">Thanks for joining Prepify! Click the button below to confirm your email and unlock all features.</p>
              <p style="margin:0 0 32px;font-size:13px;color:#6b7280;">This link expires in 24 hours.</p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#00f3ff 0%,#00c4cc 100%);color:#0b0b12;padding:14px 40px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:0.5px;">Verify Email</a>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding:24px 40px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or copy this link:</p>
              <p style="margin:0;font-size:12px;color:#00f3ff;word-break:break-all;">${link}</p>
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table width="480" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">If you didn't create an account, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
};

export const passwordResetTemplate = (token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return {
    subject: "Reset your Prepify password",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0b0b12;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#12121b;border-radius:20px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px;text-align:center;background:linear-gradient(180deg,rgba(188,19,254,0.08) 0%,transparent 100%);">
              <h1 style="margin:0;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:2px;">PREPIFY</h1>
              <p style="margin:8px 0 0;font-size:11px;color:#6b7280;letter-spacing:3px;text-transform:uppercase;">AI-Powered Exam Prep</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 30px;text-align:center;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#ffffff;">Password Reset</h2>
              <p style="margin:0 0 8px;font-size:15px;color:#9ca3af;line-height:1.6;">We received a request to reset your password. Click below to set a new one.</p>
              <p style="margin:0 0 32px;font-size:13px;color:#6b7280;">This link expires in 1 hour.</p>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#bc13fe 0%,#9b11d9 100%);color:#ffffff;padding:14px 40px;border-radius:12px;font-weight:800;font-size:15px;text-decoration:none;letter-spacing:0.5px;">Reset Password</a>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:rgba(255,255,255,0.06);"></div>
            </td>
          </tr>
          <!-- Fallback link -->
          <tr>
            <td style="padding:24px 40px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or copy this link:</p>
              <p style="margin:0;font-size:12px;color:#bc13fe;word-break:break-all;">${link}</p>
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table width="480" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
};

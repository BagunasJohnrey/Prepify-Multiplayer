import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const APP_URL = process.env.CLIENT_URL || "http://localhost:5173";

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

export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.warn('[mail:skip] No SMTP_HOST configured — email not sent to:', to);
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
          <!-- Icon -->
          <tr>
            <td align="center" style="padding:20px 0 10px;">
              <div style="width:64px;height:64px;border-radius:16px;background:rgba(0,243,255,0.1);display:inline-block;line-height:64px;text-align:center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00f3ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:10px 40px 30px;text-align:center;">
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
          <!-- Icon -->
          <tr>
            <td align="center" style="padding:20px 0 10px;">
              <div style="width:64px;height:64px;border-radius:16px;background:rgba(188,19,254,0.1);display:inline-block;line-height:64px;text-align:center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bc13fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:10px 40px 30px;text-align:center;">
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

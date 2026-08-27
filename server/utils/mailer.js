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
    })
  : null;

export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    // Dev fallback: log to console so links are still usable locally
    console.log(`\n[mail:dev] To: ${to}\n[mail:dev] Subject: ${subject}\n[mail:dev] ${html.replace(/<[^>]+>/g, " ")}\n`);
    return true;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Prepify <no-reply@prepify.app>",
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("sendMail error:", err.message);
    return false;
  }
}

export const emailVerificationTemplate = (token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return {
    subject: "Verify your Prepify account",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#00f3ff">Verify your email</h2>
      <p>Thanks for joining Prepify! Confirm your email to unlock all features.</p>
      <a href="${link}" style="display:inline-block;background:#00f3ff;color:#000;padding:12px 24px;border-radius:10px;font-weight:bold;text-decoration:none">Verify Email</a>
      <p style="color:#888;font-size:12px;margin-top:16px">Or paste this link: ${link}</p>
    </div>`,
  };
};

export const passwordResetTemplate = (token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return {
    subject: "Reset your Prepify password",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#bc13fe">Password Reset</h2>
      <p>We received a request to reset your password. This link expires in 1 hour.</p>
      <a href="${link}" style="display:inline-block;background:#bc13fe;color:#fff;padding:12px 24px;border-radius:10px;font-weight:bold;text-decoration:none">Reset Password</a>
      <p style="color:#888;font-size:12px;margin-top:16px">Or paste this link: ${link}</p>
    </div>`,
  };
};

// src/services/email.service.js
import { sendMail } from "../config/mailer.js";

/**
 * Generic email sender (Resend in prod, console in dev)
 */
export async function sendGenericEmail({ to, subject, html }) {
  if (!to || !subject || !html) throw new Error("to, subject, html required");
  return await sendMail({ to, subject, html });
}

/**
 * OTP email (kept simple)
 */
export async function sendOtpEmail({ to, name = "there", otp, minutes = 10 }) {
  const html = `
    <p>Hi ${name},</p>
    <p>Your Global Edge verification code is <b style="font-size:18px">${otp}</b>.</p>
    <p>This code expires in ${minutes} minutes.</p>
  `;
  return await sendMail({ to, subject: "Verify your email", html });
}

/**
 * Shipment status update email
 */
export async function sendShipmentUpdateEmail({ to, trackingNumber, status, message }) {
  const html = `
    <p>Update on your shipment <b>${trackingNumber}</b>:</p>
    <p>Status: <b>${status}</b></p>
    ${message ? `<p>${message}</p>` : ""}
  `;
  return await sendMail({
    to,
    subject: `Shipment ${trackingNumber} — ${status}`,
    html,
  });
}

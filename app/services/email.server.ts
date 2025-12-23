import nodemailer from "nodemailer";
import Telbiz from "telbiz";
import { prisma } from "./database.server";

// Admin email for notifications
const ADMIN_EMAIL = "xaosao95@gmail.com";

// Initialize Telbiz SMS client
const tb = new Telbiz(
  process.env.TELBIZ_CLIENT_ID as string,
  process.env.TELBIZ_SECRETKEY as string
);

// Create transporter - using Gmail SMTP
// Note: For production, you should use environment variables for credentials
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "", // Use App Password for Gmail
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Email not sent.");
      return false;
    }

    await transporter.sendMail({
      from: `"XaoSao Admin" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error("SEND_EMAIL_FAILED", error);
    return false;
  }
}

// ========================================
// Pending Model Notification
// ========================================

interface PendingModel {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  tel: number;
  createdAt: Date;
}

export async function notifyNewPendingModel(model: PendingModel): Promise<boolean> {
  const subject = `[XaoSao] New Model Registration Pending Approval`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Model Registration</h2>
          <p style="margin: 5px 0 0;">A new model is waiting for approval</p>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">Name:</span>
            <span class="value">${model.firstName} ${model.lastName || ""}</span>
          </div>
          <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">${model.email}</span>
          </div>
          <div class="info-row">
            <span class="label">Phone:</span>
            <span class="value">${model.tel}</span>
          </div>
          <div class="info-row">
            <span class="label">Registered At:</span>
            <span class="value">${new Date(model.createdAt).toLocaleString()}</span>
          </div>

          <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard/models/approval/${model.id}" class="button">
            Review Application
          </a>
        </div>
        <div class="footer">
          <p>This is an automated notification from XaoSao Admin System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
  });
}

// ========================================
// Pending Transaction Notification
// ========================================

interface PendingTransaction {
  id: string;
  amount: number;
  identifier: string;
  reason: string | null;
  createdAt: Date;
  model?: {
    firstName: string;
    lastName: string | null;
  } | null;
}

export async function notifyNewPendingTransaction(transaction: PendingTransaction): Promise<boolean> {
  const subject = `[XaoSao] New Transaction Pending Approval - ${transaction.amount.toLocaleString()} LAK`;

  const modelName = transaction.model
    ? `${transaction.model.firstName} ${transaction.model.lastName || ""}`
    : "Unknown";

  const transactionType = transaction.identifier === "withdraw" ? "Withdrawal" : transaction.identifier;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Transaction Pending</h2>
          <p style="margin: 5px 0 0;">A transaction requires your approval</p>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">Amount:</span>
            <span class="amount">${transaction.amount.toLocaleString()} LAK</span>
          </div>
          <div class="info-row">
            <span class="label">Type:</span>
            <span class="value">${transactionType}</span>
          </div>
          <div class="info-row">
            <span class="label">Model:</span>
            <span class="value">${modelName}</span>
          </div>
          <div class="info-row">
            <span class="label">Reason:</span>
            <span class="value">${transaction.reason || "N/A"}</span>
          </div>
          <div class="info-row">
            <span class="label">Requested At:</span>
            <span class="value">${new Date(transaction.createdAt).toLocaleString()}</span>
          </div>

          <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard/transactions" class="button">
            Review Transaction
          </a>
        </div>
        <div class="footer">
          <p>This is an automated notification from XaoSao Admin System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
  });
}

// ========================================
// Daily Summary Notification (Optional)
// ========================================

export async function sendDailySummary(): Promise<boolean> {
  try {
    const [pendingModels, pendingTransactions] = await Promise.all([
      prisma.model.count({ where: { status: "pending" } }),
      prisma.transaction_history.count({ where: { status: "pending" } }),
    ]);

    if (pendingModels === 0 && pendingTransactions === 0) {
      console.log("No pending items. Skipping daily summary.");
      return true;
    }

    const subject = `[XaoSao] Daily Summary - ${pendingModels} Models, ${pendingTransactions} Transactions Pending`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
          .stat-card { display: inline-block; width: 45%; margin: 10px 2%; padding: 20px; background: white; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .stat-number { font-size: 36px; font-weight: bold; color: #ec4899; }
          .stat-label { color: #6b7280; margin-top: 5px; }
          .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">Daily Summary</h2>
            <p style="margin: 5px 0 0;">${new Date().toLocaleDateString()}</p>
          </div>
          <div class="content">
            <div style="text-align: center;">
              <div class="stat-card">
                <div class="stat-number">${pendingModels}</div>
                <div class="stat-label">Pending Models</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${pendingTransactions}</div>
                <div class="stat-label">Pending Transactions</div>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard" class="button">
                Go to Dashboard
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated daily summary from XaoSao Admin System.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: ADMIN_EMAIL,
      subject,
      html,
    });
  } catch (error) {
    console.error("SEND_DAILY_SUMMARY_FAILED", error);
    return false;
  }
}

// ========================================
// SMS Notification Helper
// ========================================

async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    if (!process.env.TELBIZ_CLIENT_ID || !process.env.TELBIZ_SECRETKEY) {
      console.warn("Telbiz credentials not configured. SMS not sent.");
      return false;
    }

    // Format phone number for Telbiz (expects 20xxxxxxxx or 30xxxxxxx format without country code)
    let formattedPhone = phone.toString();

    // Remove country code 856 if present
    if (formattedPhone.startsWith("856")) {
      formattedPhone = formattedPhone.substring(3);
    }

    // Remove leading zeros
    formattedPhone = formattedPhone.replace(/^0+/, "");

    // Validate format: should be 10 digits starting with 20 or 30
    if (!formattedPhone.match(/^(20|30)\d{8}$/)) {
      console.warn(`Invalid phone number format: ${formattedPhone}. Expected 20xxxxxxxx or 30xxxxxxx`);
      return false;
    }

    await tb.SendSMSAsync("OTP", formattedPhone, message);
    console.log(`SMS sent to ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error("SEND_SMS_FAILED", error);
    return false;
  }
}

// ========================================
// Model Approval/Rejection Notifications
// ========================================

interface ModelNotificationData {
  id: string;
  firstName: string;
  lastName: string | null;
  whatsapp: number | null;
}

export async function notifyModelApproved(model: ModelNotificationData): Promise<void> {
  const modelName = `${model.firstName} ${model.lastName || ""}`.trim();

  // Send SMS only
  if (model.whatsapp) {
    const smsMessage = `XaoSao: ຍິນດີດ້ວຍ ${modelName}! ບັນຊີຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເລີ່ມຕົ້ນ.`;
    console.log(`Sending approval SMS to ${model.whatsapp}: ${smsMessage}`);
    sendSMS(model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send model approval SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send approval SMS");
  }
}

export async function notifyModelRejected(model: ModelNotificationData): Promise<void> {
  const modelName = `${model.firstName} ${model.lastName || ""}`.trim();

  // Send SMS only
  if (model.whatsapp) {
    const smsMessage = `XaoSao: ສະບາຍດີ ${modelName}, ບັນຊີຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດໃນຄັ້ງນີ້. ກະລຸນາຕິດຕໍ່ພວກເຮົາສຳລັບຂໍ້ມູນເພີ່ມເຕີມ. 2093033918`;
    console.log(`Sending rejection SMS to ${model.whatsapp}: ${smsMessage}`);
    sendSMS(model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send model rejection SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send rejection SMS");
  }
}

// ========================================
// Transaction Approval/Rejection Notifications
// ========================================

interface TransactionNotificationData {
  id: string;
  amount: number;
  identifier: string;
  model?: {
    firstName: string;
    lastName: string | null;
    whatsapp: number | null;
  } | null;
  rejectReason?: string | null;
}

export async function notifyTransactionApproved(transaction: TransactionNotificationData): Promise<void> {
  if (!transaction.model) return;

  const transactionType = transaction.identifier === "withdrawal" ? "ການຖອນເງິນ" : transaction.identifier;

  // Send SMS only
  if (transaction.model.whatsapp) {
    const smsMessage = `XaoSao: ${transactionType} ${transaction.amount.toLocaleString()} LAK ຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ!`;
    console.log(`Sending transaction approval SMS to ${transaction.model.whatsapp}: ${smsMessage}`);
    sendSMS(transaction.model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send transaction approval SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send transaction approval SMS");
  }
}

export async function notifyTransactionRejected(transaction: TransactionNotificationData): Promise<void> {
  if (!transaction.model) return;

  const transactionType = transaction.identifier === "withdrawal" ? "ການຖອນເງິນ" : transaction.identifier;

  // Send SMS only
  if (transaction.model.whatsapp) {
    const smsMessage = `XaoSao: ${transactionType} ${transaction.amount.toLocaleString()} LAK ຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ. ກະລຸນາຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ. 2093033918`;
    console.log(`Sending transaction rejection SMS to ${transaction.model.whatsapp}: ${smsMessage}`);
    sendSMS(transaction.model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send transaction rejection SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send transaction rejection SMS");
  }
}
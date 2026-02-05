import nodemailer from "nodemailer";
import Telbiz from "telbiz";
import webpush from "web-push";
import { prisma } from "./database.server";

// Admin email for notifications
const ADMIN_EMAIL = "xaosao95@gmail.com";

// ========================================
// VAPID Configuration for Push Notifications
// ========================================
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:xaosao95@gmail.com";

// Only configure if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[Push Admin] Web Push configured with VAPID keys");
} else {
  console.warn("[Push Admin] VAPID keys not configured. Push notifications disabled.");
}

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

  // 1. Create in-app notification
  await createModelNotification(model.id, {
    type: "profile_approved",
    title: "ບັນຊີໄດ້ຮັບການອະນຸມັດ!",
    message: `ຍິນດີດ້ວຍ ${modelName}! ບັນຊີຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ທ່ານສາມາດຮັບການຈອງຈາກລູກຄ້າໄດ້ແລ້ວ.`,
    data: {},
  });

  // 2. Send SMS
  if (model.whatsapp) {
    const smsMessage = `XaoSao: ຍິນດີດ້ວຍ ${modelName}! ບັນຊີຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເລີ່ມຕົ້ນຮັບການຈອງ.`;
    console.log(`Sending approval SMS to ${model.whatsapp}: ${smsMessage}`);
    sendSMS(model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send model approval SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send approval SMS");
  }

  // 3. Send push notification
  await sendPushToModel(model.id, {
    title: "ບັນຊີໄດ້ຮັບການອະນຸມັດ! 🎉",
    body: `ຍິນດີດ້ວຍ ${modelName}! ທ່ານສາມາດຮັບການຈອງຈາກລູກຄ້າໄດ້ແລ້ວ.`,
    tag: `profile-approved-${model.id}`,
    data: {
      type: "profile_approved",
      url: "/model",
    },
  });

  console.log(`[Notification Admin] Model approval notifications sent to ${model.id}`);
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

export async function notifyTransactionApproved(transaction: TransactionNotificationData & { modelId?: string }): Promise<void> {
  if (!transaction.model) return;

  const modelId = transaction.modelId;
  const modelName = `${transaction.model.firstName} ${transaction.model.lastName || ""}`.trim();
  const transactionType = transaction.identifier === "withdrawal" ? "ການຖອນເງິນ" : transaction.identifier;
  const transactionTypeTitle = transaction.identifier === "withdrawal" ? "ການຖອນເງິນໄດ້ຮັບອະນຸມັດ!" : "ທຸລະກຳໄດ້ຮັບອະນຸມັດ!";

  // 1. Create in-app notification
  if (modelId) {
    await createModelNotification(modelId, {
      type: "withdraw_approved",
      title: transactionTypeTitle,
      message: `${transactionType} ${transaction.amount.toLocaleString()} LAK ຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ.`,
      data: { transactionId: transaction.id, amount: transaction.amount },
    });
  }

  // 2. Send SMS
  if (transaction.model.whatsapp) {
    const smsMessage = `XaoSao: ${transactionType} ${transaction.amount.toLocaleString()} LAK ຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ!`;
    console.log(`Sending transaction approval SMS to ${transaction.model.whatsapp}: ${smsMessage}`);
    sendSMS(transaction.model.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send transaction approval SMS:", err)
    );
  } else {
    console.warn("Model has no whatsapp number, cannot send transaction approval SMS");
  }

  // 3. Send push notification
  if (modelId) {
    await sendPushToModel(modelId, {
      title: transactionTypeTitle,
      body: `${transactionType} ${transaction.amount.toLocaleString()} LAK ໄດ້ຮັບອະນຸມັດແລ້ວ!`,
      tag: `transaction-approved-${transaction.id}`,
      data: {
        type: "withdraw_approved",
        url: "/model/settings/wallet",
        amount: transaction.amount,
      },
    });
  }

  console.log(`[Notification Admin] Model withdrawal approval notifications sent to ${modelId || "unknown"}`);
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

// ========================================
// Customer Recharge/Deposit Notifications
// ========================================

interface CustomerRechargeNotificationData {
  id: string;
  amount: number;
  customerId: string;
  customer: {
    firstName: string;
    lastName: string | null;
    whatsapp: number | null;
  };
}

/**
 * Notify customer when their recharge/deposit is approved
 * Sends in-app notification, SMS, and push notification
 */
export async function notifyCustomerRechargeApproved(data: CustomerRechargeNotificationData): Promise<void> {
  const { id, amount, customerId, customer } = data;
  const customerName = `${customer.firstName} ${customer.lastName || ""}`.trim();

  console.log(`[Notification Admin] Sending recharge approval notifications to customer ${customerId}`);

  // 1. Create in-app notification
  await createCustomerNotification(customerId, {
    type: "deposit_approved",
    title: "ເງິນເຂົ້າບັນຊີແລ້ວ!",
    message: `ການເຕີມເງິນ ${amount.toLocaleString()} LAK ຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ຍອດເງິນໄດ້ເພີ່ມໃສ່ Wallet ຂອງທ່ານແລ້ວ.`,
    data: { transactionId: id, amount },
  });

  // 2. Send SMS
  if (customer.whatsapp) {
    const smsMessage = `XaoSao: ສະບາຍດີ ${customerName}! ການເຕີມເງິນ ${amount.toLocaleString()} LAK ຂອງທ່ານໄດ້ຮັບການອະນຸມັດແລ້ວ. ກວດເບິ່ງ Wallet ຂອງທ່ານໃນແອັບ.`;
    console.log(`Sending recharge approval SMS to ${customer.whatsapp}: ${smsMessage}`);
    sendSMS(customer.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send recharge approval SMS:", err)
    );
  } else {
    console.warn(`Customer ${customerId} has no whatsapp number, cannot send recharge approval SMS`);
  }

  // 3. Send push notification
  await sendPushToCustomer(customerId, {
    title: "ເງິນເຂົ້າບັນຊີແລ້ວ! 💰",
    body: `${amount.toLocaleString()} LAK ໄດ້ເພີ່ມໃສ່ Wallet ຂອງທ່ານແລ້ວ`,
    tag: `recharge-approved-${id}`,
    data: {
      type: "deposit_approved",
      url: "/customer/wallets",
      amount,
    },
  });

  console.log(`[Notification Admin] Customer recharge approval notifications sent to ${customerId}`);
}

/**
 * Notify customer when their recharge/deposit is rejected
 * Sends in-app notification, SMS, and push notification
 */
export async function notifyCustomerRechargeRejected(data: CustomerRechargeNotificationData & { rejectReason?: string | null }): Promise<void> {
  const { id, amount, customerId, customer, rejectReason } = data;
  const customerName = `${customer.firstName} ${customer.lastName || ""}`.trim();

  console.log(`[Notification Admin] Sending recharge rejection notifications to customer ${customerId}`);

  // 1. Create in-app notification
  await createCustomerNotification(customerId, {
    type: "deposit_rejected",
    title: "ການເຕີມເງິນບໍ່ໄດ້ຮັບອະນຸມັດ",
    message: `ການເຕີມເງິນ ${amount.toLocaleString()} LAK ຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ.${rejectReason ? ` ເຫດຜົນ: ${rejectReason}` : ""} ກະລຸນາຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ.`,
    data: { transactionId: id, amount, rejectReason },
  });

  // 2. Send SMS
  if (customer.whatsapp) {
    const smsMessage = `XaoSao: ການເຕີມເງິນ ${amount.toLocaleString()} LAK ຂອງທ່ານບໍ່ໄດ້ຮັບການອະນຸມັດ.${rejectReason ? ` ເຫດຜົນ: ${rejectReason}` : ""} ຕິດຕໍ່: 2093033918`;
    console.log(`Sending recharge rejection SMS to ${customer.whatsapp}: ${smsMessage}`);
    sendSMS(customer.whatsapp.toString(), smsMessage).catch((err) =>
      console.error("Failed to send recharge rejection SMS:", err)
    );
  } else {
    console.warn(`Customer ${customerId} has no whatsapp number, cannot send recharge rejection SMS`);
  }

  // 3. Send push notification
  await sendPushToCustomer(customerId, {
    title: "ການເຕີມເງິນບໍ່ໄດ້ຮັບອະນຸມັດ",
    body: `${amount.toLocaleString()} LAK - ກະລຸນາຕິດຕໍ່ຝ່າຍຊ່ວຍເຫຼືອ`,
    tag: `recharge-rejected-${id}`,
    data: {
      type: "deposit_rejected",
      url: "/customer/wallets",
      amount,
    },
  });

  console.log(`[Notification Admin] Customer recharge rejection notifications sent to ${customerId}`);
}

// ========================================
// Push Notification Helper
// ========================================

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

/**
 * Send push notification to a model
 */
async function sendPushToModel(modelId: string, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[Push Admin] VAPID keys not configured, skipping push");
    return;
  }

  try {
    // Check if model has push notifications enabled
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { sendPushNoti: true },
    });

    if (!model?.sendPushNoti) {
      console.log(`[Push Admin] Model ${modelId} has push notifications disabled`);
      return;
    }

    // Get all subscriptions for this model
    const subscriptions = await prisma.push_subscription.findMany({
      where: { userType: "model", userId: modelId },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push Admin] No push subscriptions found for model ${modelId}`);
      return;
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/icon-72x72.png",
      tag: payload.tag || `notification-${Date.now()}`,
      data: {
        ...payload.data,
        url: payload.data?.url || "/model/notifications",
      },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
        sent++;
      } catch (error: any) {
        console.error(`[Push Admin] Failed to send to endpoint:`, error.statusCode || error.message);
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.push_subscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        }
      }
    }

    console.log(`[Push Admin] Sent ${sent}/${subscriptions.length} push notifications to model ${modelId}`);
  } catch (error) {
    console.error("[Push Admin] Error sending push notification:", error);
  }
}

// ========================================
// In-App Notification Helper
// ========================================

type NotificationType =
  | "profile_approved"
  | "referral_bonus"
  | "deposit_approved"
  | "withdraw_approved"
  | "welcome";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Create an in-app notification for a model
 */
async function createModelNotification(modelId: string, payload: NotificationPayload): Promise<void> {
  try {
    await prisma.model_notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data || {},
        isRead: false,
        modelId,
      },
    });
    console.log(`[Notification Admin] Created ${payload.type} notification for model ${modelId}`);
  } catch (error) {
    console.error("[Notification Admin] Failed to create notification:", error);
  }
}

// ========================================
// Referral Bonus Notification
// ========================================

interface ReferralBonusNotificationData {
  referrerId: string;
  referrerName: string;
  referrerWhatsapp: number | null;
  referredModelName: string;
  amount: number;
  transactionId?: string;
}

/**
 * Notify referrer model when they earn a referral bonus
 * Sends SMS, push notification, and creates in-app notification
 */
export async function notifyReferralBonusReceived(data: ReferralBonusNotificationData): Promise<void> {
  const { referrerId, referrerName, referrerWhatsapp, referredModelName, amount, transactionId } = data;
  console.log(`[Notification Admin] notifyReferralBonusReceived called with:`, { referrerId, referrerName, referrerWhatsapp, referredModelName, amount });

  // 1. Create in-app notification
  console.log(`[Notification Admin] Creating in-app notification for referrer ${referrerId}`);
  try {
    await createModelNotification(referrerId, {
      type: "referral_bonus",
      title: "ໄດ້ຮັບໂບນັດແນະນຳ!",
      message: `ທ່ານໄດ້ຮັບ ${amount.toLocaleString()} ກີບ ຈາກການແນະນຳ ${referredModelName}!`,
      data: { amount, referredModelName, transactionId },
    });
    console.log(`[Notification Admin] In-app notification created successfully`);
  } catch (err) {
    console.error(`[Notification Admin] Failed to create in-app notification:`, err);
  }

  // 2. Send SMS to referrer
  if (referrerWhatsapp) {
    const smsMessage = `XaoSao: ຍິນດີດ້ວຍ ${referrerName}! ທ່ານໄດ້ຮັບ ${amount.toLocaleString()} ກີບ ຈາກການແນະນຳໂມເດວ ${referredModelName}. ກວດເບິ່ງ Wallet ຂອງທ່ານໃນແອັບ.`;
    console.log(`[Notification Admin] Sending referral bonus SMS to ${referrerWhatsapp}: ${smsMessage}`);
    sendSMS(referrerWhatsapp.toString(), smsMessage).catch((err) =>
      console.error("[Notification Admin] Failed to send referral bonus SMS:", err)
    );
  } else {
    console.log(`[Notification Admin] Referrer ${referrerId} has no whatsapp number, skipping SMS`);
  }

  // 3. Send push notification
  await sendPushToModel(referrerId, {
    title: "ໄດ້ຮັບໂບນັດແນະນຳ! 🎉",
    body: `ທ່ານໄດ້ຮັບ ${amount.toLocaleString()} ກີບ ຈາກການແນະນຳ ${referredModelName}!`,
    tag: `referral-bonus-${transactionId || Date.now()}`,
    data: {
      type: "referral_bonus",
      url: "/model/settings/wallet",
      amount,
      referredModelName,
    },
  });

  console.log(`[Notification Admin] Referral bonus notifications sent to ${referrerId}`);
}

/**
 * Notify referrer when their referral is counted (for commission-eligible special/partner)
 * No bonus paid, but referral is tracked
 */
export async function notifyReferralTracked(data: {
  referrerId: string;
  referrerName: string;
  referrerWhatsapp: number | null;
  referredModelName: string;
  referrerType: string;
  totalReferred: number;
}): Promise<void> {
  const { referrerId, referrerName, referrerWhatsapp, referredModelName, referrerType, totalReferred } = data;
  console.log(`[Notification Admin] notifyReferralTracked called with:`, { referrerId, referrerName, referrerType, totalReferred });

  const commissionRate = referrerType === "partner" ? "4%" : "2%";

  // 1. Create in-app notification
  console.log(`[Notification Admin] Creating in-app notification for referrer ${referrerId}`);
  try {
    await createModelNotification(referrerId, {
      type: "referral_bonus",
      title: "ແນະນຳໂມເດວສຳເລັດ!",
      message: `${referredModelName} ໄດ້ຮັບການອະນຸມັດ! ທ່ານຈະໄດ້ຮັບ ${commissionRate} ຈາກການຈອງຂອງພວກເຂົາ.`,
      data: { referredModelName, totalReferred },
    });
    console.log(`[Notification Admin] In-app notification created successfully`);
  } catch (err) {
    console.error(`[Notification Admin] Failed to create in-app notification:`, err);
  }

  // 2. Send SMS to referrer
  if (referrerWhatsapp) {
    const smsMessage = `XaoSao: ຍິນດີດ້ວຍ ${referrerName}! ${referredModelName} ໄດ້ຮັບການອະນຸມັດ. ທ່ານຈະໄດ້ຮັບ ${commissionRate} ຈາກການຈອງຂອງພວກເຂົາ.`;
    console.log(`[Notification Admin] Sending referral tracked SMS to ${referrerWhatsapp}: ${smsMessage}`);
    sendSMS(referrerWhatsapp.toString(), smsMessage).catch((err) =>
      console.error("[Notification Admin] Failed to send referral tracked SMS:", err)
    );
  } else {
    console.log(`[Notification Admin] Referrer ${referrerId} has no whatsapp number, skipping SMS`);
  }

  // 3. Send push notification
  console.log(`[Notification Admin] Sending push notification to referrer ${referrerId}`);
  await sendPushToModel(referrerId, {
    title: "ແນະນຳໂມເດວສຳເລັດ! ✨",
    body: `${referredModelName} ໄດ້ຮັບການອະນຸມັດ! ທ່ານຈະໄດ້ຮັບ ${commissionRate} ຈາກການຈອງຂອງພວກເຂົາ.`,
    tag: `referral-tracked-${Date.now()}`,
    data: {
      type: "referral_bonus",
      url: "/model/referral",
      referredModelName,
      totalReferred,
    },
  });

  console.log(`[Notification Admin] Referral tracked notifications sent to ${referrerId}`);
}

/**
 * Notify referrer model when they earn commission from a booking
 * Sends SMS, push notification, and creates in-app notification
 */
export async function notifyBookingCommissionEarned(data: {
  referrerId: string;
  referrerName: string;
  referrerWhatsapp: number | null;
  bookedModelName: string;
  bookingId: string;
  bookingPrice: number;
  commissionAmount: number;
  commissionRate: number;
  transactionId: string;
}): Promise<void> {
  const {
    referrerId,
    referrerName,
    referrerWhatsapp,
    bookedModelName,
    bookingId,
    bookingPrice,
    commissionAmount,
    commissionRate,
    transactionId,
  } = data;
  console.log(`[Notification Admin] notifyBookingCommissionEarned called with:`, {
    referrerId,
    referrerName,
    bookedModelName,
    commissionAmount,
    commissionRate,
  });

  // 1. Create in-app notification
  console.log(`[Notification Admin] Creating in-app notification for referrer ${referrerId}`);
  try {
    await createModelNotification(referrerId, {
      type: "commission_earned",
      title: "ໄດ້ຮັບຄ່ານາຍໜ້າການຈອງ!",
      message: `ທ່ານໄດ້ຮັບ ${commissionAmount.toLocaleString()} ກີບ (${commissionRate * 100}%) ຈາກການຈອງຂອງ ${bookedModelName}!`,
      data: { commissionAmount, commissionRate, bookedModelName, bookingId, bookingPrice, transactionId },
    });
    console.log(`[Notification Admin] In-app notification created successfully`);
  } catch (err) {
    console.error(`[Notification Admin] Failed to create in-app notification:`, err);
  }

  // 2. Send SMS to referrer
  if (referrerWhatsapp) {
    const smsMessage = `XaoSao: ຍິນດີດ້ວຍ ${referrerName}! ທ່ານໄດ້ຮັບ ${commissionAmount.toLocaleString()} ກີບ (${commissionRate * 100}%) ຈາກການຈອງຂອງ ${bookedModelName}. ກວດເບິ່ງ Wallet ຂອງທ່ານໃນແອັບ.`;
    console.log(`[Notification Admin] Sending booking commission SMS to ${referrerWhatsapp}: ${smsMessage}`);
    sendSMS(referrerWhatsapp.toString(), smsMessage).catch((err) =>
      console.error("[Notification Admin] Failed to send booking commission SMS:", err)
    );
  } else {
    console.log(`[Notification Admin] Referrer ${referrerId} has no whatsapp number, skipping SMS`);
  }

  // 3. Send push notification
  console.log(`[Notification Admin] Sending push notification to referrer ${referrerId}`);
  await sendPushToModel(referrerId, {
    title: "ໄດ້ຮັບຄ່ານາຍໜ້າການຈອງ! 💰",
    body: `ທ່ານໄດ້ຮັບ ${commissionAmount.toLocaleString()} ກີບ (${commissionRate * 100}%) ຈາກການຈອງຂອງ ${bookedModelName}!`,
    tag: `booking-commission-${transactionId}`,
    data: {
      type: "commission_earned",
      url: "/model/settings/wallet",
      commissionAmount,
      bookingId,
    },
  });

  console.log(`[Notification Admin] Booking commission notifications sent to ${referrerId}`);
}

// ========================================
// Customer SMS Helper
// ========================================

/**
 * Get customer's WhatsApp number
 */
async function getCustomerPhone(customerId: string): Promise<number | null> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { whatsapp: true },
    });
    return customer?.whatsapp || null;
  } catch {
    return null;
  }
}

/**
 * Send SMS to a customer
 */
async function sendSMSToCustomer(customerId: string, message: string): Promise<void> {
  const phone = await getCustomerPhone(customerId);
  if (phone) {
    sendSMS(phone.toString(), message).catch((err) =>
      console.error("Failed to send SMS to customer:", err)
    );
  }
}

// ========================================
// Customer Push Notification Helper
// ========================================

/**
 * Send push notification to a customer
 */
async function sendPushToCustomer(customerId: string, payload: {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, any>;
}): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[Push Admin] VAPID keys not configured, skipping push");
    return;
  }

  try {
    // Check if customer has push notifications enabled
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { sendPushNoti: true },
    });

    if (!customer?.sendPushNoti) {
      console.log(`[Push Admin] Customer ${customerId} has push notifications disabled`);
      return;
    }

    // Get all subscriptions for this customer
    const subscriptions = await prisma.push_subscription.findMany({
      where: { userType: "customer", userId: customerId },
    });

    if (subscriptions.length === 0) {
      console.log(`[Push Admin] No push subscriptions found for customer ${customerId}`);
      return;
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: payload.tag || `notification-${Date.now()}`,
      data: {
        ...payload.data,
        url: payload.data?.url || "/customer/notifications",
      },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
        sent++;
      } catch (error: any) {
        console.error(`[Push Admin] Failed to send to customer endpoint:`, error.statusCode || error.message);
        // Remove invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.push_subscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        }
      }
    }

    console.log(`[Push Admin] Sent ${sent}/${subscriptions.length} push notifications to customer ${customerId}`);
  } catch (error) {
    console.error("[Push Admin] Error sending push notification to customer:", error);
  }
}

// ========================================
// Customer In-App Notification Helper
// ========================================

type CustomerNotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_completed"
  | "payment_released"
  | "payment_refunded"
  | "deposit_approved"
  | "deposit_rejected";

interface CustomerNotificationPayload {
  type: CustomerNotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Create an in-app notification for a customer
 */
async function createCustomerNotification(customerId: string, payload: CustomerNotificationPayload): Promise<void> {
  try {
    await prisma.customer_notification.create({
      data: {
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data || {},
        isRead: false,
        customerId,
      },
    });
    console.log(`[Notification Admin] Created ${payload.type} notification for customer ${customerId}`);
  } catch (error) {
    console.error("[Notification Admin] Failed to create customer notification:", error);
  }
}

// ========================================
// Admin Booking Complete/Refund Notifications
// ========================================

interface AdminBookingCompleteData {
  bookingId: string;
  customerId: string;
  modelId: string;
  serviceName: string;
  modelName: string;
  customerName: string;
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
  referrer?: {
    id: string;
    firstName: string;
    whatsapp: number | null;
    commissionAmount: number;
  } | null;
}

/**
 * Send notifications when admin completes a booking
 * Notifies: Customer, Model, and Referrer (if eligible)
 */
export async function notifyAdminBookingCompleted(data: AdminBookingCompleteData): Promise<void> {
  const {
    bookingId,
    customerId,
    modelId,
    serviceName,
    modelName,
    customerName,
    totalAmount,
    netAmount,
    referrer,
  } = data;

  console.log(`[Notification Admin] Sending booking complete notifications for booking ${bookingId}`);

  // 1. Notify Customer - Payment has been released
  await createCustomerNotification(customerId, {
    type: "payment_released",
    title: "Booking Completed",
    message: `Your booking for "${serviceName}" with ${modelName} has been completed. Payment of ${totalAmount.toLocaleString()} LAK has been released.`,
    data: { bookingId, modelId },
  });

  // Send SMS to customer
  const customerSmsMessage = `XaoSao: ການຈອງ "${serviceName}" ຂອງທ່ານກັບ ${modelName} ສຳເລັດແລ້ວ. ການຊຳລະເງິນ ${totalAmount.toLocaleString()} LAK ໄດ້ຖືກປ່ອຍແລ້ວ.`;
  sendSMSToCustomer(customerId, customerSmsMessage);

  // Send push to customer
  sendPushToCustomer(customerId, {
    title: "Booking Completed",
    body: `Your "${serviceName}" booking with ${modelName} is complete`,
    tag: `booking-complete-${bookingId}`,
    data: {
      type: "payment_released",
      bookingId,
      url: "/customer/dates-history",
    },
  });

  // 2. Notify Model - Payment has been received
  await createModelNotification(modelId, {
    type: "deposit_approved",
    title: "ໄດ້ຮັບເງິນແລ້ວ!",
    message: `ທ່ານໄດ້ຮັບ ${netAmount.toLocaleString()} LAK ຈາກການຈອງ "${serviceName}" ກັບ ${customerName}.`,
    data: { bookingId, customerId, amount: netAmount },
  });

  // Send SMS to model
  const modelPhone = await getModelPhone(modelId);
  if (modelPhone) {
    const modelSmsMessage = `XaoSao: ທ່ານໄດ້ຮັບ ${netAmount.toLocaleString()} LAK ຈາກການຈອງ "${serviceName}" ກັບ ${customerName}. ກວດເບິ່ງ Wallet ຂອງທ່ານ.`;
    sendSMS(modelPhone.toString(), modelSmsMessage).catch((err) =>
      console.error("Failed to send SMS to model:", err)
    );
  }

  // Send push to model
  await sendPushToModel(modelId, {
    title: "ໄດ້ຮັບເງິນແລ້ວ! 💰",
    body: `${netAmount.toLocaleString()} LAK ຈາກການຈອງ "${serviceName}"`,
    tag: `payment-released-${bookingId}`,
    data: {
      type: "payment_released",
      bookingId,
      url: "/model/settings/wallet",
    },
  });

  // 3. Notify Referrer (if eligible and has commission)
  if (referrer && referrer.commissionAmount > 0) {
    await createModelNotification(referrer.id, {
      type: "referral_bonus",
      title: "ໄດ້ຮັບຄ່ານາຍໜ້າ!",
      message: `ທ່ານໄດ້ຮັບ ${referrer.commissionAmount.toLocaleString()} LAK ຄ່ານາຍໜ້າຈາກການຈອງຂອງ ${modelName}.`,
      data: { bookingId, modelId, amount: referrer.commissionAmount },
    });

    // Send SMS to referrer
    if (referrer.whatsapp) {
      const referrerSmsMessage = `XaoSao: ຍິນດີດ້ວຍ ${referrer.firstName}! ທ່ານໄດ້ຮັບ ${referrer.commissionAmount.toLocaleString()} LAK ຄ່ານາຍໜ້າຈາກການຈອງຂອງ ${modelName}. ກວດເບິ່ງ Wallet ຂອງທ່ານ.`;
      sendSMS(referrer.whatsapp.toString(), referrerSmsMessage).catch((err) =>
        console.error("[SMS] Failed to send referral commission SMS:", err)
      );
    }

    // Send push to referrer
    await sendPushToModel(referrer.id, {
      title: "ໄດ້ຮັບຄ່ານາຍໜ້າ! 🎉",
      body: `${referrer.commissionAmount.toLocaleString()} LAK ຈາກການຈອງຂອງ ${modelName}`,
      tag: `referral-commission-${bookingId}`,
      data: {
        type: "referral_bonus",
        bookingId,
        url: "/model/settings/wallet",
      },
    });
  }

  console.log(`[Notification Admin] Admin booking complete notifications sent for booking ${bookingId}`);
}

/**
 * Helper to get model's phone number
 */
async function getModelPhone(modelId: string): Promise<number | null> {
  try {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { whatsapp: true },
    });
    return model?.whatsapp || null;
  } catch {
    return null;
  }
}

interface AdminBookingRefundData {
  bookingId: string;
  customerId: string;
  modelId: string;
  serviceName: string;
  modelName: string;
  customerName: string;
  refundAmount: number;
  reason?: string;
}

/**
 * Send notifications when admin refunds a booking
 * Notifies: Customer and Model
 */
export async function notifyAdminBookingRefunded(data: AdminBookingRefundData): Promise<void> {
  const {
    bookingId,
    customerId,
    modelId,
    serviceName,
    modelName,
    customerName,
    refundAmount,
    reason,
  } = data;

  console.log(`[Notification Admin] Sending booking refund notifications for booking ${bookingId}`);

  // 1. Notify Customer - Payment has been refunded
  await createCustomerNotification(customerId, {
    type: "payment_refunded",
    title: "Booking Refunded",
    message: `Your booking for "${serviceName}" has been refunded. ${refundAmount.toLocaleString()} LAK has been returned to your wallet.${reason ? ` Reason: ${reason}` : ""}`,
    data: { bookingId, modelId, amount: refundAmount },
  });

  // Send SMS to customer
  const customerSmsMessage = `XaoSao: ການຈອງ "${serviceName}" ຂອງທ່ານໄດ້ຖືກຄືນເງິນແລ້ວ. ${refundAmount.toLocaleString()} LAK ໄດ້ຖືກສົ່ງຄືນໃສ່ Wallet ຂອງທ່ານ.${reason ? ` ເຫດຜົນ: ${reason}` : ""}`;
  sendSMSToCustomer(customerId, customerSmsMessage);

  // Send push to customer
  sendPushToCustomer(customerId, {
    title: "Booking Refunded",
    body: `${refundAmount.toLocaleString()} LAK refunded for "${serviceName}"`,
    tag: `booking-refund-${bookingId}`,
    data: {
      type: "payment_refunded",
      bookingId,
      url: "/customer/wallets",
    },
  });

  // 2. Notify Model - Booking has been refunded
  await createModelNotification(modelId, {
    type: "deposit_approved",
    title: "ການຈອງຖືກຄືນເງິນ",
    message: `ການຈອງ "${serviceName}" ກັບ ${customerName} ໄດ້ຖືກຄືນເງິນໃຫ້ລູກຄ້າແລ້ວ.${reason ? ` ເຫດຜົນ: ${reason}` : ""}`,
    data: { bookingId, customerId },
  });

  // Send SMS to model
  const modelPhone = await getModelPhone(modelId);
  if (modelPhone) {
    const modelSmsMessage = `XaoSao: ການຈອງ "${serviceName}" ກັບ ${customerName} ໄດ້ຖືກຄືນເງິນໃຫ້ລູກຄ້າແລ້ວ.${reason ? ` ເຫດຜົນ: ${reason}` : ""}`;
    sendSMS(modelPhone.toString(), modelSmsMessage).catch((err) =>
      console.error("Failed to send SMS to model:", err)
    );
  }

  // Send push to model
  await sendPushToModel(modelId, {
    title: "ການຈອງຖືກຄືນເງິນ",
    body: `"${serviceName}" ກັບ ${customerName} ຖືກຄືນເງິນແລ້ວ`,
    tag: `booking-refund-model-${bookingId}`,
    data: {
      type: "booking_cancelled",
      bookingId,
      url: "/model/dating",
    },
  });

  console.log(`[Notification Admin] Admin booking refund notifications sent for booking ${bookingId}`);
}
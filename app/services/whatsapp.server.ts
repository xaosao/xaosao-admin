import { prisma } from "./database.server";
import Twilio from "twilio";

// ========================================
// Twilio WhatsApp Configuration
// ========================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

// Initialize Twilio client (lazy - only when credentials exist)
let twilioClient: ReturnType<typeof Twilio> | null = null;

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn("[WhatsApp] Twilio credentials not configured.");
    return null;
  }
  if (!twilioClient) {
    twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Format phone number for WhatsApp (expects whatsapp:+856XXXXXXXXXX format)
 * Laos numbers: 20xxxxxxxx or 30xxxxxxxx
 */
function formatPhoneForWhatsApp(phone: string | number | null): string | null {
  if (!phone) return null;

  let formattedPhone = phone.toString();

  // Remove any existing whatsapp: prefix
  formattedPhone = formattedPhone.replace(/^whatsapp:\+?/, "");

  // Remove country code 856 if present
  if (formattedPhone.startsWith("856")) {
    formattedPhone = formattedPhone.substring(3);
  }

  // Remove leading zeros
  formattedPhone = formattedPhone.replace(/^0+/, "");

  // Validate format: should be 10 digits starting with 20 or 30
  if (!formattedPhone.match(/^(20|30)\d{8}$/)) {
    console.warn(`[WhatsApp] Invalid phone number format: ${formattedPhone}`);
    return null;
  }

  return `whatsapp:+856${formattedPhone}`;
}

/**
 * Send WhatsApp message via Twilio
 */
// Track if we've hit the daily limit to avoid wasting API calls
let rateLimitHit = false;
let rateLimitResetTime: Date | null = null;

export function isWhatsAppRateLimited(): boolean {
  if (!rateLimitHit) return false;
  // Reset after 24 hours
  if (rateLimitResetTime && new Date() > rateLimitResetTime) {
    rateLimitHit = false;
    rateLimitResetTime = null;
    return false;
  }
  return true;
}

export async function sendWhatsApp(
  phone: string | number | null,
  message: string
): Promise<boolean> {
  try {
    if (isWhatsAppRateLimited()) {
      console.warn("[WhatsApp] Daily limit reached, skipping send.");
      return false;
    }

    const client = getTwilioClient();
    if (!client) {
      console.warn("[WhatsApp] Twilio not configured. Message not sent.");
      return false;
    }

    const to = formatPhoneForWhatsApp(phone);
    if (!to) {
      console.warn("[WhatsApp] Invalid phone number, message not sent.");
      return false;
    }

    await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to,
      body: message,
    });

    console.log(`[WhatsApp] Message sent to ${to}`);
    return true;
  } catch (error: any) {
    // Detect daily limit (error code 63038) and stop further attempts
    if (error?.code === 63038 || error?.status === 429) {
      rateLimitHit = true;
      rateLimitResetTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      console.error("[WhatsApp] Daily message limit reached. Stopping further WhatsApp sends until reset.");
    } else {
      console.error("[WhatsApp] SEND_FAILED", error);
    }
    return false;
  }
}

/**
 * Get model's WhatsApp number and WhatsApp preference
 */
async function getModelWhatsAppInfo(
  modelId: string
): Promise<{ phone: number | null; sendWhatsappNoti: boolean }> {
  try {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { whatsapp: true, sendWhatsappNoti: true },
    });
    return {
      phone: model?.whatsapp || null,
      sendWhatsappNoti: model?.sendWhatsappNoti ?? false,
    };
  } catch {
    return { phone: null, sendWhatsappNoti: false };
  }
}

/**
 * Get customer's WhatsApp number and WhatsApp preference
 */
async function getCustomerWhatsAppInfo(
  customerId: string
): Promise<{ phone: number | null; sendWhatsappNoti: boolean }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { whatsapp: true, sendWhatsappNoti: true },
    });
    return {
      phone: customer?.whatsapp || null,
      sendWhatsappNoti: customer?.sendWhatsappNoti ?? false,
    };
  } catch {
    return { phone: null, sendWhatsappNoti: false };
  }
}

/**
 * Send WhatsApp message to model (only if WhatsApp notifications are enabled)
 */
export async function sendWhatsAppToModel(
  modelId: string,
  message: string
): Promise<void> {
  const { phone, sendWhatsappNoti } = await getModelWhatsAppInfo(modelId);

  if (!sendWhatsappNoti) {
    console.log(
      `[WhatsApp] Model ${modelId} has WhatsApp notifications disabled, skipping`
    );
    return;
  }

  if (phone) {
    sendWhatsApp(phone, message).catch((err) =>
      console.error("[WhatsApp] Failed to send to model:", err)
    );
  }
}

/**
 * Send WhatsApp message to customer (only if WhatsApp notifications are enabled)
 */
export async function sendWhatsAppToCustomer(
  customerId: string,
  message: string
): Promise<void> {
  const { phone, sendWhatsappNoti } = await getCustomerWhatsAppInfo(customerId);

  if (!sendWhatsappNoti) {
    console.log(
      `[WhatsApp] Customer ${customerId} has WhatsApp notifications disabled, skipping`
    );
    return;
  }

  if (phone) {
    sendWhatsApp(phone, message).catch((err) =>
      console.error("[WhatsApp] Failed to send to customer:", err)
    );
  }
}

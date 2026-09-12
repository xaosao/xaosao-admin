import { prisma } from "./database.server";
import { notifyManyViaBackend, notifyViaBackend } from "./email.server";
import type { broadcast_notification } from "@prisma/client";

// ========================================
// Types
// ========================================

interface TargetUser {
  id: string;
  userType: "customer" | "model";
  firstName: string;
  lastName: string | null;
  phone: number | null;
  sendSMSNoti: boolean;
  sendPushNoti: boolean;
  sendWhatsappNoti: boolean;
}

interface BroadcastFilters {
  targetUserType: string;
  targetGender?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  targetCountry?: string | null;
  targetPackage?: string | null;
  targetService?: string | null;
  targetBooking?: string | null;
  targetImages?: string | null;
}

interface CreateBroadcastData {
  title: string;
  message: string;
  laTitle?: string | null;
  laMessage?: string | null;
  targetUserType: string;
  targetGender?: string | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  targetCountry?: string | null;
  targetPackage?: string | null;
  targetService?: string | null;
  targetBooking?: string | null;
  targetImages?: string | null;
  channelPush: boolean;
  channelInApp: boolean;
  scheduleType: string;
  scheduledAt?: Date | null;
  recurrence: string;
  recurrenceTime?: string | null;
  status: string;
  createdBy: string;
}

// ========================================
// Target User Queries
// ========================================

/**
 * Build age filter from min/max age
 * Converts age range to date-of-birth range
 */
function buildDobFilter(ageMin?: number | null, ageMax?: number | null): { gte?: Date; lte?: Date } | undefined {
  if (!ageMin && !ageMax) return undefined;

  const now = new Date();
  const filter: { gte?: Date; lte?: Date } = {};

  // ageMax = oldest person -> earliest DOB (gte)
  if (ageMax) {
    const earliest = new Date(now.getFullYear() - ageMax - 1, now.getMonth(), now.getDate());
    filter.gte = earliest;
  }

  // ageMin = youngest person -> latest DOB (lte)
  if (ageMin) {
    const latest = new Date(now.getFullYear() - ageMin, now.getMonth(), now.getDate());
    filter.lte = latest;
  }

  return filter;
}

/**
 * Map package filter value to subscription_plan durationDays
 */
const PACKAGE_DURATION_MAP: Record<string, number> = {
  "24h": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
};

/**
 * Get target customers matching filters
 */
async function getTargetCustomers(filters: BroadcastFilters): Promise<TargetUser[]> {
  const where: any = { status: "active" };

  if (filters.targetGender) {
    where.gender = filters.targetGender;
  }

  const dobFilter = buildDobFilter(filters.targetAgeMin, filters.targetAgeMax);
  if (dobFilter) {
    where.dob = dobFilter;
  }

  if (filters.targetCountry) {
    where.country = filters.targetCountry;
  }

  // Package filter
  if (filters.targetPackage === "free") {
    // Customers with NO active subscription
    const activeSubs = await prisma.subscription.findMany({
      where: { status: "active", endDate: { gte: new Date() } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const subscribedIds = activeSubs.map((s) => s.customerId);
    where.id = { notIn: subscribedIds };
  } else if (filters.targetPackage && PACKAGE_DURATION_MAP[filters.targetPackage]) {
    // Customers with a specific active subscription plan
    const days = PACKAGE_DURATION_MAP[filters.targetPackage];
    const plans = await prisma.subscription_plan.findMany({
      where: { durationDays: days },
      select: { id: true },
    });
    const planIds = plans.map((p) => p.id);
    if (planIds.length === 0) return [];

    const subs = await prisma.subscription.findMany({
      where: {
        planId: { in: planIds },
        status: "active",
        endDate: { gte: new Date() },
      },
      select: { customerId: true },
    });
    const customerIds = [...new Set(subs.map((s) => s.customerId))];
    if (customerIds.length === 0) return [];
    where.id = { in: customerIds };
  }

  // Images filter: customers with less than 6 images
  if (filters.targetImages === "incomplete") {
    const imageCounts = await prisma.images.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null } },
      _count: { id: true },
    });
    const completeIds = imageCounts
      .filter((g) => g._count.id >= 6)
      .map((g) => g.customerId)
      .filter(Boolean) as string[];
    if (where.id?.in) {
      where.id = { in: (where.id.in as string[]).filter((id: string) => !completeIds.includes(id)) };
    } else if (where.id?.notIn) {
      where.id = { notIn: [...where.id.notIn, ...completeIds] };
    } else {
      where.id = { notIn: completeIds };
    }
  }

  // Booking filter: customers who never booked
  if (filters.targetBooking === "never_booked") {
    const bookedCustomers = await prisma.service_booking.findMany({
      where: { customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const bookedIds = bookedCustomers.map((b) => b.customerId).filter(Boolean) as string[];
    if (where.id?.in) {
      // Intersect with package filter
      where.id = { in: (where.id.in as string[]).filter((id: string) => !bookedIds.includes(id)) };
    } else {
      where.id = { notIn: bookedIds };
    }
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      whatsapp: true,
      sendSMSNoti: true,
      sendPushNoti: true,
      sendWhatsappNoti: true,
    },
  });

  return customers.map((c) => ({
    id: c.id,
    userType: "customer" as const,
    firstName: c.firstName,
    lastName: c.lastName || null,
    phone: c.whatsapp || null,
    sendSMSNoti: c.sendSMSNoti,
    sendPushNoti: c.sendPushNoti,
    sendWhatsappNoti: c.sendWhatsappNoti,
  }));
}

/**
 * Get target models matching filters
 */
async function getTargetModels(filters: BroadcastFilters): Promise<TargetUser[]> {
  const where: any = { status: "active" };

  if (filters.targetGender) {
    where.gender = filters.targetGender;
  }

  const dobFilter = buildDobFilter(filters.targetAgeMin, filters.targetAgeMax);
  if (dobFilter) {
    where.dob = dobFilter;
  }

  // Service filter: models based on their model_service status
  if (filters.targetService === "no_service") {
    // Models who have NO available services
    const modelsWithService = await prisma.model_service.findMany({
      where: { isAvailable: true, status: "active" },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    const idsWithService = modelsWithService.map((ms) => ms.modelId).filter(Boolean) as string[];
    where.id = { notIn: idsWithService };
  } else if (filters.targetService === "drinking_only") {
    // Models who ONLY have drinkingFriend service available (no other services)
    const drinkingService = await prisma.service.findFirst({
      where: { name: "drinkingFriend" },
      select: { id: true },
    });

    if (!drinkingService) return [];

    // Models with drinkingFriend available
    const modelsWithDrinking = await prisma.model_service.findMany({
      where: { serviceId: drinkingService.id, isAvailable: true, status: "active" },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    const drinkingIds = new Set(modelsWithDrinking.map((m) => m.modelId));

    // Models with OTHER services available
    const modelsWithOther = await prisma.model_service.findMany({
      where: { serviceId: { not: drinkingService.id }, isAvailable: true, status: "active" },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    const otherIds = new Set(modelsWithOther.map((m) => m.modelId));

    // Only drinking = has drinking but NOT other services
    const drinkingOnlyIds = [...drinkingIds].filter((id) => id && !otherIds.has(id)) as string[];
    if (drinkingOnlyIds.length === 0) return [];
    where.id = { in: drinkingOnlyIds };
  }

  // Images filter: models with less than 6 images
  if (filters.targetImages === "incomplete") {
    const imageCounts = await prisma.images.groupBy({
      by: ["modelId"],
      where: { modelId: { not: null } },
      _count: { id: true },
    });
    const completeIds = imageCounts
      .filter((g) => g._count.id >= 6)
      .map((g) => g.modelId)
      .filter(Boolean) as string[];
    if (where.id?.in) {
      where.id = { in: (where.id.in as string[]).filter((id: string) => !completeIds.includes(id)) };
    } else if (where.id?.notIn) {
      where.id = { notIn: [...where.id.notIn, ...completeIds] };
    } else {
      where.id = { notIn: completeIds };
    }
  }

  // Booking filter: models who were never booked
  if (filters.targetBooking === "never_got_booked") {
    const bookedModels = await prisma.service_booking.findMany({
      where: { modelId: { not: null } },
      select: { modelId: true },
      distinct: ["modelId"],
    });
    const bookedIds = bookedModels.map((b) => b.modelId).filter(Boolean) as string[];
    if (where.id?.in) {
      where.id = { in: (where.id.in as string[]).filter((id: string) => !bookedIds.includes(id)) };
    } else if (where.id?.notIn) {
      where.id = { notIn: [...where.id.notIn, ...bookedIds] };
    } else {
      where.id = { notIn: bookedIds };
    }
  }

  const models = await prisma.model.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      whatsapp: true,
      sendSMSNoti: true,
      sendPushNoti: true,
      sendWhatsappNoti: true,
    },
  });

  return models.map((m) => ({
    id: m.id,
    userType: "model" as const,
    firstName: m.firstName,
    lastName: m.lastName || null,
    phone: m.whatsapp || null,
    sendSMSNoti: m.sendSMSNoti,
    sendPushNoti: m.sendPushNoti,
    sendWhatsappNoti: m.sendWhatsappNoti,
  }));
}

/**
 * Get all target users matching the notification filters
 */
async function getTargetUsers(filters: BroadcastFilters): Promise<TargetUser[]> {
  const users: TargetUser[] = [];

  if (filters.targetUserType === "customer" || filters.targetUserType === "all") {
    const customers = await getTargetCustomers(filters);
    users.push(...customers);
  }

  if (filters.targetUserType === "model" || filters.targetUserType === "all") {
    const models = await getTargetModels(filters);
    users.push(...models);
  }

  return users;
}

/**
 * Estimate recipient count for preview (used in create form)
 */
export async function estimateRecipients(filters: BroadcastFilters): Promise<number> {
  const users = await getTargetUsers(filters);
  return users.length;
}

// ========================================
// Template Variable Replacement
// ========================================

/**
 * Replace template variables like {{firstname}}, {{lastname}} with actual user data.
 * Case-insensitive matching.
 */
function replaceTemplateVars(text: string, user: TargetUser): string {
  return text
    .replace(/\{\{firstname\}\}/gi, user.firstName || "")
    .replace(/\{\{lastname\}\}/gi, user.lastName || "")
    .replace(/\{\{fullname\}\}/gi, [user.firstName, user.lastName].filter(Boolean).join(" "));
}

// ========================================
// Broadcast Sending
// ========================================

/**
 * Send broadcast notification to all target users
 */
export async function sendBroadcast(notificationId: string): Promise<void> {
  try {
    // Fetch notification (status is already "sending" — set by scheduler or create action)
    const notification = await prisma.broadcast_notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      console.error(`[Broadcast] Notification ${notificationId} not found`);
      return;
    }

    // Safety: skip if this notification was already sent/cancelled/failed
    if (["sent", "cancelled", "failed"].includes(notification.status)) {
      console.log(`[Broadcast] Notification ${notificationId} already in terminal state "${notification.status}", skipping`);
      return;
    }

    // Safety: skip if this one-time notification was already sent recently (dedup guard)
    if (notification.recurrence === "once" && notification.sentAt) {
      const sentAgo = Date.now() - new Date(notification.sentAt).getTime();
      if (sentAgo < 5 * 60 * 1000) { // within last 5 minutes
        console.log(`[Broadcast] Notification ${notificationId} was already sent ${Math.round(sentAgo / 1000)}s ago, skipping duplicate`);
        return;
      }
    }

    // If status isn't "sending" yet (e.g., called from create action for immediate send),
    // atomically claim it to prevent duplicates
    if (notification.status !== "sending") {
      const claimed = await prisma.broadcast_notification.updateMany({
        where: { id: notificationId, status: "scheduled" },
        data: { status: "sending" },
      });
      if (claimed.count === 0) {
        console.log(`[Broadcast] Notification ${notificationId} could not be claimed (status: ${notification.status}), skipping`);
        return;
      }
    }

    // Get target users
    const users = await getTargetUsers(notification);

    // Update total recipients
    await prisma.broadcast_notification.update({
      where: { id: notificationId },
      data: { totalRecipients: users.length },
    });

    // Delivery runs on xs_backend — in-app row, Firebase push for the
    // Android app, and Web Push for installed PWAs.
    const { sentCount, failedCount } = await deliverBroadcast(
      users,
      notification
    );

    // Calculate next run for recurring notifications
    let nextRunAt: Date | null = null;
    if (notification.recurrence !== "once" && notification.recurrenceTime) {
      nextRunAt = calculateNextRunAt(
        notification.recurrence,
        notification.recurrenceTime,
        notification.nextRunAt // pass the current nextRunAt as base
      );
    }

    // Update final stats
    if (nextRunAt) {
      // Recurring: set back to "scheduled" with new nextRunAt
      await prisma.broadcast_notification.update({
        where: { id: notificationId },
        data: {
          status: "scheduled",
          sentCount,
          failedCount,
          sentAt: new Date(),
          lastSentAt: new Date(),
          nextRunAt,
        },
      });
      console.log(`[Broadcast] Sent notification ${notificationId}: ${sentCount} sent, ${failedCount} failed. Next run: ${nextRunAt.toISOString()}`);
    } else {
      // One-time: mark as "sent" (final)
      await prisma.broadcast_notification.update({
        where: { id: notificationId },
        data: {
          status: "sent",
          sentCount,
          failedCount,
          sentAt: new Date(),
          lastSentAt: new Date(),
        },
      });
      console.log(`[Broadcast] Sent notification ${notificationId}: ${sentCount} sent, ${failedCount} failed`);
    }
  } catch (error) {
    console.error(`[Broadcast] Failed to send notification ${notificationId}:`, error);

    await prisma.broadcast_notification.update({
      where: { id: notificationId },
      data: { status: "failed" },
    }).catch(() => {});
  }
}

/**
 * True when the copy contains a per-recipient template variable.
 *
 * Text without variables is identical for everyone, so the whole audience
 * goes out in a few bulk calls. Text WITH variables has to be rendered per
 * user, which means one call each — correct, but much slower, so we only
 * pay for it when the admin actually used a variable.
 */
function hasTemplateVars(...texts: (string | null | undefined)[]): boolean {
  return texts.some((t) => !!t && /\{\{(firstname|lastname|fullname)\}\}/i.test(t));
}

/**
 * Deliver a broadcast to its resolved audience through xs_backend.
 *
 * Every transport lives on the backend: the in-app row, Firebase for the
 * Android app, and Web Push for installed PWAs (which is how iOS users
 * receive anything at all). The admin no longer writes notification rows
 * or sends push itself, so there is exactly one implementation of
 * delivery instead of one per caller.
 *
 * `channelInApp` and `channelPush` map onto the backend's `push` flag:
 * the in-app row is always written, and push is suppressed when the admin
 * left the push channel unticked.
 */
async function deliverBroadcast(
  users: TargetUser[],
  notification: broadcast_notification
): Promise<{ sentCount: number; failedCount: number }> {
  let sentCount = 0;
  let failedCount = 0;

  const wantsPush = notification.channelPush;
  const wantsInApp = notification.channelInApp;
  if (!wantsInApp && !wantsPush) {
    return { sentCount, failedCount };
  }

  const laTitle = (notification as { laTitle?: string | null }).laTitle ?? undefined;
  const laMessage =
    (notification as { laMessage?: string | null }).laMessage ?? undefined;
  const payloadData = { screen: "home", broadcastId: notification.id };

  const personalised = hasTemplateVars(
    notification.title,
    notification.message,
    laTitle,
    laMessage
  );

  // ── Personalised path: render per user, one call each ───────────────
  if (personalised) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) =>
          notifyViaBackend({
            userType: user.userType,
            userId: user.id,
            type: "admin_broadcast",
            title: replaceTemplateVars(notification.title, user),
            message: replaceTemplateVars(notification.message, user),
            la_title: laTitle ? replaceTemplateVars(laTitle, user) : undefined,
            la_message: laMessage
              ? replaceTemplateVars(laMessage, user)
              : undefined,
            is_admin: true,
            raw_text: true,
            data: payloadData,
            push: wantsPush,
          })
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled") sentCount++;
        else failedCount++;
      }
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    return { sentCount, failedCount };
  }

  // ── Uniform path: one call per 500 recipients, split by audience ────
  // The bulk endpoint takes a single userType, so customers and models go
  // in separate runs.
  const BULK_SIZE = 500;
  for (const userType of ["customer", "model"] as const) {
    const ids = users.filter((u) => u.userType === userType).map((u) => u.id);
    for (let i = 0; i < ids.length; i += BULK_SIZE) {
      const chunk = ids.slice(i, i + BULK_SIZE);
      const result = await notifyManyViaBackend({
        userType,
        userIds: chunk,
        type: "admin_broadcast",
        title: notification.title,
        message: notification.message,
        la_title: laTitle,
        la_message: laMessage,
        is_admin: true,
        raw_text: true,
        data: payloadData,
        push: wantsPush,
      });
      sentCount += result.ok;
      failedCount += result.failed;
    }
  }

  return { sentCount, failedCount };
}

// ========================================
// Scheduling Helpers
// ========================================

/**
 * Calculate the next run time for recurring notifications.
 * Uses the previous nextRunAt as base to preserve day-of-week for weekly.
 *
 * - Daily: same time tomorrow (relative to lastRunAt or now)
 * - Weekly: same day & time next week (e.g., every Monday 3:50 PM)
 */
function calculateNextRunAt(
  recurrence: string,
  recurrenceTime: string,
  lastRunAt?: Date | null
): Date {
  const [hours, minutes] = recurrenceTime.split(":").map(Number);
  const now = new Date();

  if (recurrence === "daily") {
    // Start from the last run date (or today) and add 1 day
    const base = lastRunAt ? new Date(lastRunAt) : new Date();
    base.setHours(hours, minutes, 0, 0);
    // Keep adding 1 day until we're in the future
    while (base <= now) {
      base.setDate(base.getDate() + 1);
    }
    return base;
  }

  if (recurrence === "weekly") {
    // Start from the last run date (preserves day-of-week) and add 7 days
    const base = lastRunAt ? new Date(lastRunAt) : new Date();
    base.setHours(hours, minutes, 0, 0);
    // Keep adding 7 days until we're in the future
    while (base <= now) {
      base.setDate(base.getDate() + 7);
    }
    return base;
  }

  // Fallback: schedule for tomorrow
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  next.setDate(next.getDate() + 1);
  return next;
}

/**
 * Calculate initial nextRunAt when creating/scheduling a recurring notification
 */
export function calculateInitialNextRunAt(
  scheduleType: string,
  scheduledAt: Date | null,
  recurrence: string,
  recurrenceTime: string | null
): Date | null {
  if (scheduleType === "immediate") return null;

  if (recurrence === "once") {
    return scheduledAt;
  }

  if (recurrenceTime) {
    // For daily/weekly: calculate first run based on scheduledAt (preserves day-of-week for weekly)
    return calculateNextRunAt(recurrence, recurrenceTime, scheduledAt);
  }

  return scheduledAt;
}

// ========================================
// CRUD Operations
// ========================================

/**
 * Get all broadcast notifications with pagination
 */
export async function getBroadcastNotifications(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<{ notifications: broadcast_notification[]; total: number; page: number; totalPages: number }> {
  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }

  const [notifications, total] = await Promise.all([
    prisma.broadcast_notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.broadcast_notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single broadcast notification by ID
 */
export async function getBroadcastNotification(id: string): Promise<broadcast_notification | null> {
  return prisma.broadcast_notification.findUnique({ where: { id } });
}

/**
 * Create a new broadcast notification
 */
export async function createBroadcastNotification(data: CreateBroadcastData): Promise<broadcast_notification> {
  const nextRunAt = calculateInitialNextRunAt(
    data.scheduleType,
    data.scheduledAt || null,
    data.recurrence,
    data.recurrenceTime || null
  );

  return prisma.broadcast_notification.create({
    data: {
      title: data.title,
      message: data.message,
      laTitle: data.laTitle || null,
      laMessage: data.laMessage || null,
      targetUserType: data.targetUserType,
      targetGender: data.targetGender || null,
      targetAgeMin: data.targetAgeMin || null,
      targetAgeMax: data.targetAgeMax || null,
      targetCountry: data.targetCountry || null,
      targetPackage: data.targetPackage || null,
      targetService: data.targetService || null,
      targetBooking: data.targetBooking || null,
      targetImages: data.targetImages || null,
      channelPush: data.channelPush,
      channelInApp: data.channelInApp,
      scheduleType: data.scheduleType,
      scheduledAt: data.scheduledAt || null,
      recurrence: data.recurrence,
      recurrenceTime: data.recurrenceTime || null,
      nextRunAt,
      status: data.status,
      createdBy: data.createdBy,
    },
  });
}

/**
 * Update a draft broadcast notification
 */
export async function updateBroadcastNotification(
  id: string,
  data: Partial<CreateBroadcastData>
): Promise<broadcast_notification> {
  const existing = await prisma.broadcast_notification.findUnique({ where: { id } });

  if (!existing || existing.status !== "draft") {
    throw new Error("Can only edit draft notifications");
  }

  const updateData: any = { ...data };

  // Recalculate nextRunAt if scheduling fields changed
  if (data.scheduleType || data.scheduledAt !== undefined || data.recurrence || data.recurrenceTime !== undefined) {
    updateData.nextRunAt = calculateInitialNextRunAt(
      data.scheduleType || existing.scheduleType,
      data.scheduledAt !== undefined ? data.scheduledAt : existing.scheduledAt,
      data.recurrence || existing.recurrence,
      data.recurrenceTime !== undefined ? data.recurrenceTime : existing.recurrenceTime
    );
  }

  return prisma.broadcast_notification.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Cancel a scheduled broadcast notification
 */
export async function cancelBroadcastNotification(id: string): Promise<broadcast_notification> {
  const existing = await prisma.broadcast_notification.findUnique({ where: { id } });

  if (!existing || !["draft", "scheduled"].includes(existing.status)) {
    throw new Error("Can only cancel draft or scheduled notifications");
  }

  return prisma.broadcast_notification.update({
    where: { id },
    data: { status: "cancelled" },
  });
}

/**
 * Delete a draft broadcast notification
 */
export async function deleteBroadcastNotification(id: string): Promise<void> {
  const existing = await prisma.broadcast_notification.findUnique({ where: { id } });

  if (!existing || existing.status !== "draft") {
    throw new Error("Can only delete draft notifications");
  }

  await prisma.broadcast_notification.delete({ where: { id } });
}

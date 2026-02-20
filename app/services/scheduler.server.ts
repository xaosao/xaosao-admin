import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { prisma } from "./database.server";
import { sendBroadcast } from "./broadcast.server";

// Use globalThis to survive Remix dev mode hot reloads.
// Module-level variables reset on every hot reload, but globalThis persists.
declare global {
  var __schedulerTask: ScheduledTask | undefined;
  var __schedulerRunning: boolean;
}

/**
 * Initialize the broadcast notification scheduler.
 * Runs every minute to check for due notifications.
 *
 * Uses globalThis to ensure only ONE cron job exists,
 * even after Remix dev mode hot reloads.
 */
export function initScheduler(): void {
  // Stop any existing scheduler from a previous hot reload
  if (globalThis.__schedulerTask) {
    console.log("[Scheduler] Stopping previous scheduler instance (hot reload cleanup)");
    globalThis.__schedulerTask.stop();
    globalThis.__schedulerTask = undefined;
  }

  // Reset the running flag
  globalThis.__schedulerRunning = false;

  console.log("[Scheduler] Starting broadcast notification scheduler");

  // Run every minute
  globalThis.__schedulerTask = cron.schedule("* * * * *", async () => {
    // Prevent overlapping runs — if previous tick is still processing, skip
    if (globalThis.__schedulerRunning) {
      return;
    }

    globalThis.__schedulerRunning = true;
    try {
      const now = new Date();

      // Find notifications that are due to be sent
      const dueNotifications = await prisma.broadcast_notification.findMany({
        where: {
          status: "scheduled",
          OR: [
            // One-time scheduled: scheduledAt has passed
            {
              scheduleType: "scheduled",
              recurrence: "once",
              scheduledAt: { lte: now },
            },
            // Recurring: nextRunAt has passed
            {
              recurrence: { in: ["daily", "weekly"] },
              nextRunAt: { lte: now },
            },
          ],
        },
      });

      if (dueNotifications.length > 0) {
        console.log(`[Scheduler] Found ${dueNotifications.length} due notification(s)`);
      }

      for (const notification of dueNotifications) {
        // Atomic claim: only proceed if we successfully change status from "scheduled" to "sending"
        // This prevents duplicate sends if multiple processes exist
        const claimed = await prisma.broadcast_notification.updateMany({
          where: { id: notification.id, status: "scheduled" },
          data: { status: "sending" },
        });

        if (claimed.count === 0) {
          // Another process already claimed this notification, skip
          console.log(`[Scheduler] Notification ${notification.id} already claimed, skipping`);
          continue;
        }

        console.log(`[Scheduler] Sending broadcast: ${notification.id} - ${notification.title}`);
        try {
          await sendBroadcast(notification.id);
        } catch (error) {
          console.error(`[Scheduler] Failed to send broadcast ${notification.id}:`, error);
        }
      }
    } catch (error) {
      console.error("[Scheduler] Error checking for due notifications:", error);
    } finally {
      globalThis.__schedulerRunning = false;
    }
  });

  console.log("[Scheduler] Scheduler started - checking every minute");
}

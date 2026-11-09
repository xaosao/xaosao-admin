/**
 * Daily reward slots — admin side.
 *
 * A slot is a standing instruction: "at 19:00, for 30 minutes, any model
 * who opens the app can claim 5,000 Kip, up to 50 claims." The claiming
 * itself happens in xs_backend, which owns the wallet; this file only
 * configures the slots and reports on what was claimed.
 */

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";
import { uploadFileToBunnyServer } from "./upload.server";

export interface RewardSlotInput {
  name: string;
  /** Existing CDN URL. Ignored when `imageFile` is supplied. */
  image: string;
  /** New upload, if the admin picked one. */
  imageFile?: File;
  amount: number;
  startTime: string;
  durationMinutes: number;
  /** Null or 0 means unlimited. */
  dailyCap?: number | null;
  status?: string;
}

/** "HH:mm", 00:00–23:59. */
function isValidTime(value: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function validate(data: RewardSlotInput) {
  const errors: Record<string, string> = {};

  if (!data.name?.trim()) errors.name = "Name is required";
  if (!data.image?.trim()) errors.image = "An image is required";
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    errors.amount = "Amount must be greater than zero";
  }
  if (!isValidTime(data.startTime)) {
    errors.startTime = "Start time must look like 19:00";
  }
  if (!Number.isInteger(data.durationMinutes) || data.durationMinutes < 1) {
    errors.durationMinutes = "Duration must be at least 1 minute";
  }
  // A window cannot run past midnight: the claim check works within one
  // Lao calendar day, so a slot that wrapped would silently never open.
  if (isValidTime(data.startTime) && Number.isInteger(data.durationMinutes)) {
    const [h, m] = data.startTime.split(":").map(Number);
    if (h * 60 + m + data.durationMinutes > 24 * 60) {
      errors.durationMinutes =
        "The window would run past midnight. Shorten it or start earlier.";
    }
  }
  if (
    data.dailyCap !== undefined &&
    data.dailyCap !== null &&
    (!Number.isInteger(data.dailyCap) || data.dailyCap < 0)
  ) {
    errors.dailyCap = "Daily cap must be a whole number, or blank for no cap";
  }

  if (Object.keys(errors).length > 0) {
    throw new FieldValidationError(errors);
  }
}

export async function getRewardSlots() {
  const slots = await prisma.reward_slot.findMany({
    orderBy: [{ startTime: "asc" }],
  });

  // Today's claim counts, in one grouped query rather than one per slot.
  const day = laoDayKey(new Date());
  const counts = await prisma.reward_claim.groupBy({
    by: ["slotId"],
    where: { day },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const bySlot = new Map(
    counts.map((c) => [c.slotId, { n: c._count._all, paid: c._sum.amount ?? 0 }])
  );

  return slots.map((s) => ({
    ...s,
    claimsToday: bySlot.get(s.id)?.n ?? 0,
    paidToday: bySlot.get(s.id)?.paid ?? 0,
  }));
}

export async function getRewardSlot(id: string) {
  return prisma.reward_slot.findUnique({ where: { id } });
}

/** Recent claims for one slot, newest first. */
export async function getRewardClaims(slotId: string, limit = 50) {
  return prisma.reward_claim.findMany({
    where: { slotId },
    orderBy: { claimedAt: "desc" },
    take: limit,
    include: {
      model: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function createRewardSlot(data: RewardSlotInput, userId: string) {
  data = { ...data, image: await resolveImage(data) };
  validate(data);
  const slot = await prisma.reward_slot.create({
    data: {
      name: data.name.trim(),
      image: data.image.trim(),
      amount: data.amount,
      startTime: data.startTime.trim(),
      durationMinutes: data.durationMinutes,
      dailyCap: data.dailyCap && data.dailyCap > 0 ? data.dailyCap : null,
      status: data.status ?? "active",
      createdById: userId,
    },
  });

  await createAuditLogs({
    action: "CREATE_REWARD_SLOT",
    user: userId,
    description: `Created reward slot "${slot.name}" at ${slot.startTime} for ${slot.durationMinutes} min, ${slot.amount} LAK${slot.dailyCap ? `, cap ${slot.dailyCap}` : ""}.`,
    status: "success",
    onSuccess: slot,
  });

  return slot;
}

export async function updateRewardSlot(
  id: string,
  data: RewardSlotInput,
  userId: string
) {
  data = { ...data, image: await resolveImage(data) };
  validate(data);
  const slot = await prisma.reward_slot.update({
    where: { id },
    data: {
      name: data.name.trim(),
      image: data.image.trim(),
      amount: data.amount,
      startTime: data.startTime.trim(),
      durationMinutes: data.durationMinutes,
      dailyCap: data.dailyCap && data.dailyCap > 0 ? data.dailyCap : null,
      ...(data.status ? { status: data.status } : {}),
      updatedAt: new Date(),
    },
  });

  await createAuditLogs({
    action: "UPDATE_REWARD_SLOT",
    user: userId,
    description: `Updated reward slot "${slot.name}".`,
    status: "success",
    onSuccess: slot,
  });

  return slot;
}

/**
 * Pause or resume a slot. Preferred over deletion: the claim history
 * references it, and a paused slot can be brought back unchanged.
 */
export async function toggleRewardSlot(id: string, userId: string) {
  const existing = await prisma.reward_slot.findUnique({ where: { id } });
  if (!existing) throw new FieldValidationError({ id: "Reward not found" });

  const next = existing.status === "active" ? "inactive" : "active";
  const slot = await prisma.reward_slot.update({
    where: { id },
    data: { status: next, updatedAt: new Date() },
  });

  await createAuditLogs({
    action: "TOGGLE_REWARD_SLOT",
    user: userId,
    description: `Reward slot "${slot.name}" set to ${next}.`,
    status: "success",
    onSuccess: slot,
  });

  return slot;
}

export async function deleteRewardSlot(id: string, userId: string) {
  const claims = await prisma.reward_claim.count({ where: { slotId: id } });
  if (claims > 0) {
    throw new FieldValidationError({
      id: `This reward has ${claims} claim(s) on record. Pause it instead so the history stays intact.`,
    });
  }

  const slot = await prisma.reward_slot.delete({ where: { id } });
  await createAuditLogs({
    action: "DELETE_REWARD_SLOT",
    user: userId,
    description: `Deleted reward slot "${slot.name}".`,
    status: "success",
    onSuccess: slot,
  });
  return slot;
}

/**
 * Upload the chosen image if there is one, otherwise keep the existing
 * URL. Uploading happens before validation so a failed upload surfaces as
 * "an image is required" rather than a half-saved slot.
 */
async function resolveImage(data: RewardSlotInput): Promise<string> {
  if (!data.imageFile || data.imageFile.size === 0) return data.image ?? "";
  const buffer = Buffer.from(await data.imageFile.arrayBuffer());
  const ext = data.imageFile.name.split(".").pop() || "png";
  const safeName = (data.name || "reward").toLowerCase().replace(/\s+/g, "-");
  return uploadFileToBunnyServer(
    buffer,
    `reward-${safeName}-${Date.now()}.${ext}`,
    data.imageFile.type
  );
}

/**
 * Lao calendar day as "YYYY-MM-DD".
 *
 * Must match xs_backend's `toVientianeDateOnly` exactly — it is the key
 * the backend writes claims under, and the admin counts them by.
 */
function laoDayKey(d: Date): string {
  const shifted = new Date(d.getTime() + 7 * 60 * 60_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

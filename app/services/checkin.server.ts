/**
 * Daily check-in — admin side.
 *
 * Seven rows, one per weekday: "Monday pays 2,000 Kip, up to 100 models".
 * A model taps once a day and is paid; the claiming itself happens in
 * xs_backend, which owns the wallet. This file configures the week and
 * reports on what it cost.
 *
 * Separate from reward slots on purpose: a slot is a timed window a model
 * has to be present for, a check-in is open all day and rewards the habit.
 */

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";

/** 1 = Monday … 7 = Sunday, the order the strip is drawn in. */
export const WEEKDAYS = [
  { weekday: 1, en: "Monday", short: "Mon", lo: "ຈັນ" },
  { weekday: 2, en: "Tuesday", short: "Tue", lo: "ອັງຄານ" },
  { weekday: 3, en: "Wednesday", short: "Wed", lo: "ພຸດ" },
  { weekday: 4, en: "Thursday", short: "Thu", lo: "ພະຫັດ" },
  { weekday: 5, en: "Friday", short: "Fri", lo: "ສຸກ" },
  { weekday: 6, en: "Saturday", short: "Sat", lo: "ເສົາ" },
  { weekday: 7, en: "Sunday", short: "Sun", lo: "ອາທິດ" },
] as const;

export interface CheckinDayInput {
  weekday: number;
  amount: number;
  /** Null or 0 means unlimited. */
  dailyCap: number | null;
  status: string;
}

/** Asia/Vientiane is +07:00 all year, so the offset is a constant. */
function laoDayKey(d: Date): string {
  const shifted = new Date(d.getTime() + 7 * 60 * 60_000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** The Monday-first week containing `d`, as Lao day keys. */
function laoWeekKeys(d: Date): string[] {
  const shifted = new Date(d.getTime() + 7 * 60 * 60_000);
  const sunday0 = shifted.getUTCDay();
  const iso = sunday0 === 0 ? 7 : sunday0;
  const monday = new Date(shifted.getTime());
  monday.setUTCDate(shifted.getUTCDate() - (iso - 1));

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getTime());
    day.setUTCDate(monday.getUTCDate() + i);
    const yyyy = day.getUTCFullYear();
    const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(day.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
}

/**
 * The week as the admin edits it: always seven rows, whether or not they
 * have been configured yet.
 *
 * Unconfigured weekdays come back as inactive zeros rather than being
 * written to the database on a read — a page view should not create
 * records, and an absent row already means "pays nothing".
 */
export async function getCheckinWeek() {
  const rows = await prisma.checkin_day.findMany();
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));

  const today = laoDayKey(new Date());
  const week = laoWeekKeys(new Date());

  const [todayClaims, weekClaims, perWeekday] = await Promise.all([
    prisma.checkin_claim.aggregate({
      where: { day: today },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.checkin_claim.aggregate({
      where: { day: { in: week } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.checkin_claim.groupBy({
      by: ["day"],
      where: { day: { in: week } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const byDay = new Map(
    perWeekday.map((c) => [c.day, { n: c._count._all, paid: c._sum.amount ?? 0 }])
  );

  const days = WEEKDAYS.map((meta, index) => {
    const row = byWeekday.get(meta.weekday);
    const date = week[index];
    const claims = byDay.get(date);
    return {
      ...meta,
      id: row?.id ?? null,
      amount: row?.amount ?? 0,
      dailyCap: row?.dailyCap ?? null,
      status: row?.status ?? "inactive",
      configured: !!row,
      date,
      isToday: date === today,
      claims: claims?.n ?? 0,
      paid: claims?.paid ?? 0,
    };
  });

  return {
    days,
    stats: {
      claimsToday: todayClaims._count._all,
      paidToday: todayClaims._sum.amount ?? 0,
      claimsThisWeek: weekClaims._count._all,
      paidThisWeek: weekClaims._sum.amount ?? 0,
    },
  };
}

function validate(rows: CheckinDayInput[]) {
  const errors: Record<string, string> = {};

  for (const row of rows) {
    const key = `day-${row.weekday}`;
    if (!Number.isFinite(row.amount) || row.amount < 0) {
      errors[key] = "Amount must be zero or more";
      continue;
    }
    // An active weekday that pays nothing is almost certainly a mistake:
    // the model would tap and be credited zero.
    if (row.status === "active" && row.amount <= 0) {
      errors[key] = "An active day must pay more than zero";
      continue;
    }
    if (
      row.dailyCap !== null &&
      (!Number.isInteger(row.dailyCap) || row.dailyCap < 0)
    ) {
      errors[key] = "Cap must be a whole number, or blank for no cap";
    }
  }

  if (Object.keys(errors).length > 0) throw new FieldValidationError(errors);
}

/**
 * Save the whole week at once.
 *
 * The form submits all seven days, so one upsert per weekday keeps the
 * stored rows and the screen in step without a diff to get wrong.
 */
export async function saveCheckinWeek(rows: CheckinDayInput[], userId: string) {
  validate(rows);

  const saved = await prisma.$transaction(
    rows.map((row) =>
      prisma.checkin_day.upsert({
        where: { weekday: row.weekday },
        create: {
          weekday: row.weekday,
          amount: row.amount,
          dailyCap: row.dailyCap && row.dailyCap > 0 ? row.dailyCap : null,
          status: row.status,
          updatedById: userId,
        },
        update: {
          amount: row.amount,
          dailyCap: row.dailyCap && row.dailyCap > 0 ? row.dailyCap : null,
          status: row.status,
          updatedById: userId,
        },
      })
    )
  );

  const summary = saved
    .map((d) => {
      const meta = WEEKDAYS.find((w) => w.weekday === d.weekday);
      return `${meta?.short ?? d.weekday}: ${
        d.status === "active" ? `${d.amount.toLocaleString()} LAK` : "off"
      }${d.dailyCap ? ` (cap ${d.dailyCap})` : ""}`;
    })
    .join(", ");

  // The week is already saved by this point. A failure to write the
  // audit entry must not be reported to the admin as a failed save —
  // they would retry a change that already took effect.
  try {
    await createAuditLogs({
      action: "SAVE_CHECKIN_WEEK",
      user: userId,
      description: `Updated the daily check-in week — ${summary}.`,
      status: "success",
      onSuccess: saved,
    });
  } catch (error) {
    console.error("SAVE_CHECKIN_WEEK_AUDIT_FAILED", error);
  }

  return saved;
}

/** Who checked in recently, newest first. */
export async function getCheckinClaims(limit = 50) {
  return prisma.checkin_claim.findMany({
    orderBy: { claimedAt: "desc" },
    take: limit,
    include: {
      model: { select: { id: true, firstName: true, lastName: true, profile: true } },
    },
  });
}

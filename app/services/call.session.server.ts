/**
 * Call sessions — admin side.
 *
 * Reads the `call_session` collection that xs_backend writes while a
 * per-minute call runs. The legacy `session` collection these pages were
 * built against was never written to by anything that shipped; the rows
 * are mapped into the shape the screens already expect, so the admin UI
 * did not have to be rewritten around a new vocabulary:
 *
 *   sessionStart  ← when the two sides actually connected
 *   sessionEnd    ← when it ended
 *   duration      ← minutes charged
 *   totalCost     ← what the customer paid
 *   sessionStatus ← completed / missed / declined / cancelled / ongoing
 *   paymentStatus ← paid when money moved, refunded when it all went back
 *
 * Nothing here can change a call. Settlement belongs to the backend, and
 * the figures below are a report of what it already did.
 */

import { prisma } from "./database.server";

/** The shape the admin screens read, whatever the storage looks like. */
function toSessionRow(call: any) {
  const connected = call.connectedAt ?? null;
  const billed = call.billedAmount ?? 0;

  return {
    ...call,
    sessionStart: connected ?? call.ringingAt ?? call.createdAt,
    sessionEnd: call.endedAt ?? null,
    duration: call.billedMinutes ?? 0,
    ratePerMinute: call.ratePerMinute ?? 0,
    totalCost: billed,
    sessionStatus: sessionStatusOf(call),
    paymentStatus:
      billed > 0 ? "paid" : (call.refundedAmount ?? 0) > 0 ? "refunded" : "unpaid",
  };
}

/** The screens' vocabulary for where a call got to. */
function sessionStatusOf(call: any): string {
  if (call.status !== "ended") return "ongoing";
  switch (call.endReason) {
    case "missed":
      return "missed";
    case "declined":
      return "declined";
    case "cancelled":
      return "cancelled";
    case "no_funds":
    case "max_duration":
    case "network":
    case "failed":
    case "admin":
      return call.connectedAt ? "completed" : "missed";
    default:
      return "completed";
  }
}

/** Map an admin filter back onto how calls are really stored. */
function statusFilter(sessionStatus: string): any {
  switch (sessionStatus) {
    case "ongoing":
      return { status: { not: "ended" } };
    case "completed":
      return { status: "ended", connectedAt: { not: null } };
    case "missed":
      return { status: "ended", endReason: "missed" };
    case "declined":
      return { status: "ended", endReason: "declined" };
    case "cancelled":
      return { status: "ended", endReason: "cancelled" };
    default:
      return {};
  }
}

/** Paid means money actually moved to the model. */
function paymentFilter(paymentStatus: string): any {
  switch (paymentStatus) {
    case "paid":
      return { billedAmount: { gt: 0 } };
    case "refunded":
      return { billedAmount: { lte: 0 }, refundedAmount: { gt: 0 } };
    case "unpaid":
      return { billedAmount: { lte: 0 } };
    default:
      return {};
  }
}


function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export async function getCallSessions(
  options: {
    search?: string;
    sessionStatus?: string;
    paymentStatus?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const {
      search = "",
      sessionStatus = "all",
      paymentStatus = "all",
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = options;

    const whereClause: any = {};

    if (search) {
      if (isValidObjectId(search)) {
        whereClause.OR = [{ modelId: search }, { customerId: search }];
      } else {
        whereClause.OR = [
          { model: { firstName: { contains: search, mode: "insensitive" } } },
          { model: { lastName: { contains: search, mode: "insensitive" } } },
          {
            customer: {
              firstName: { contains: search, mode: "insensitive" },
            },
          },
          {
            customer: { lastName: { contains: search, mode: "insensitive" } },
          },
        ];
      }
    }

    if (sessionStatus && sessionStatus !== "all") {
      Object.assign(whereClause, statusFilter(sessionStatus));
    }

    if (paymentStatus && paymentStatus !== "all") {
      Object.assign(whereClause, paymentFilter(paymentStatus));
    }

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.createdAt.lt = endDate;
      }
    }

    const skip = (page - 1) * limit;
    const [call_sessions, totalCount] = await Promise.all([
      prisma.call_session.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
            },
          },
          modelService: {
            select: {
              id: true,
              customMinuteRate: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  baseRate: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.call_session.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      call_sessions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit,
      },
    };
  } catch (error) {
    console.error("GET_CALL_SESSIONS_FAILED", error);
    throw new Error("Failed to fetch call sessions!");
  }
}

export async function getCallSession(id: string) {
  try {
    const call = await prisma.call_session.findFirst({
      where: { id },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            gender: true,
            dob: true,
            status: true,
            createdAt: true,
            rating: true,
            total_review: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            status: true,
          },
        },
        modelService: {
          select: {
            id: true,
            customMinuteRate: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
                commission: true,
              },
            },
          },
        },
      },
    });

    return call ? toSessionRow(call) : null;
  } catch (error) {
    console.error("GET_CALL_SESSION_FAILED", error);
    throw new Error("Failed to fetch call session!");
  }
}

export async function getSessionDurationStats() {
  const [quickVisits, standardVisits, longVisits, extendedVisits] =
    await Promise.all([
      prisma.call_session.count({ where: { billedMinutes: { lt: 5 } } }),
      prisma.call_session.count({ where: { billedMinutes: { gte: 5, lt: 15 } } }),
      prisma.call_session.count({ where: { billedMinutes: { gte: 15, lt: 30 } } }),
      prisma.call_session.count({ where: { billedMinutes: { gte: 30 } } }),
    ]);

  return {
    quickVisits,
    standardVisits,
    longVisits,
    extendedVisits,
  };
}

export async function getTopCountriesPerModel() {
  const sessions = await prisma.call_session.findMany({
    select: {
      modelId: true,
      customer: { select: { country: true } },
    },
  });

  const result: Record<string, Record<string, number>> = {};

  for (const session of sessions) {
    const modelId = session.modelId;
    const country = session.customer?.country || "Unknown";

    if (!result[modelId]) result[modelId] = {};
    if (!result[modelId][country]) result[modelId][country] = 0;

    result[modelId][country]++;
  }

  const topCountriesPerModel = Object.entries(result).map(
    ([modelId, countryStats]) => {
      const sorted = Object.entries(countryStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      return {
        modelId,
        topCountries: sorted.map(([country, sessions], index) => ({
          rank: index + 1,
          country,
          sessions,
        })),
      };
    }
  );

  return topCountriesPerModel;
}

export async function getDashboardMetrics() {
  // Step 1: Run count & average queries in parallel
  const [activeSessions, totalSessions, bounceSessions, avg] =
    await Promise.all([
      // Ongoing: a call that has not settled yet.
      prisma.call_session.count({ where: { status: { not: "ended" } } }),

      prisma.call_session.count(), // total sessions

      // "Bounces": calls that never got a conversation out of a ring.
      prisma.call_session.count({ where: { connectedAt: null } }),

      prisma.call_session.aggregate({ _avg: { billedMinutes: true } }),
    ]);

  // Step 2: Fetch sessions to calculate peak concurrent
  const rawSessions = await prisma.call_session.findMany({
    where: { connectedAt: { not: null } },
    select: { connectedAt: true, endedAt: true },
  });

  // Step 3: Create timeline of session events
  const timeline: { time: Date; type: "start" | "end" }[] = [];

  for (const s of rawSessions) {
    if (!s.connectedAt) continue;
    timeline.push({ time: s.connectedAt, type: "start" });
    if (s.endedAt) {
      timeline.push({ time: s.endedAt, type: "end" });
    }
  }

  // Step 4: Sort events and track concurrency
  timeline.sort((a, b) => a.time.getTime() - b.time.getTime());

  let concurrent = 0;
  let peakConcurrent = 0;

  for (const event of timeline) {
    if (event.type === "start") concurrent++;
    else concurrent--;

    if (concurrent > peakConcurrent) peakConcurrent = concurrent;
  }

  return {
    activeSessions,
    avgDurationMinutes: Math.round(avg._avg.billedMinutes ?? 0),
    bounceRatePercent:
      totalSessions > 0
        ? parseFloat(((bounceSessions / totalSessions) * 100).toFixed(1))
        : 0,
    peakConcurrent,
  };
}

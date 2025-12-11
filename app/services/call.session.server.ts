import { prisma } from "./database.server";

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
      whereClause.sessionStatus = sessionStatus;
    }

    if (paymentStatus && paymentStatus !== "all") {
      whereClause.paymentStatus = paymentStatus;
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
      prisma.session.findMany({
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
              customRate: true,
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
      prisma.session.count({
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
    return await prisma.session.findFirst({
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
            customRate: true,
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
        modelCallEndedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        customerCallEndedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_CALL_SESSION_FAILED", error);
    throw new Error("Failed to fetch call session!");
  }
}

export async function getSessionDurationStats() {
  const [quickVisits, standardVisits, longVisits, extendedVisits] =
    await Promise.all([
      prisma.session.count({ where: { duration: { lt: 15 } } }),
      prisma.session.count({ where: { duration: { gte: 15, lt: 60 } } }),
      prisma.session.count({ where: { duration: { gte: 60, lt: 180 } } }),
      prisma.session.count({ where: { duration: { gte: 180 } } }),
    ]);

  return {
    quickVisits,
    standardVisits,
    longVisits,
    extendedVisits,
  };
}

export async function getTopCountriesPerModel() {
  const sessions = await prisma.session.findMany({
    where: {
      modelId: {
        not: null,
      },
      customer: {
        isNot: null,
      },
    },
    select: {
      modelId: true,
      customer: {
        select: {
          country: true,
        },
      },
    },
  });

  const result: Record<string, Record<string, number>> = {};

  for (const session of sessions) {
    const modelId = session.modelId!;
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
      prisma.session.count({
        where: {
          sessionEnd: {
            gt: new Date(), // ongoing sessions
          },
        },
      }),

      prisma.session.count(), // total sessions

      prisma.session.count({
        where: {
          duration: {
            lt: 1, // less than 1 minute
          },
        },
      }),

      prisma.session.aggregate({
        _avg: {
          duration: true,
        },
      }),
    ]);

  // Step 2: Fetch sessions to calculate peak concurrent
  const rawSessions = await prisma.session.findMany({
    select: {
      sessionStart: true,
      sessionEnd: true,
    },
  });

  // Step 3: Create timeline of session events
  const timeline: { time: Date; type: "start" | "end" }[] = [];

  for (const s of rawSessions) {
    timeline.push({ time: s.sessionStart, type: "start" });
    if (s.sessionEnd) {
      timeline.push({ time: s.sessionEnd, type: "end" });
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
    avgDurationMinutes: Math.round(avg._avg.duration ?? 0),
    bounceRatePercent:
      totalSessions > 0
        ? parseFloat(((bounceSessions / totalSessions) * 100).toFixed(1))
        : 0,
    peakConcurrent,
  };
}

import { prisma } from "./database.server";
import {
  format,
  addDays,
  subWeeks,
  setMonth,
  endOfWeek,
  endOfMonth,
  startOfWeek,
  startOfMonth,
  subDays,
  format as formatDate,
} from "date-fns";

// ========================================
// Pending Counts for Sidebar Badges
// ========================================

export interface PendingCounts {
  pendingModels: number;
  pendingTransactions: number;
  pendingBookings: number;
  newReviews: number;
  activeSubscriptions: number;
  activePosts: number;
}

export async function getPendingCounts(): Promise<PendingCounts> {
  try {
    // Get reviews from last 7 days as "new" reviews (Laos timezone UTC+7)
    const LAO_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowLao = new Date(Date.now() + LAO_OFFSET_MS);
    const sevenDaysAgo = new Date(subDays(nowLao, 7).getTime() - LAO_OFFSET_MS);

    const [pendingModels, pendingTransactions, pendingBookings, newReviews, activeSubscriptions, activePosts] = await Promise.all([
      prisma.model.count({
        where: { status: "pending" },
      }),
      prisma.transaction_history.count({
        where: { status: "pending" },
      }),
      prisma.service_booking.count({
        where: { status: "pending" },
      }),
      prisma.review.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.subscription.count({
        where: { status: "active" },
      }),
      prisma.post.count({
        where: { status: "active" },
      }),
    ]);

    return {
      pendingModels,
      pendingTransactions,
      pendingBookings,
      newReviews,
      activeSubscriptions,
      activePosts,
    };
  } catch (error) {
    console.error("GET_PENDING_COUNTS_FAILED", error);
    return {
      pendingModels: 0,
      pendingTransactions: 0,
      pendingBookings: 0,
      newReviews: 0,
      activeSubscriptions: 0,
      activePosts: 0,
    };
  }
}

export async function getDashboardStats() {
  try {
    const [activeModel, activeCustomer, complatedChat, completedCall] =
      await Promise.all([
        prisma.model.count({
          where: { status: "active" },
        }),
        prisma.customer.count({
          where: { status: "active" },
        }),
        prisma.chat_session.count({
          where: { sessionStatus: "completed" },
        }),
        prisma.session.count({
          where: { sessionStatus: "completed" },
        }),
      ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const dashboardStats = [
      {
        title: "Active Models",
        value: format(activeModel),
        icon: "UserCheck",
        color: "text-green-600",
      },
      {
        title: "Online Customers",
        value: format(activeCustomer),
        icon: "Users",
        color: "text-green-600",
      },
      {
        title: "Completed Chats",
        value: format(complatedChat),
        icon: "MessageCircle",
        color: "text-green-600",
      },
      {
        title: "Completed Call Sessions",
        value: format(completedCall),
        icon: "Phone",
        color: "text-green-600",
      },
    ];

    return dashboardStats;
  } catch (err) {
    console.error("FETCH_DASHBOARD_STATS_FAILED", err);
    throw new Error("Failed to get dashboard stats.");
  }
}

type Mode = "daily" | "weekly" | "monthly";

export async function getDashboardData(mode: Mode) {
  // Use Laos timezone (UTC+7) for date boundaries so chart days match local time
  const LAO_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowUTC = new Date();
  const nowLao = new Date(nowUTC.getTime() + LAO_OFFSET_MS);
  const toUTC = (laoDate: Date) => new Date(laoDate.getTime() - LAO_OFFSET_MS);

  let ranges: { start: Date; end: Date; name: string }[] = [];

  if (mode === "daily") {
    const weekStart = startOfWeek(nowLao, { weekStartsOn: 1 });
    ranges = Array.from({ length: 7 }).map((_, i) => {
      const startLao = addDays(weekStart, i);
      return {
        start: toUTC(startLao),
        end: toUTC(addDays(startLao, 1)),
        name: format(startLao, "EEEE"),
      };
    });
  }

  if (mode === "weekly") {
    const weeks = [3, 2, 1, 0];
    ranges = weeks.map((weekOffset, index) => {
      const startLao = startOfWeek(subWeeks(nowLao, weekOffset), { weekStartsOn: 1 });
      const endLao = addDays(endOfWeek(subWeeks(nowLao, weekOffset), { weekStartsOn: 1 }), 1);
      return {
        start: toUTC(startLao),
        end: toUTC(endLao),
        name: `Week ${index + 1}`,
      };
    });
  }

  if (mode === "monthly") {
    const year = nowLao.getFullYear();
    ranges = Array.from({ length: 12 }).map((_, i) => {
      const startLao = startOfMonth(setMonth(new Date(year, 0), i));
      return {
        start: toUTC(startLao),
        end: toUTC(addDays(endOfMonth(startLao), 1)),
        name: formatDate(startLao, "LLLL"),
      };
    });
  }

  // Query the full date range once per collection (6 queries total instead of 6 x ranges)
  const globalStart = ranges[0].start;
  const globalEnd = ranges[ranges.length - 1].end;
  const dateFilter = { gte: globalStart, lt: globalEnd };

  const [modelRows, customerRows, subscriptionRows, transactionRows, bookingRows, postRows] = await Promise.all([
    prisma.model.findMany({
      where: { status: "active", createdAt: dateFilter },
      select: { createdAt: true },
    }),
    prisma.customer.findMany({
      where: { status: "active", createdAt: dateFilter },
      select: { createdAt: true },
    }),
    prisma.subscription.findMany({
      where: { status: "active", createdAt: dateFilter },
      select: { createdAt: true },
    }),
    prisma.transaction_history.findMany({
      where: { status: { in: ["approved", "success"] }, createdAt: dateFilter },
      select: { createdAt: true },
    }),
    prisma.service_booking.findMany({
      where: { createdAt: dateFilter },
      select: { createdAt: true },
    }),
    prisma.post.findMany({
      where: { createdAt: dateFilter },
      select: { createdAt: true },
    }),
  ]);

  // Bucket each record into the correct range
  const bucketCount = (rows: { createdAt: Date }[], start: Date, end: Date) =>
    rows.filter((r) => r.createdAt >= start && r.createdAt < end).length;

  const result = ranges.map(({ start, end, name }) => ({
    name,
    models: bucketCount(modelRows, start, end),
    customers: bucketCount(customerRows, start, end),
    subscriptions: bucketCount(subscriptionRows, start, end),
    completedTransactions: bucketCount(transactionRows, start, end),
    bookings: bucketCount(bookingRows, start, end),
    posts: bucketCount(postRows, start, end),
  }));

  return mode === "weekly" ? result.reverse() : result;
}

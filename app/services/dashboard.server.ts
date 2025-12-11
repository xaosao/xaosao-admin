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
  format as formatDate,
} from "date-fns";

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
  const now = new Date();
  let ranges: { start: Date; end: Date; name: string }[] = [];
  const identifiers = ["call_payment", "video_payment", "chat_payment"];

  if (mode === "daily") {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    ranges = Array.from({ length: 7 }).map((_, i) => {
      const start = addDays(weekStart, i);
      const end = addDays(start, 1);
      return {
        start,
        end,
        name: format(start, "EEEE"), // "Monday"
      };
    });
  }

  if (mode === "weekly") {
    const weeks = [3, 2, 1, 0]; // Last 4 weeks
    ranges = weeks.map((weekOffset, index) => {
      const start = startOfWeek(subWeeks(now, weekOffset), {
        weekStartsOn: 1,
      });
      const end = endOfWeek(subWeeks(now, weekOffset), {
        weekStartsOn: 1,
      });
      return {
        start,
        end,
        name: `Week ${index + 1}`,
      };
    });
  }

  if (mode === "monthly") {
    const year = now.getFullYear();
    ranges = Array.from({ length: 12 }).map((_, i) => {
      const start = startOfMonth(setMonth(new Date(year, 0), i));
      const end = endOfMonth(start);
      return {
        start,
        end,
        name: formatDate(start, "LLLL"), // "January"
      };
    });
  }

  const result = await Promise.all(
    ranges.map(async ({ start, end, name }) => {
      const [
        models,
        customers,
        chats,
        callSessions,
        videoSessions,
        revenue,
        expended,
      ] = await Promise.all([
        prisma.model.count({
          where: {
            status: "active",
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.customer.count({
          where: {
            status: "active",
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.chat_session.count({
          where: {
            sessionStatus: "completed",
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.session.count({
          where: {
            sessionStatus: "completed",
            modelService: {
              service: { name: { startsWith: "Call" } },
            },
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.session.count({
          where: {
            sessionStatus: "completed",
            modelService: {
              service: { name: { startsWith: "Video" } },
            },
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.transaction_history.aggregate({
          where: {
            status: "approved",
            identifier: { in: identifiers },
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
        prisma.transaction_history.aggregate({
          where: {
            status: "approved",
            identifier: "withdraw",
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
      ]);

      return {
        name,
        models,
        customers,
        chats,
        callSessions,
        videoSessions,
        revenue: revenue._sum.amount || 0,
        expended: expended._sum.amount || 0,
      };
    })
  );

  return mode === "weekly" ? result.reverse() : result;
}

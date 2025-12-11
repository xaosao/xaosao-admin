import { prisma } from "./database.server";

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export async function getRevenueStats() {
  const now = new Date();

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const identifiers = ["call_payment", "video_payment", "chat_payment"];

  const [today, week, month, total] = await Promise.all([
    prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: { amount: true },
    }),
    prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      _sum: { amount: true },
    }),
    prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
    }),
    prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
      },
      _sum: { amount: true },
    }),
  ]);

  const toUSD = (amount: number) =>
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return [
    {
      label: "Today's Revenue",
      value: toUSD(today._sum.amount || 0),
      change: "+23%",
      trend: "up",
    },
    {
      label: "This Week",
      value: toUSD(week._sum.amount || 0),
      change: "+12%",
      trend: "up",
    },
    {
      label: "This Month",
      value: toUSD(month._sum.amount || 0),
      change: "+8%",
      trend: "up",
    },
    {
      label: "Total Revenue",
      value: toUSD(total._sum.amount || 0),
      change: "+15%",
      trend: "up",
    },
  ];
}

export async function getTopEarning() {
  try {
    return await prisma.wallet.findMany({
      where: {
        modelId: { not: null },
      },
      orderBy: {
        totalBalance: "desc",
      },
      take: 5,
      select: {
        id: true,
        totalBalance: true,
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            address: true,
            bio: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_TOP_EARNING_FAILED", error);
    throw new Error("Failed to get top earning!");
  }
}

export async function getRevenueBreakdown() {
  const identifiers = ["call_payment", "video_payment", "chat_payment"];

  const transactions = await prisma.transaction_history.groupBy({
    by: ["identifier"],
    where: {
      status: "approved",
      identifier: { in: identifiers },
    },
    _sum: {
      amount: true,
    },
  });

  const totalRevenue = transactions.reduce(
    (sum, entry) => sum + (entry._sum.amount || 0),
    0
  );

  const toUSD = (amount: number) =>
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  const breakdown = transactions.map((entry) => {
    const amount = entry._sum.amount || 0;
    const percentage =
      totalRevenue === 0 ? 0 : Math.round((amount / totalRevenue) * 100);

    const labelMap = {
      call_payment: "Call Session",
      video_payment: "Video Session",
      chat_payment: "Chat Messages",
    };

    return {
      source:
        labelMap[entry.identifier as keyof typeof labelMap] || entry.identifier,
      amount: toUSD(amount),
      percentage,
      color: "bg-dark-pink",
    };
  });

  return breakdown;
}

export async function getMonthlyRevenueData(year: number) {
  const identifiers = ["call_payment", "video_payment", "chat_payment"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthlyQueries = Array.from({ length: 12 }, (_, index) => {
    const start = startOfMonth(new Date(year, index, 1));
    const end = endOfMonth(start);

    return prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });
  });

  const results = await Promise.all(monthlyQueries);

  return results.map((entry, i) => ({
    month: months[i],
    revenue: Math.round(entry._sum.amount || 0),
  }));
}

export async function getMonthlyExpenseData(year: number) {
  const identifiers = ["withdraw"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthlyQueries = Array.from({ length: 12 }, (_, index) => {
    const start = startOfMonth(new Date(year, index, 1));
    const end = endOfMonth(start);

    return prisma.transaction_history.aggregate({
      where: {
        status: "approved",
        identifier: { in: identifiers },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });
  });

  const results = await Promise.all(monthlyQueries);

  return results.map((entry, i) => ({
    month: months[i],
    expense: Math.round(entry._sum.amount || 0),
  }));
}

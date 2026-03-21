import { prisma } from "./database.server";

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

// Laos timezone offset (UTC+7)
const LAO_OFFSET_MS = 7 * 60 * 60 * 1000;
const toLaoNow = () => new Date(Date.now() + LAO_OFFSET_MS);
const toUTCDate = (laoDate: Date) => new Date(laoDate.getTime() - LAO_OFFSET_MS);

export async function getRevenueStats() {
  const nowLao = toLaoNow();

  const todayStart = toUTCDate(startOfDay(nowLao));
  const todayEnd = toUTCDate(endOfDay(nowLao));

  const weekStart = toUTCDate(startOfWeek(nowLao, { weekStartsOn: 1 })); // Monday
  const weekEnd = toUTCDate(endOfWeek(nowLao, { weekStartsOn: 1 })); // Sunday

  const monthStart = toUTCDate(startOfMonth(nowLao));
  const monthEnd = toUTCDate(endOfMonth(nowLao));

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
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // Single query for the whole year, then bucket in JS
  const yearStartLao = startOfMonth(new Date(year, 0, 1));
  const yearEndLao = endOfMonth(new Date(year, 11, 1));

  const rows = await prisma.transaction_history.findMany({
    where: {
      status: "approved",
      identifier: { in: identifiers },
      createdAt: { gte: toUTCDate(yearStartLao), lte: toUTCDate(yearEndLao) },
    },
    select: { amount: true, createdAt: true },
  });

  // Bucket by month in Laos time
  const monthTotals = new Array(12).fill(0);
  for (const row of rows) {
    const laoTime = new Date(row.createdAt.getTime() + LAO_OFFSET_MS);
    const m = laoTime.getMonth();
    monthTotals[m] += Math.abs(row.amount || 0);
  }

  return months.map((month, i) => ({
    month,
    revenue: Math.round(monthTotals[i]),
  }));
}

export async function getMonthlyExpenseData(year: number) {
  const identifiers = ["withdraw"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const yearStartLao = startOfMonth(new Date(year, 0, 1));
  const yearEndLao = endOfMonth(new Date(year, 11, 1));

  const rows = await prisma.transaction_history.findMany({
    where: {
      status: "approved",
      identifier: { in: identifiers },
      createdAt: { gte: toUTCDate(yearStartLao), lte: toUTCDate(yearEndLao) },
    },
    select: { amount: true, createdAt: true },
  });

  const monthTotals = new Array(12).fill(0);
  for (const row of rows) {
    const laoTime = new Date(row.createdAt.getTime() + LAO_OFFSET_MS);
    const m = laoTime.getMonth();
    monthTotals[m] += Math.abs(row.amount || 0);
  }

  return months.map((month, i) => ({
    month,
    expense: Math.round(monthTotals[i]),
  }));
}

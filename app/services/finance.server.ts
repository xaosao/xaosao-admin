import { prisma } from "./database.server";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";

function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

function getDateRange(period: string, fromDate?: string, toDate?: string) {
  const now = new Date();

  if (fromDate || toDate) {
    const range: any = {};
    if (fromDate) range.gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      range.lt = end;
    }
    return range;
  }

  switch (period) {
    case "daily":
      return { gte: startOfDay(now), lte: endOfDay(now) };
    case "weekly":
      return {
        gte: startOfWeek(now, { weekStartsOn: 1 }),
        lte: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "monthly":
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
    case "3month":
      return { gte: startOfDay(subMonths(now, 3)), lte: endOfDay(now) };
    case "6month":
      return { gte: startOfDay(subMonths(now, 6)), lte: endOfDay(now) };
    default:
      return undefined;
  }
}

const formatKip = (amount: number) =>
  `${amount.toLocaleString("en-US")} ₭`;

// ===== SUMMARY STATS =====
export async function getFinanceSummary(
  period: string = "all",
  fromDate?: string,
  toDate?: string
) {
  const dateRange = getDateRange(period, fromDate, toDate);
  const dateFilter = dateRange ? { createdAt: dateRange } : {};
  const statusFilter = { in: ["approved", "success"] };
  const bookingStatusFilter = { in: ["approved", "success", "released"] };

  const [
    totalTopUps,
    totalSubscriptions,
    totalBookingHolds,
    totalModelEarnings,
    totalSystemCommission,
    totalReferralPayouts,
    totalBookingReferral,
    totalSubscriptionReferral,
  ] = await Promise.all([
    // 1. Total Customer Top-ups
    prisma.transaction_history.aggregate({
      where: {
        identifier: "recharge",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 2. Total Subscription Payments
    prisma.transaction_history.aggregate({
      where: {
        identifier: "subscription",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 3. Total Booking Payments (booking_hold uses "released" status when completed)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_hold",
        status: bookingStatusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 4. Total Model Earnings (booking + referral + commission)
    prisma.transaction_history.aggregate({
      where: {
        identifier: {
          in: [
            "booking_earning",
            "referral",
            "booking_referral",
            "subscription_referral",
          ],
        },
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 5. System Commission (from booking_earning comission field)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_earning",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { comission: true },
    }),
    // 6. Referral Bonuses paid out (50K each)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "referral",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 7. Booking Referral Commission paid
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_referral",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 8. Subscription Referral Commission paid
    prisma.transaction_history.aggregate({
      where: {
        identifier: "subscription_referral",
        status: statusFilter,
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
  ]);

  const topUpsAmount = totalTopUps._sum.amount || 0;
  const subscriptionAmount = totalSubscriptions._sum.amount || 0;
  const bookingAmount = Math.abs(totalBookingHolds._sum.amount || 0);
  const totalSpending = subscriptionAmount + bookingAmount;
  const modelEarningsAmount = totalModelEarnings._sum.amount || 0;
  const systemCommissionAmount = totalSystemCommission._sum.comission || 0;
  const referralPayoutsAmount = totalReferralPayouts._sum.amount || 0;
  const bookingReferralAmount = totalBookingReferral._sum.amount || 0;
  const subscriptionReferralAmount =
    totalSubscriptionReferral._sum.amount || 0;
  const totalReferralExpense =
    referralPayoutsAmount + bookingReferralAmount + subscriptionReferralAmount;
  const netSystemRevenue =
    systemCommissionAmount + subscriptionAmount - totalReferralExpense;

  return [
    {
      label: "Total Top-ups",
      value: formatKip(topUpsAmount),
      rawValue: topUpsAmount,
      icon: "ArrowUpCircle",
      color: "text-blue-600",
    },
    {
      label: "Total Spending",
      value: formatKip(totalSpending),
      rawValue: totalSpending,
      icon: "ShoppingCart",
      color: "text-orange-600",
    },
    {
      label: "Model Earnings",
      value: formatKip(modelEarningsAmount),
      rawValue: modelEarningsAmount,
      icon: "Users",
      color: "text-green-600",
    },
    {
      label: "System Commission",
      value: formatKip(systemCommissionAmount),
      rawValue: systemCommissionAmount,
      icon: "Building",
      color: "text-purple-600",
    },
    {
      label: "Subscription Revenue",
      value: formatKip(subscriptionAmount),
      rawValue: subscriptionAmount,
      icon: "CreditCard",
      color: "text-pink-600",
    },
    {
      label: "Net System Revenue",
      value: formatKip(netSystemRevenue),
      rawValue: netSystemRevenue,
      icon: "TrendingUp",
      color: "text-emerald-600",
    },
  ];
}

// ===== INCOME / EXPENSE BREAKDOWN =====
export async function getFinanceBreakdown(
  period: string = "all",
  fromDate?: string,
  toDate?: string
) {
  const dateRange = getDateRange(period, fromDate, toDate);
  const dateFilter = dateRange ? { createdAt: dateRange } : {};

  // Income breakdown
  const incomeIdentifiers = ["recharge", "subscription", "booking_hold"];
  const statusFilter = { in: ["approved", "success"] };
  const bookingStatusFilter = { in: ["approved", "success", "released"] };
  const [
    ...incomeResults
  ] = await Promise.all(
    incomeIdentifiers.map((id) =>
      prisma.transaction_history.aggregate({
        where: {
          identifier: id,
          status: id === "booking_hold" ? bookingStatusFilter : statusFilter,
          ...dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      })
    )
  );

  // Sub-breakdown: subscription referral commission paid to models
  const subscriptionReferralTotal = await prisma.transaction_history.aggregate({
    where: {
      identifier: "subscription_referral",
      status: statusFilter,
      ...dateFilter,
    },
    _sum: { amount: true },
  });

  // Sub-breakdown: booking model earn (booking_earning amount) + system commission + booking referral
  const [bookingModelEarnTotal, bookingSystemCommission, bookingReferralTotal] =
    await Promise.all([
      prisma.transaction_history.aggregate({
        where: {
          identifier: "booking_earning",
          status: statusFilter,
          ...dateFilter,
        },
        _sum: { amount: true },
      }),
      prisma.transaction_history.aggregate({
        where: {
          identifier: "booking_earning",
          status: statusFilter,
          ...dateFilter,
        },
        _sum: { comission: true },
      }),
      prisma.transaction_history.aggregate({
        where: {
          identifier: "booking_referral",
          status: statusFilter,
          ...dateFilter,
        },
        _sum: { amount: true },
      }),
    ]);

  const incomeLabels: Record<string, string> = {
    recharge: "Customer Top-ups",
    subscription: "Subscription Payments",
    booking_hold: "Booking Payments",
  };
  const incomeColors: Record<string, string> = {
    recharge: "bg-blue-500",
    subscription: "bg-pink-500",
    booking_hold: "bg-indigo-500",
  };

  // Total Income = Customer Top-ups only (subscription & booking are spent FROM top-ups)
  const topUpsAmount = Math.abs(incomeResults[0]._sum.amount || 0);
  const totalIncome = topUpsAmount;

  // Build sub-items for top-ups (spent vs remaining)
  const subscriptionTotal = Math.abs(incomeResults[1]._sum.amount || 0);
  const bookingTotal = Math.abs(incomeResults[2]._sum.amount || 0);
  const totalSpentFromTopUps = subscriptionTotal + bookingTotal;
  const remainingBalance = topUpsAmount - totalSpentFromTopUps;

  const topUpSubItems = [
    { label: "Total Spent", amount: totalSpentFromTopUps, formattedAmount: formatKip(totalSpentFromTopUps), color: "text-orange-600" },
    { label: "Remaining", amount: Math.max(remainingBalance, 0), formattedAmount: formatKip(Math.max(remainingBalance, 0)), color: "text-emerald-600" },
  ];

  // Build sub-items for subscription
  const subRefAmount = subscriptionReferralTotal._sum.amount || 0;
  const subscriptionSystemAmount = subscriptionTotal - subRefAmount;

  const subscriptionSubItems = [
    { label: "System", amount: subscriptionSystemAmount, formattedAmount: formatKip(subscriptionSystemAmount), color: "text-purple-600" },
    { label: "Commission", amount: subRefAmount, formattedAmount: formatKip(subRefAmount), color: "text-cyan-600" },
  ];

  // Build sub-items for booking (use actual booking_earning amount = what model receives)
  const bookingModelAmount = bookingModelEarnTotal._sum.amount || 0;
  const bookingSystemAmount = bookingSystemCommission._sum.comission || 0;
  const bookingRefAmount = bookingReferralTotal._sum.amount || 0;
  // Use sum of sub-items as the real booking total (model earn + system + commission)
  const bookingActualTotal = bookingModelAmount + bookingSystemAmount + bookingRefAmount;

  const bookingSubItems = [
    { label: "Model Earn", amount: bookingModelAmount, formattedAmount: formatKip(bookingModelAmount), color: "text-green-600" },
    { label: "System", amount: bookingSystemAmount, formattedAmount: formatKip(bookingSystemAmount), color: "text-purple-600" },
    { label: "Commission", amount: bookingRefAmount, formattedAmount: formatKip(bookingRefAmount), color: "text-cyan-600" },
  ];

  // Recalculate top-ups spent using actual booking total
  const totalSpentActual = subscriptionTotal + bookingActualTotal;
  const remainingActual = topUpsAmount - totalSpentActual;
  topUpSubItems[0] = { label: "Total Spent", amount: totalSpentActual, formattedAmount: formatKip(totalSpentActual), color: "text-orange-600" };
  topUpSubItems[1] = { label: "Remaining", amount: Math.max(remainingActual, 0), formattedAmount: formatKip(Math.max(remainingActual, 0)), color: "text-emerald-600" };

  const subItemsMap: Record<string, any[]> = {
    recharge: topUpSubItems,
    subscription: subscriptionSubItems,
    booking_hold: bookingSubItems,
  };

  // Override amounts for booking_hold to use actual sub-item totals
  const amountOverrides: Record<string, number> = {
    booking_hold: bookingActualTotal,
  };

  const income = incomeIdentifiers.map((id, i) => {
    const amount = amountOverrides[id] ?? Math.abs(incomeResults[i]._sum.amount || 0);
    return {
      category: id,
      label: incomeLabels[id],
      amount,
      formattedAmount: formatKip(amount),
      count: incomeResults[i]._count,
      percentage: totalIncome === 0 ? 0 : Math.round((amount / totalIncome) * 100),
      color: incomeColors[id],
      ...(subItemsMap[id] ? { subItems: subItemsMap[id] } : {}),
    };
  });

  // Expense breakdown (money paid to models)
  const expenseIdentifiers = [
    "booking_earning",
    "referral",
    "booking_referral",
    "subscription_referral",
    "withdrawal",
  ];
  const expenseStatusFilter = { in: ["approved", "success", "released"] };
  const expenseResults = await Promise.all(
    expenseIdentifiers.map((id) =>
      prisma.transaction_history.aggregate({
        where: {
          identifier: id,
          status: expenseStatusFilter,
          ...dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      })
    )
  );

  const expenseLabels: Record<string, string> = {
    booking_earning: "Booking Earnings",
    referral: "Referral Bonuses",
    booking_referral: "Booking Commission",
    subscription_referral: "Subscription Commission",
    withdrawal: "Withdrawals",
  };
  const expenseColors: Record<string, string> = {
    booking_earning: "bg-green-500",
    referral: "bg-yellow-500",
    booking_referral: "bg-teal-500",
    subscription_referral: "bg-cyan-500",
    withdrawal: "bg-red-500",
  };

  const totalExpense = expenseResults.reduce(
    (sum, r) => sum + Math.abs(r._sum.amount || 0),
    0
  );

  const expense = expenseIdentifiers.map((id, i) => {
    const amount = Math.abs(expenseResults[i]._sum.amount || 0);
    return {
      category: id,
      label: expenseLabels[id],
      amount,
      formattedAmount: formatKip(amount),
      count: expenseResults[i]._count,
      percentage:
        totalExpense === 0 ? 0 : Math.round((amount / totalExpense) * 100),
      color: expenseColors[id],
    };
  });

  return { income, expense, totalIncome, totalExpense };
}

// ===== MODEL EARNINGS TABLE =====
export async function getModelEarningsTable(
  options: {
    period?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const { period = "all", fromDate, toDate, page = 1, limit = 10 } = options;
  const dateRange = getDateRange(period, fromDate, toDate);
  const dateFilter = dateRange ? { createdAt: dateRange } : {};
  const statusFilter = { in: ["approved", "success"] };

  // Get all models that have any earnings
  const earningIdentifiers = [
    "booking_earning",
    "referral",
    "booking_referral",
    "subscription_referral",
  ];

  // Get distinct modelIds with earnings
  const modelsWithEarnings = await prisma.transaction_history.findMany({
    where: {
      identifier: { in: earningIdentifiers },
      status: statusFilter,
      modelId: { not: null },
      ...dateFilter,
    },
    select: { modelId: true },
    distinct: ["modelId"],
  });

  const totalCount = modelsWithEarnings.length;
  const totalPages = Math.ceil(totalCount / limit);
  const skip = (page - 1) * limit;

  // Get paginated model IDs
  const paginatedModelIds = modelsWithEarnings
    .slice(skip, skip + limit)
    .map((m) => m.modelId!)
    .filter(Boolean);

  if (paginatedModelIds.length === 0) {
    return {
      models: [],
      pagination: {
        currentPage: page,
        totalPages: 0,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        limit,
      },
    };
  }

  // Get model info
  const modelInfos = await prisma.model.findMany({
    where: { id: { in: paginatedModelIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profile: true,
      type: true,
    },
  });

  // Get earnings per model per identifier
  const earningsQueries = paginatedModelIds.flatMap((modelId) =>
    earningIdentifiers.map((identifier) =>
      prisma.transaction_history.aggregate({
        where: {
          modelId,
          identifier,
          status: statusFilter,
          ...dateFilter,
        },
        _sum: { amount: true },
      })
    )
  );

  const earningsResults = await Promise.all(earningsQueries);

  const models = paginatedModelIds.map((modelId, modelIndex) => {
    const info = modelInfos.find((m) => m.id === modelId);
    const baseIndex = modelIndex * earningIdentifiers.length;

    const bookingEarnings =
      earningsResults[baseIndex]._sum.amount || 0;
    const referralBonuses =
      earningsResults[baseIndex + 1]._sum.amount || 0;
    const bookingCommission =
      earningsResults[baseIndex + 2]._sum.amount || 0;
    const subscriptionCommission =
      earningsResults[baseIndex + 3]._sum.amount || 0;
    const totalEarnings =
      bookingEarnings + referralBonuses + bookingCommission + subscriptionCommission;

    return {
      modelId,
      firstName: info?.firstName || "Unknown",
      lastName: info?.lastName || "",
      profile: info?.profile || "",
      type: info?.type || "normal",
      bookingEarnings,
      referralBonuses,
      bookingCommission,
      subscriptionCommission,
      totalEarnings,
    };
  });

  // Sort by totalEarnings descending
  models.sort((a, b) => b.totalEarnings - a.totalEarnings);

  return {
    models,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
    },
  };
}

// ===== FINANCE TRANSACTIONS (paginated) =====
export async function getFinanceTransactions(
  options: {
    search?: string;
    identifier?: string;
    status?: string;
    period?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const {
    search = "",
    identifier = "all",
    status = "all",
    period = "all",
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = options;

  const whereClause: any = {};

  // Search
  if (search) {
    if (isValidObjectId(search)) {
      whereClause.OR = [
        { id: search },
        { modelId: search },
        { customerId: search },
      ];
    } else {
      whereClause.OR = [
        {
          model: {
            firstName: { contains: search, mode: "insensitive" },
          },
        },
        {
          model: {
            lastName: { contains: search, mode: "insensitive" },
          },
        },
        {
          customer: {
            firstName: { contains: search, mode: "insensitive" },
          },
        },
        {
          customer: {
            lastName: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }
  }

  // Identifier filter
  if (identifier && identifier !== "all") {
    whereClause.identifier = identifier;
  }

  // Status filter
  if (status && status !== "all") {
    whereClause.status = status;
  }

  // Date range
  const dateRange = getDateRange(period, fromDate, toDate);
  if (dateRange) {
    whereClause.createdAt = dateRange;
  }

  const skip = (page - 1) * limit;

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction_history.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            type: true,
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
      },
    }),
    prisma.transaction_history.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    transactions,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
    },
  };
}

// ===== CSV EXPORT DATA =====
export async function getFinanceCSVData(
  options: {
    identifier?: string;
    status?: string;
    period?: string;
    fromDate?: string;
    toDate?: string;
  } = {}
) {
  const {
    identifier = "all",
    status = "all",
    period = "all",
    fromDate,
    toDate,
  } = options;

  const whereClause: any = {};

  if (identifier && identifier !== "all") {
    whereClause.identifier = identifier;
  }
  if (status && status !== "all") {
    whereClause.status = status;
  }

  const dateRange = getDateRange(period, fromDate, toDate);
  if (dateRange) {
    whereClause.createdAt = dateRange;
  }

  const transactions = await prisma.transaction_history.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      model: {
        select: { firstName: true, lastName: true },
      },
      customer: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return transactions.map((t) => {
    const owner = t.model || t.customer;
    const userType = t.model ? "Model" : "Customer";
    return {
      ID: t.id,
      "User Type": userType,
      "User Name": `${owner?.firstName || "Unknown"} ${owner?.lastName || ""}`.trim(),
      Type: t.identifier,
      Amount: Math.abs(t.amount || 0),
      Commission: t.comission || 0,
      Fee: t.fee || 0,
      Status: t.status,
      Date: t.createdAt
        ? new Date(t.createdAt).toISOString().split("T")[0]
        : "",
    };
  });
}

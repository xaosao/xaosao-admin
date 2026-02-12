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
        status: "approved",
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 2. Total Subscription Payments
    prisma.transaction_history.aggregate({
      where: {
        identifier: "subscription",
        status: "approved",
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 3. Total Booking Payments (released holds)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_hold",
        status: "released",
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
        status: { in: ["approved", "released"] },
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 5. System Commission (from booking_earning comission field)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_earning",
        status: { in: ["approved", "released"] },
        ...dateFilter,
      },
      _sum: { comission: true },
    }),
    // 6. Referral Bonuses paid out (50K each)
    prisma.transaction_history.aggregate({
      where: {
        identifier: "referral",
        status: "approved",
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 7. Booking Referral Commission paid
    prisma.transaction_history.aggregate({
      where: {
        identifier: "booking_referral",
        status: "approved",
        ...dateFilter,
      },
      _sum: { amount: true },
    }),
    // 8. Subscription Referral Commission paid
    prisma.transaction_history.aggregate({
      where: {
        identifier: "subscription_referral",
        status: "approved",
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
  const incomeResults = await Promise.all(
    incomeIdentifiers.map((id) =>
      prisma.transaction_history.aggregate({
        where: {
          identifier: id,
          status: {
            in:
              id === "booking_hold"
                ? ["released"]
                : ["approved"],
          },
          ...dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      })
    )
  );

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

  const totalIncome = incomeResults.reduce(
    (sum, r) => sum + Math.abs(r._sum.amount || 0),
    0
  );

  const income = incomeIdentifiers.map((id, i) => {
    const amount = Math.abs(incomeResults[i]._sum.amount || 0);
    return {
      category: id,
      label: incomeLabels[id],
      amount,
      formattedAmount: formatKip(amount),
      count: incomeResults[i]._count,
      percentage: totalIncome === 0 ? 0 : Math.round((amount / totalIncome) * 100),
      color: incomeColors[id],
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
  const expenseResults = await Promise.all(
    expenseIdentifiers.map((id) =>
      prisma.transaction_history.aggregate({
        where: {
          identifier: id,
          status: { in: ["approved", "released"] },
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
      status: { in: ["approved", "released"] },
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
          status: { in: ["approved", "released"] },
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

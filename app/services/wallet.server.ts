import { Prisma } from "@prisma/client";
import { prisma } from "./database.server";
import { UserStatus } from "~/interfaces/base";
import { createAuditLogs } from "./log.server";
import { IWalletInputs } from "~/interfaces/wallet";
import { FieldValidationError } from "./admin.server";

export async function getWallets(
  options: {
    type?: string;
    order?: string;
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const {
      type = "all",
      order = "desc",
      status = "all",
      search = "",
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = options;

    const whereClause: any = {};

    if (type === "model") {
      whereClause.modelId = { not: null };
    } else if (type === "customer") {
      whereClause.customerId = { not: null };
    }

    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Search by model or customer first name and last name
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        {
          model: {
            OR: [
              { firstName: { contains: searchTerm, mode: "insensitive" } },
              { lastName: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
        {
          customer: {
            OR: [
              { firstName: { contains: searchTerm, mode: "insensitive" } },
              { lastName: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ];
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

    const [wallets, totalCount] = await Promise.all([
      prisma.wallet.findMany({
        where: whereClause,
        orderBy: {
          createdAt: order === "asc" ? "asc" : "desc",
        },
        skip,
        take: limit,
        include: {
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              status: true,
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
        },
      }),
      prisma.wallet.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      wallets,
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
    console.error("FETCH_WALLETS_DATA_FAILED", error);
    throw new Error("Failed to get wallets!");
  }
}

export async function getWallet(id: string) {
  try {
    return await prisma.wallet.findFirst({
      where: { id },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            status: true,
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
      },
    });
  } catch (error) {
    console.error("GET_WALLET_FAILED", error);
    throw new Error("Failed to fetch wallet!");
  }
}

export async function getWalletStatus() {
  try {
    const [total, balance, recharge, deposit] = await Promise.all([
      prisma.wallet.count(),
      prisma.wallet.aggregate({
        _sum: {
          totalBalance: true,
        },
      }),
      prisma.wallet.aggregate({
        _sum: {
          totalRecharge: true,
        },
      }),
      prisma.wallet.aggregate({
        _sum: {
          totalWithdraw: true,
        },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const customerStats = [
      {
        title: "Total Wallets",
        value: format(total),
        icon: "Wallet",
        color: "text-blue-600",
      },
      {
        title: "Active Balances",
        value: `${format(balance._sum.totalBalance || 0)} Kip`,
        icon: "DollarSign",
        color: "text-green-600",
      },
      {
        title: "Total Recharges",
        value: `${format(recharge._sum.totalRecharge || 0)} Kip`,
        icon: "DollarSign",
        color: "text-green-600",
      },
      {
        title: "Total Withdrawn",
        value: `${format(deposit._sum.totalWithdraw || 0)} Kip`,
        icon: "DollarSign",
        color: "text-red-600",
      },
    ];

    return customerStats;
  } catch (err) {
    console.error("FETCH_CUSTOMER_STATS_FAILED", err);
    throw new Error("Failed to get customer stats.");
  }
}

export async function getUserWalletStatus(id: string) {
  try {
    const [balance, recharge, withdrawn] = await Promise.all([
      prisma.wallet.aggregate({
        where: { id: id }, // Filter for specific user
        _sum: {
          totalBalance: true,
        },
      }),
      prisma.wallet.aggregate({
        where: { id: id },
        _sum: {
          totalRecharge: true,
        },
      }),
      prisma.wallet.aggregate({
        where: { id: id },
        _sum: {
          totalWithdraw: true,
        },
      }),
    ]);

    const totalRecharge = recharge._sum.totalRecharge || 0;
    const totalWithdraw = withdrawn._sum.totalWithdraw || 0;
    const totalBalance = balance._sum.totalBalance || 0;
    // Available balance = totalBalance - totalWithdraw (for models)
    const totalAvailable = totalBalance - totalWithdraw;

    const format = (val: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(val);

    const customerStats = [
      {
        title: "Total Balance",
        value: format(totalBalance),
        icon: "DollarSign",
        color: "text-green-600",
      },
      {
        title: "Total Recharged",
        value: format(totalRecharge),
        icon: "ArrowUpRight",
        color: "text-green-600",
      },
      {
        title: "Total Withdrawn",
        value: format(totalWithdraw),
        icon: "ArrowDownRight",
        color: "text-red-600",
      },
      {
        title: "Available",
        value: format(totalAvailable),
        icon: "Activity",
        color: "text-purple-600",
      },
    ];

    return customerStats;
  } catch (err) {
    console.error("FETCH_CUSTOMER_STATS_FAILED", err);
    throw new Error("Failed to get customer stats.");
  }
}

export async function getTopEarningWallet() {
  try {
    const wallets = await prisma.wallet.findMany({
      where: {
        modelId: { not: null },
      },
      orderBy: {
        totalBalance: "desc",
      },
      take: 5,
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
      },
    });

    return wallets.map((wallet, index) => ({
      rank: index + 1,
      name: `${wallet.model?.firstName ?? ""} ${wallet.model?.lastName ?? ""}`,
      profile: wallet.model?.profile,
      earnings: wallet.totalBalance,
      withdrawn: wallet.totalWithdraw,
      available: wallet.totalBalance - wallet.totalWithdraw,
    }));
  } catch (error) {
    console.error("GET_TOP_EARNING_WALLETS_FAILED", error);
    throw new Error("Failed to get top earning wallets.");
  }
}

export async function createWallet(data: IWalletInputs, userId: string) {
  if (!data) throw new Error("Missing model creation data!");

  const auditBase = {
    action: "CREATE_WALLET",
    user: userId,
  };

  try {
    const orConditions: Prisma.walletWhereInput[] = [];
    if (data.customer) {
      orConditions.push({ customer: { id: data.customer } });
    }
    if (data.model) {
      orConditions.push({ model: { id: data.model } });
    }

    const existingWallet = await prisma.wallet.findFirst({
      where: {
        OR: orConditions.length > 0 ? orConditions : undefined,
      },
    });

    if (existingWallet) {
      const error = new Error("The wallet already exists!") as any;
      error.status = 422;
      throw error;
    }

    const wallet = await prisma.wallet.create({
      data: {
        totalBalance: 0,
        totalRecharge: 0,
        totalDeposit: 0,
        status: UserStatus.ACTIVE,
        ...(data.customer && { customer: { connect: { id: data.customer } } }),
        ...(data.model && { model: { connect: { id: data.model } } }),
      },
    });

    if (wallet.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create wallet: ${wallet.id} successfully.`,
        status: "success",
        onSuccess: wallet,
      });
    }
    return wallet;
  } catch (error) {
    console.error("CREATE_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Crate wallet failed!`,
      status: "failed",
      onError: error,
    });
    throw new Error("Failed to create wallet account!");
  }
}

export async function updateWallet(
  id: string,
  data: IWalletInputs,
  userId: string
) {
  if (!id || !data || !userId) throw new Error("Missing service update data!");

  const auditBase = {
    action: "UPDATE_WALLET",
    user: userId,
  };

  try {
    const res = await prisma.wallet.update({
      where: { id },
      data: {
        totalBalance: data.totalBalance,
        totalRecharge: data.totalRecharge,
        totalWithdraw: data.totalWithdraw,
        totalSpend: data.totalSpend,
        totalRefunded: data.totalRefunded,
        totalPending: data.totalPending,
        status: data.status,
        updatedAt: new Date(),
        updatedBy: {
          connect: {
            id: userId,
          },
        },
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update wallet: ${res.id} successfully.`,
        status: "success",
        onSuccess: res,
      });
    }

    return res;
  } catch (error) {
    console.error("UPDATE_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update users wallet failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to update wallet. Try again later!",
    });
  }
}

export async function deleteWallet(id: string, userId: string) {
  if (!id) throw new Error("Wallet id is required!");
  const auditBase = {
    action: "DELETE_WALLET_ACCOUNT",
    user: userId,
  };
  try {
    const res = await prisma.wallet.delete({
      where: { id },
    });
    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Wallet with ID ${id} deleted successfully.`,
        status: "success",
        onSuccess: res,
      });
    }
    return res;
  } catch (error) {
    console.log("DELETE_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Wallet with ID ${id} deleted failed.`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      id: "Delete wallet failed! Try again later!",
    });
  }
}

export async function bannedWallet(id: string, userId: string) {
  if (!id || !userId) throw new Error("Missing service banned data!");

  const auditBase = {
    action: "BANNED_WALLET",
    user: userId,
  };

  try {
    const res = await prisma.wallet.update({
      where: { id },
      data: {
        status: "suspended",
        updatedAt: new Date(),
        updatedBy: {
          connect: {
            id: userId,
          },
        },
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Banned wallet: ${res.id} successfully.`,
        status: "success",
        onSuccess: res,
      });
    }

    return res;
  } catch (error) {
    console.error("BANNED_WALLET_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Banned users wallet failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to suspend wallet! Try again later!",
    });
  }
}

export interface WalletSummaryTransaction {
  id: string;
  identifier: string;
  amount: number;
  status: string;
  createdAt: Date;
  reason: string | null;
}

export interface WalletSummaryResult {
  wallet: {
    id: string;
    status: string;
    modelId: string | null;
    customerId: string | null;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string | null;
    profile: string | null;
  } | null;
  ownerType: "model" | "customer";
  earnings: {
    transactions: WalletSummaryTransaction[];
    total: number;
  };
  withdrawals: {
    transactions: WalletSummaryTransaction[];
    total: number;
  };
  refunds: {
    transactions: WalletSummaryTransaction[];
    total: number;
  };
  availableBalance: number;
}

/**
 * Get wallet summary with all earnings and withdrawals calculated from actual transactions.
 * Excludes failed, rejected, and disputed transactions.
 *
 * For Models:
 * - Earnings: booking_earning, booking_referral, subscription_referral, referral (approved/released status)
 * - Withdrawals: withdrawal (approved status)
 * - Available: earnings - withdrawals
 *
 * For Customers:
 * - Incoming: recharge (top-up only, approved status)
 * - Outgoing: subscription (approved), booking_hold (held/released/refunded status)
 * - Refunds: booking_refund, call_refund, call_refund_unused (approved status)
 * - Available: incoming - outgoing + refunds
 */
export async function getWalletSummary(
  walletId: string
): Promise<WalletSummaryResult> {
  try {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId },
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
      },
    });

    if (!wallet) {
      throw new Error("Wallet not found!");
    }

    const isModel = wallet.modelId !== null;
    const owner = isModel ? wallet.model : wallet.customer;
    const ownerId = isModel ? wallet.modelId : wallet.customerId;

    if (!ownerId) {
      throw new Error("Wallet owner not found!");
    }

    // Define transaction identifiers and statuses based on wallet type
    // For customers: only count "recharge" (top-up) as incoming, NOT refunds
    // Refunds are returned spending, not new incoming funds
    const earningIdentifiers = isModel
      ? ["booking_earning", "booking_referral", "subscription_referral", "referral"]
      : ["recharge"];

    const earningStatuses = isModel
      ? ["approved", "released"]
      : ["approved"];

    const withdrawalIdentifiers = isModel
      ? ["withdrawal"]
      : ["subscription", "booking_hold"];

    // For customers: booking_hold uses "held/released/refunded" status, subscription uses "approved"
    // Include "refunded" so that booking_hold + booking_refund properly cancel out
    const withdrawalStatuses = isModel
      ? ["approved"]
      : ["approved", "released", "held", "refunded"];

    // Build the where clause for the owner
    const ownerWhereClause = isModel
      ? { modelId: ownerId }
      : { customerId: ownerId };

    // Fetch earnings transactions
    const earningsTransactions = await prisma.transaction_history.findMany({
      where: {
        ...ownerWhereClause,
        identifier: { in: earningIdentifiers },
        status: { in: earningStatuses },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        amount: true,
        status: true,
        createdAt: true,
        reason: true,
      },
    });

    // Fetch withdrawals/outgoing transactions
    const withdrawalsTransactions = await prisma.transaction_history.findMany({
      where: {
        ...ownerWhereClause,
        identifier: { in: withdrawalIdentifiers },
        status: { in: withdrawalStatuses },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        identifier: true,
        amount: true,
        status: true,
        createdAt: true,
        reason: true,
      },
    });

    // Calculate totals (use absolute values to handle any negative amounts)
    const earningsTotal = earningsTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );
    const withdrawalsTotal = withdrawalsTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // Fetch refunds for customers only (booking_refund, call_refund, call_refund_unused)
    // Refunds restore previously spent funds, so they're added back to available balance
    const refundIdentifiers = ["booking_refund", "call_refund", "call_refund_unused"];
    const refundsTransactions = !isModel
      ? await prisma.transaction_history.findMany({
          where: {
            ...ownerWhereClause,
            identifier: { in: refundIdentifiers },
            status: "approved",
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            identifier: true,
            amount: true,
            status: true,
            createdAt: true,
            reason: true,
          },
        })
      : [];

    const refundsTotal = refundsTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    // Available balance calculation:
    // For customers: earnings - withdrawals + refunds (refunds restore previously spent funds)
    // For models: earnings - withdrawals (no refunds)
    const availableBalance = isModel
      ? earningsTotal - withdrawalsTotal
      : earningsTotal - withdrawalsTotal + refundsTotal;

    return {
      wallet: {
        id: wallet.id,
        status: wallet.status,
        modelId: wallet.modelId,
        customerId: wallet.customerId,
      },
      owner: owner
        ? {
            id: owner.id,
            firstName: owner.firstName,
            lastName: owner.lastName,
            profile: owner.profile,
          }
        : null,
      ownerType: isModel ? "model" : "customer",
      earnings: {
        transactions: earningsTransactions,
        total: earningsTotal,
      },
      withdrawals: {
        transactions: withdrawalsTransactions,
        total: withdrawalsTotal,
      },
      refunds: {
        transactions: refundsTransactions,
        total: refundsTotal,
      },
      availableBalance,
    };
  } catch (error) {
    console.error("GET_WALLET_SUMMARY_FAILED", error);
    throw new Error("Failed to fetch wallet summary!");
  }
}

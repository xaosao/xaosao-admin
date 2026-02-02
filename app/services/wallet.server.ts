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
          totalDeposit: true,
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
        title: "Total recharges",
        value: `${format(recharge._sum.totalRecharge || 0)} Kip`,
        icon: "DollarSign",
        color: "text-red-600",
      },
      {
        title: "Total deposit",
        value: `${format(deposit._sum.totalDeposit || 0)} Kip`,
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
    const [balance, recharge, deposit] = await Promise.all([
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
          totalDeposit: true,
        },
      }),
    ]);

    const totalRecharge = recharge._sum.totalRecharge || 0;
    const totalDeposit = deposit._sum.totalDeposit || 0;
    const netFlow = totalRecharge - totalDeposit;

    const format = (val: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(val);

    const customerStats = [
      {
        title: "Total Balances",
        value: format(balance._sum.totalBalance || 0),
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
        title: "Total Deposits",
        value: format(totalDeposit),
        icon: "ArrowDownRight",
        color: "text-red-600",
      },
      {
        title: "Net Flow",
        value: format(netFlow),
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
      balance: wallet.totalDeposit,
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
        totalDeposit: data.totalDeposit,
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

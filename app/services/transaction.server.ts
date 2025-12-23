import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";
import { ITransactionInput } from "~/routes/dashboard.transactions.reject.$id";
import { notifyTransactionApproved, notifyTransactionRejected } from "./email.server";

function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

export async function getTransactions(
  options: {
    search?: string;
    identifier?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const {
      search = "",
      identifier = "all",
      status = "all",
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = options;

    const whereClause: any = {};
    if (search) {
      if (isValidObjectId(search)) {
        whereClause.OR = [
          { id: search },
          { modelId: search },
          { customerId: search },
        ];
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

    if (identifier && identifier !== "all") {
      whereClause.identifier = identifier;
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
              gender: true,
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
      }),
      prisma.transaction_history.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      transactions,
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
    console.error("GET_TRANSACTION_FAILED", error);
    throw new Error("Failed to fetch transactions!");
  }
}

export async function getTransaction(id: string) {
  try {
    return await prisma.transaction_history.findFirst({
      where: { id },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
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
        ApprovedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
        RejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("GET_TRANSACTIONS_FAILED", error);
    throw new Error("Failed to fetch transactions!");
  }
}

export async function rejectTransaction(
  id: string,
  data: ITransactionInput,
  userId: string
) {
  if (!id) throw new Error("Transaction id is required!");
  const auditBase = {
    action: "REJECT_TRANSACTION",
    user: userId,
  };

  try {
    const res = await prisma.transaction_history.update({
      where: { id },
      data: {
        rejectReason: data.reject_reason,
        status: "rejected",
        ApprovedBy: { connect: { id: userId } },
        updatedAt: new Date(),
      },
      include: {
        model: {
          select: {
            firstName: true,
            lastName: true,
            whatsapp: true,
          },
        },
      },
    });

    if (res.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Transaction with ID ${id} rejected successfully.`,
        status: "success",
        onSuccess: res,
      });

      // Send email and SMS notification to the model
      notifyTransactionRejected({
        id: res.id,
        amount: res.amount,
        identifier: res.identifier,
        model: res.model,
        rejectReason: res.rejectReason,
      });
    }
    return res;
  } catch (error) {
    console.log("REJECT_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Transaction with ID ${id} rejected failed.`,
      status: "failed",
      onError: error,
    });
    throw new Error("Failed to rejected transaction");
  }
}

export async function getTransactionStatus() {
  try {
    const [total, approved, rejected, pending] = await Promise.all([
      prisma.transaction_history.count(),
      prisma.transaction_history.count({
        where: { status: "approved" },
      }),
      prisma.transaction_history.count({
        where: { status: "rejected" },
      }),
      prisma.transaction_history.count({
        where: { status: "pending" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const transactionStatus = [
      {
        title: "Total Transaction",
        value: format(total),
        icon: "CircleDollarSign",
        color: "text-blue-600",
      },
      {
        title: "Approved transaction",
        value: format(approved),
        icon: "CircleDollarSign",
        color: "text-green-600",
      },
      {
        title: "Rejected transaction",
        value: format(rejected),
        icon: "CircleDollarSign",
        color: "text-red-600",
      },
      {
        title: "Pending Transaction",
        value: format(pending),
        icon: "CircleDollarSign",
        color: "text-yellow-600",
      },
    ];

    return transactionStatus;
  } catch (err) {
    console.error("FETCH_TRANSACTION_STATS_FAILED", err);
    throw new Error("Failed to get transaction status!");
  }
}

export async function getRecentTransactions(
  modelId?: string,
  customerId?: string,
  take: number = 10
) {
  try {
    const where: any = {};

    if (modelId) where.modelId = modelId;
    if (customerId) where.customerId = customerId;

    return await prisma.transaction_history.findMany({
      take,
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
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
  } catch (error) {
    console.error("GET_RECENT_TRANSACTIONS_FAILED", error);
    throw new Error("Failed to fetch recent transactions!");
  }
}

export async function approveTransaction(
  transactionId: string,
  approverUserId: string,
  type: "model" | "customer"
) {
  if (!transactionId)
    throw new FieldValidationError({
      id: "Transaction ID is required!",
    });

  const auditBase = {
    action: "APPROVED_TRANSACTION",
    user: approverUserId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: { id: transactionId },
      include: {
        model: {
          select: {
            id: true,
            Wallet: {
              select: { id: true },
            },
          },
        },
        customer: {
          select: {
            id: true,
            Wallet: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!transaction)
      throw new FieldValidationError({
        id: "Transaction not found!",
      });

    if (transaction.status === "approved")
      throw new FieldValidationError({
        id: "Transaction is already approved!",
      });

    let walletId: string | undefined;

    if (type === "model") {
      if (!transaction.model) {
        throw new FieldValidationError({
          id: "No model associated with this transaction!",
        });
      }
      if (!transaction.model.Wallet || transaction.model.Wallet.length === 0) {
        // Auto-create wallet for the model if it doesn't exist
        console.log(`Creating wallet for model ${transaction.model.id} as it doesn't exist...`);
        const newWallet = await prisma.wallet.create({
          data: {
            totalBalance: 0,
            totalRecharge: 0,
            totalDeposit: 0,
            status: "active",
            model: { connect: { id: transaction.model.id } },
          },
        });
        walletId = newWallet.id;
        console.log(`Created wallet ${walletId} for model ${transaction.model.id}`);
      } else {
        walletId = transaction.model.Wallet[0].id;
      }
    } else if (type === "customer") {
      if (!transaction.customer) {
        throw new FieldValidationError({
          id: "No customer associated with this transaction!",
        });
      }
      if (!transaction.customer.Wallet || transaction.customer.Wallet.length === 0) {
        // Auto-create wallet for the customer if it doesn't exist
        console.log(`Creating wallet for customer ${transaction.customer.id} as it doesn't exist...`);
        const newWallet = await prisma.wallet.create({
          data: {
            totalBalance: 0,
            totalRecharge: 0,
            totalDeposit: 0,
            status: "active",
            customer: { connect: { id: transaction.customer.id } },
          },
        });
        walletId = newWallet.id;
        console.log(`Created wallet ${walletId} for customer ${transaction.customer.id}`);
      } else {
        walletId = transaction.customer.Wallet[0].id;
      }
    }

    if (!walletId) {
      throw new FieldValidationError({
        id: "Wallet not found for this transaction!",
      });
    }

    await updateWalletBalanceByTransaction({
      type: transaction.identifier,
      amount: transaction.amount,
      walletId: walletId,
    });

    const updatedTransaction = await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        status: "approved",
        ApprovedBy: { connect: { id: approverUserId } },
        updatedAt: new Date(),
      },
      include: {
        model: {
          select: {
            firstName: true,
            lastName: true,
            whatsapp: true,
          },
        },
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Transaction with ID ${transactionId} approved successfully.`,
      status: "success",
      onSuccess: updatedTransaction,
    });

    // Send email and SMS notification to the model
    notifyTransactionApproved({
      id: updatedTransaction.id,
      amount: updatedTransaction.amount,
      identifier: updatedTransaction.identifier,
      model: updatedTransaction.model,
    });

    return updatedTransaction;
  } catch (error) {
    console.error("APPROVED_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Transaction with ID ${transactionId} approval failed.`,
      status: "failed",
      onError: error,
    });

    throw new Error("Failed to approve transaction.");
  }
}

async function updateWalletBalanceByTransaction(transaction: {
  type: string;
  amount: number;
  walletId: string;
}) {
  const { type, amount, walletId } = transaction;

  if (!walletId || !amount) {
    throw new Error("Missing wallet ID or amount.");
  }

  const isRecharge = type === "recharge";
  const isWithdraw = type === "withdraw" || type === "withdrawal" || type === "deposit";

  if (isRecharge) {
    return await prisma.wallet.update({
      where: { id: walletId },
      data: {
        totalBalance: {
          increment: amount,
        },
        totalRecharge: {
          increment: amount,
        },
      },
    });
  } else if (isWithdraw) {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.totalBalance < amount) {
      throw new Error("Insufficient wallet balance.");
    }

    return await prisma.wallet.update({
      where: { id: walletId },
      data: {
        totalBalance: {
          decrement: amount,
        },
        totalDeposit: {
          increment: amount,
        },
      },
    });
  } else {
    throw new Error(`Unknown transaction type: ${type}`);
  }
}

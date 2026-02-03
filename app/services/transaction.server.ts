import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";
import { ITransactionInput } from "~/routes/dashboard.transactions.reject.$id";
import {
  notifyTransactionApproved,
  notifyTransactionRejected,
} from "./email.server";

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
    const transaction = await prisma.transaction_history.findFirst({
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

    // For withdrawal transactions, fetch the bank information
    let bank = null;
    if (transaction?.identifier === "withdrawal" && transaction.reason) {
      // Extract bank ID from reason: "Withdrawal to bank account: {bankId}"
      const bankIdMatch = transaction.reason.match(
        /Withdrawal to bank account: (.+)/
      );
      if (bankIdMatch && bankIdMatch[1]) {
        const bankId = bankIdMatch[1].trim();
        // Validate if bankId looks like a valid MongoDB ObjectId (24 hex characters)
        const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(bankId);
        if (isValidObjectId) {
          try {
            bank = await prisma.banks.findUnique({
              where: { id: bankId },
              select: {
                id: true,
                qr_code: true,
              },
            });
          } catch (bankError) {
            console.error("Failed to fetch bank info:", bankError);
            // Continue without bank info if lookup fails
          }
        }
      }
    }

    return { ...transaction, bank };
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
        customer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (res.id) {
      // Check for pending subscription linked to this transaction (customer only)
      if (res.customerId) {
        const pendingSubscription = await prisma.subscription.findFirst({
          where: {
            transactionId: id,
            customerId: res.customerId,
            status: "pending_payment",
          },
        });

        if (pendingSubscription) {
          console.log(
            `Found pending subscription ${pendingSubscription.id} for rejected transaction ${id}`
          );

          // Update subscription to expired
          await prisma.subscription.update({
            where: { id: pendingSubscription.id },
            data: {
              status: "expired",
              notes: "Transaction rejected by admin",
            },
          });

          // Update subscription history
          await prisma.subscription_history.updateMany({
            where: {
              subscriptionId: pendingSubscription.id,
              status: "pending_payment",
            },
            data: {
              status: "expired",
            },
          });

          console.log(
            `Expired subscription ${pendingSubscription.id} due to transaction rejection`
          );
        }
      }

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
        title: "Total",
        value: format(total),
        icon: "CircleDollarSign",
        color: "text-blue-600",
      },
      {
        title: "Approved",
        value: format(approved),
        icon: "CircleDollarSign",
        color: "text-green-600",
      },
      {
        title: "Rejected",
        value: format(rejected),
        icon: "CircleDollarSign",
        color: "text-red-600",
      },
      {
        title: "Pending",
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
        console.log(
          `Creating wallet for model ${transaction.model.id} as it doesn't exist...`
        );
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
        console.log(
          `Created wallet ${walletId} for model ${transaction.model.id}`
        );
      } else {
        walletId = transaction.model.Wallet[0].id;
      }
    } else if (type === "customer") {
      if (!transaction.customer) {
        throw new FieldValidationError({
          id: "No customer associated with this transaction!",
        });
      }
      if (
        !transaction.customer.Wallet ||
        transaction.customer.Wallet.length === 0
      ) {
        // Auto-create wallet for the customer if it doesn't exist
        console.log(
          `Creating wallet for customer ${transaction.customer.id} as it doesn't exist...`
        );
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
        console.log(
          `Created wallet ${walletId} for customer ${transaction.customer.id}`
        );
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

    // Check for pending subscription linked to this transaction (customer top-up only)
    if (type === "customer" && transaction.customerId) {
      const pendingSubscription = await prisma.subscription.findFirst({
        where: {
          transactionId: transactionId,
          customerId: transaction.customerId,
          status: "pending_payment",
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              durationDays: true,
            },
          },
        },
      });

      if (pendingSubscription) {
        console.log(
          `Found pending subscription ${pendingSubscription.id} for transaction ${transactionId}`
        );

        // Deduct subscription price from customer wallet
        await prisma.wallet.update({
          where: { id: walletId },
          data: {
            totalBalance: {
              decrement: pendingSubscription.plan.price,
            },
          },
        });

        // Update subscription to active
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(
          startDate.getDate() + pendingSubscription.plan.durationDays
        );

        await prisma.subscription.update({
          where: { id: pendingSubscription.id },
          data: {
            status: "active",
            startDate,
            endDate,
            notes: "Activated after transaction approval",
          },
        });

        // Update subscription history
        await prisma.subscription_history.updateMany({
          where: {
            subscriptionId: pendingSubscription.id,
            status: "pending_payment",
          },
          data: {
            status: "active",
            startDate,
            endDate,
          },
        });

        console.log(
          `Activated subscription ${pendingSubscription.id} for customer ${transaction.customerId}`
        );

        // Send SSE notification to customer about subscription activation
        try {
          const clientBackendUrl = process.env.CLIENT_BACKEND_URL;
          const sseApiSecret = process.env.SSE_API_SECRET;

          if (clientBackendUrl && sseApiSecret) {
            const response = await fetch(
              `${clientBackendUrl}/api/trigger-subscription-event`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-API-Secret": sseApiSecret,
                },
                body: JSON.stringify({
                  customerId: transaction.customerId,
                  subscriptionId: pendingSubscription.id,
                  status: "active",
                }),
              }
            );

            if (response.ok) {
              const result = await response.json();
              console.log(
                `SSE notification sent successfully to customer ${transaction.customerId}:`,
                result
              );
            } else {
              const error = await response.text();
              console.error(
                `Failed to send SSE notification (${response.status}):`,
                error
              );
            }
          } else {
            console.warn(
              "CLIENT_BACKEND_URL or SSE_API_SECRET not configured, skipping SSE notification"
            );
          }
        } catch (notificationError) {
          console.error("Error sending SSE notification:", notificationError);
          // Don't fail the transaction if notification fails
        }
      }
    }

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

/**
 * Refund a held transaction back to customer wallet
 */
export async function refundHeldTransaction(
  transactionId: string,
  approverUserId: string,
  reason?: string
) {
  if (!transactionId) {
    throw new FieldValidationError({
      id: "Transaction ID is required!",
    });
  }

  const auditBase = {
    action: "REFUND_HELD_TRANSACTION",
    user: approverUserId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: { id: transactionId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            whatsapp: true,
            Wallet: { select: { id: true, totalBalance: true } },
          },
        },
      },
    });

    if (!transaction) {
      throw new FieldValidationError({ id: "Transaction not found!" });
    }

    if (transaction.identifier !== "booking_hold") {
      throw new FieldValidationError({
        id: "Only booking hold transactions can be refunded!",
      });
    }

    // Don't allow if already refunded
    if (transaction.status === "refunded") {
      throw new FieldValidationError({
        id: "This transaction has already been refunded!",
      });
    }

    // Extract booking ID from reason
    const bookingIdMatch = transaction.reason?.match(/[Bb]ooking #(\w+)/);
    const bookingId = bookingIdMatch?.[1];

    // Get booking with model and service info for notifications and pending transaction handling
    let bookingForNotification: {
      status: string;
      price: number;
      releaseTransactionId: string | null;
      model: { id: string; firstName: string; lastName: string | null } | null;
      modelService: { service: { name: string; commission: number } | null } | null;
    } | null = null;

    // Check booking status - allow refund for held OR when booking is confirmed/disputed
    if (transaction.status !== "held" && bookingId) {
      const booking = await prisma.service_booking.findUnique({
        where: { id: bookingId },
        select: {
          status: true,
          price: true,
          releaseTransactionId: true,
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          modelService: {
            select: {
              service: {
                select: {
                  name: true,
                  commission: true,
                },
              },
            },
          },
        },
      });
      bookingForNotification = booking;
      const allowedStatuses = ["confirmed", "disputed"];
      if (!booking || !allowedStatuses.includes(booking.status)) {
        throw new FieldValidationError({
          id: "Transaction can only be refunded when booking is confirmed or disputed!",
        });
      }
    } else if (transaction.status !== "held") {
      throw new FieldValidationError({
        id: "Only held transactions can be refunded!",
      });
    } else if (bookingId) {
      // Get booking info for notifications even for held transactions
      bookingForNotification = await prisma.service_booking.findUnique({
        where: { id: bookingId },
        select: {
          status: true,
          price: true,
          releaseTransactionId: true,
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          modelService: {
            select: {
              service: {
                select: {
                  name: true,
                  commission: true,
                },
              },
            },
          },
        },
      });
    }

    if (!transaction.customer) {
      throw new FieldValidationError({
        id: "No customer associated with this transaction!",
      });
    }

    const customerWallet = transaction.customer.Wallet?.[0];
    if (!customerWallet) {
      throw new FieldValidationError({
        id: "Customer wallet not found!",
      });
    }

    // The held amount is stored as negative, so we need to get the absolute value
    const refundAmount = Math.abs(transaction.amount);

    // Update held transaction to refunded
    await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        status: "refunded",
        ApprovedBy: { connect: { id: approverUserId } },
        updatedAt: new Date(),
      },
    });

    // Create refund transaction
    const refundTransaction = await prisma.transaction_history.create({
      data: {
        identifier: "booking_refund",
        amount: refundAmount,
        status: "approved",
        comission: 0,
        fee: 0,
        customerId: transaction.customerId,
        reason: reason || `Refund for booking #${bookingId || "unknown"}`,
      },
    });

    // Update customer wallet: increment totalRefunded
    // Customer wallet fields:
    // - totalBalance: all recharged (unchanged)
    // - totalSpend: all spent (unchanged)
    // - totalRefunded: all refunded (incremented here)
    // - totalAvailable = totalBalance - totalSpend + totalRefunded
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: {
        totalRefunded: {
          increment: refundAmount,
        },
      },
    });

    // Update the booking status to cancelled/disputed if we can find it
    if (bookingId) {
      await prisma.service_booking.updateMany({
        where: { id: bookingId },
        data: {
          paymentStatus: "refunded",
        },
      });
    }

    // Update model's pending transaction to refunded and remove from pending balance
    if (bookingForNotification && bookingForNotification.model && bookingForNotification.status === "confirmed") {
      const commissionRate = bookingForNotification.modelService?.service?.commission || 0;
      const commissionAmount = Math.floor((bookingForNotification.price * commissionRate) / 100);
      const netAmount = bookingForNotification.price - commissionAmount;

      // Update model's pending transaction to refunded
      if (bookingForNotification.releaseTransactionId) {
        await prisma.transaction_history.update({
          where: { id: bookingForNotification.releaseTransactionId },
          data: {
            status: "refunded",
            reason: reason || `Refunded - Admin refunded booking #${bookingId}`,
          },
        });
      }

      // Remove from model's pending balance
      const modelWallet = await prisma.wallet.findFirst({
        where: { modelId: bookingForNotification.model.id, status: "active" },
      });

      if (modelWallet) {
        await prisma.wallet.update({
          where: { id: modelWallet.id },
          data: {
            totalPending: Math.max(0, modelWallet.totalPending - netAmount),
          },
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Held transaction ${transactionId} refunded successfully. Amount: ${refundAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: refundTransaction,
    });

    // Send notifications to customer and model
    try {
      const { notifyAdminBookingRefunded } = await import("./email.server");
      await notifyAdminBookingRefunded({
        bookingId: bookingId || transactionId,
        customerId: transaction.customerId || "",
        modelId: bookingForNotification?.model?.id || "",
        serviceName: bookingForNotification?.modelService?.service?.name || "Service",
        modelName: bookingForNotification?.model
          ? `${bookingForNotification.model.firstName} ${bookingForNotification.model.lastName || ""}`.trim()
          : "Model",
        customerName: transaction.customer
          ? `${transaction.customer.firstName} ${transaction.customer.lastName || ""}`.trim()
          : "Customer",
        refundAmount,
        reason,
      });
    } catch (notificationError) {
      // Don't fail the refund if notification fails
      console.error("Transaction refund notification error (non-fatal):", notificationError);
    }

    return refundTransaction;
  } catch (error) {
    console.error("REFUND_HELD_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Failed to refund held transaction ${transactionId}`,
      status: "failed",
      onError: error,
    });
    throw error;
  }
}

/**
 * Complete a held transaction - release payment to model with commission deduction
 */
export async function completeHeldTransaction(
  transactionId: string,
  approverUserId: string
) {
  if (!transactionId) {
    throw new FieldValidationError({
      id: "Transaction ID is required!",
    });
  }

  const auditBase = {
    action: "COMPLETE_HELD_TRANSACTION",
    user: approverUserId,
  };

  try {
    const transaction = await prisma.transaction_history.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new FieldValidationError({ id: "Transaction not found!" });
    }

    if (transaction.identifier !== "booking_hold") {
      throw new FieldValidationError({
        id: "Only booking hold transactions can be completed!",
      });
    }

    // Extract booking ID from reason
    const bookingIdMatch = transaction.reason?.match(/booking #(.+)/);
    const bookingId = bookingIdMatch?.[1];

    if (!bookingId) {
      throw new FieldValidationError({
        id: "Could not find associated booking!",
      });
    }

    // Get the booking with service commission info
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            referredById: true,
            Wallet: {
              select: { id: true, totalBalance: true, totalWithdraw: true, totalPending: true },
            },
          },
        },
        modelService: {
          select: {
            service: {
              select: {
                name: true,
                commission: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        id: "Associated booking not found!",
      });
    }

    // Check transaction status - allow completion for held OR when booking is confirmed/disputed
    if (transaction.status !== "held") {
      const allowedStatuses = ["confirmed", "disputed"];
      if (!allowedStatuses.includes(booking.status)) {
        throw new FieldValidationError({
          id: "Transaction can only be completed when booking is confirmed or disputed!",
        });
      }
    }

    if (!booking.model) {
      throw new FieldValidationError({
        id: "No model associated with this booking!",
      });
    }

    let modelWallet = booking.model.Wallet?.[0];

    // Auto-create wallet if model doesn't have one
    if (!modelWallet) {
      const newWallet = await prisma.wallet.create({
        data: {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          totalPending: 0,
          status: "active",
          model: { connect: { id: booking.model.id } },
        },
      });
      modelWallet = { id: newWallet.id, totalBalance: 0, totalWithdraw: 0, totalPending: 0 };
    }

    // Get the amount (stored as negative in booking_hold)
    const totalAmount = Math.abs(transaction.amount);
    const commissionRate = booking.modelService?.service?.commission || 0;

    // Calculate commission and net amount
    const commissionAmount = Math.floor((totalAmount * commissionRate) / 100);
    const netAmount = totalAmount - commissionAmount;

    // Update held transaction to released
    await prisma.transaction_history.update({
      where: { id: transactionId },
      data: {
        status: "released",
        ApprovedBy: { connect: { id: approverUserId } },
        updatedAt: new Date(),
      },
    });

    // Update or create earning transaction for model
    let earningTransaction;
    if (booking.releaseTransactionId) {
      // Update the existing pending transaction to approved
      earningTransaction = await prisma.transaction_history.update({
        where: { id: booking.releaseTransactionId },
        data: {
          status: "approved",
          reason: `Earning from booking #${bookingId} (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
        },
      });
    } else {
      // Fallback: Create new transaction if pending one doesn't exist (backwards compatibility)
      earningTransaction = await prisma.transaction_history.create({
        data: {
          identifier: "booking_earning",
          amount: netAmount,
          status: "approved",
          comission: commissionAmount,
          fee: 0,
          modelId: booking.model.id,
          reason: `Earning from booking #${bookingId} (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
        },
      });
    }

    // Update model wallet: add to balance, remove from pending
    // Model wallet fields:
    // - totalBalance: all approved earnings (incremented here)
    // - totalPending: pending earnings (decremented here)
    // - totalWithdraw: total withdrawn (unchanged)
    // - totalAvailable = totalBalance - totalWithdraw (calculated)
    await prisma.wallet.update({
      where: { id: modelWallet.id },
      data: {
        totalBalance: {
          increment: netAmount,
        },
        totalPending: {
          decrement: netAmount,
        },
      },
    });

    // Update booking status
    await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        status: "completed",
        paymentStatus: "released",
        completedAt: new Date(),
        releaseTransactionId: earningTransaction.id,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Held transaction ${transactionId} completed. Total: ${totalAmount.toLocaleString()} LAK, Commission: ${commissionAmount.toLocaleString()} LAK (${commissionRate}%), Model receives: ${netAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: earningTransaction,
    });

    // Process referral commission for the model who referred this booked model (if any)
    let referralCommissionResult = null;
    try {
      const { processBookingReferralCommission } = await import("./referral.server");
      referralCommissionResult = await processBookingReferralCommission(
        booking.model.id,
        totalAmount,
        bookingId
      );
      if (referralCommissionResult.success) {
        console.log(`Transaction referral commission processed: ${referralCommissionResult.commissionAmount} Kip to model ${referralCommissionResult.referrerId}`);
      }
    } catch (commissionError) {
      // Don't fail if commission processing fails
      console.error("Transaction referral commission error (non-fatal):", commissionError);
    }

    // Send notifications to customer, model, and referrer (if applicable)
    try {
      const { notifyAdminBookingCompleted } = await import("./email.server");

      // Get referrer info if applicable
      let referrerInfo = null;
      if (referralCommissionResult?.success && referralCommissionResult.referrerId) {
        const referrer = await prisma.model.findUnique({
          where: { id: referralCommissionResult.referrerId },
          select: {
            id: true,
            firstName: true,
            whatsapp: true,
          },
        });
        if (referrer) {
          referrerInfo = {
            id: referrer.id,
            firstName: referrer.firstName,
            whatsapp: referrer.whatsapp,
            commissionAmount: referralCommissionResult.commissionAmount,
          };
        }
      }

      await notifyAdminBookingCompleted({
        bookingId,
        customerId: booking.customerId || "",
        modelId: booking.model.id,
        serviceName: booking.modelService?.service?.name || "Service",
        modelName: `${booking.model.firstName} ${booking.model.lastName || ""}`.trim(),
        customerName: booking.customer ? `${booking.customer.firstName} ${booking.customer.lastName || ""}`.trim() : "Customer",
        totalAmount,
        commissionAmount,
        netAmount,
        referrer: referrerInfo,
      });
    } catch (notificationError) {
      // Don't fail if notification fails
      console.error("Transaction complete notification error (non-fatal):", notificationError);
    }

    return { earningTransaction, commissionAmount, netAmount, commissionRate };
  } catch (error) {
    console.error("COMPLETE_HELD_TRANSACTION_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Failed to complete held transaction ${transactionId}`,
      status: "failed",
      onError: error,
    });
    throw error;
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
  const isWithdraw =
    type === "withdraw" || type === "withdrawal" || type === "deposit";

  if (isRecharge) {
    // Customer recharge: increment totalBalance (total amount recharged)
    return await prisma.wallet.update({
      where: { id: walletId },
      data: {
        totalBalance: {
          increment: amount,
        },
        // Keep deprecated field for backwards compatibility
        totalRecharge: {
          increment: amount,
        },
      },
    });
  } else if (isWithdraw) {
    // Model withdrawal: increment totalWithdraw (NOT decrement totalBalance)
    // totalBalance = total earnings (never decreases)
    // totalWithdraw = total withdrawn amount
    // Available balance = totalBalance - totalWithdraw
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      select: {
        totalBalance: true,
        totalWithdraw: true,
      },
    });

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    // Check available balance (totalBalance - totalWithdraw)
    const availableBalance = (wallet.totalBalance || 0) - (wallet.totalWithdraw || 0);
    if (availableBalance < amount) {
      throw new Error("Insufficient wallet balance.");
    }

    return await prisma.wallet.update({
      where: { id: walletId },
      data: {
        // Increment totalWithdraw (track total withdrawn)
        totalWithdraw: {
          increment: amount,
        },
      },
    });
  } else {
    throw new Error(`Unknown transaction type: ${type}`);
  }
}

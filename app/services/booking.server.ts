import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";

export interface BookingFilters {
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  disputed: number;
}

// Calculate age from date of birth
function calculateAge(dob: Date | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export async function getBookings(options: BookingFilters = {}) {
  try {
    const {
      search = "",
      status = "all",
      fromDate = "",
      toDate = "",
      page = 1,
      limit = 10,
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Status filter
    if (status && status !== "all") {
      where.status = status;
    }

    // Date range filter
    if (fromDate || toDate) {
      where.startDate = {};
      if (fromDate) {
        where.startDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.startDate.lte = new Date(toDate + "T23:59:59.999Z");
      }
    }

    // Search by customer or model name (temporarily simplified)
    // if (search) {
    //   where.OR = [
    //     { customer: { firstName: { contains: search, mode: "insensitive" } } },
    //     { customer: { lastName: { contains: search, mode: "insensitive" } } },
    //     { model: { firstName: { contains: search, mode: "insensitive" } } },
    //     { model: { lastName: { contains: search, mode: "insensitive" } } },
    //   ];
    // }

    const [bookings, totalCount] = await Promise.all([
      prisma.service_booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          price: true,
          // dayAmount: true, // Can be null in DB despite schema saying Int
          hours: true,
          sessionType: true,
          location: true,
          preferredAttire: true,
          startDate: true,
          endDate: true,
          status: true,
          paymentStatus: true,
          customerCheckedInAt: true,
          modelCheckedInAt: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              dob: true,
              gender: true,
            },
          },
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              dob: true,
              gender: true,
            },
          },
          modelService: {
            select: {
              id: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  commission: true,
                  billingType: true,
                },
              },
            },
          },
        },
      }),
      prisma.service_booking.count({ where }),
    ]);

    // Transform bookings to include calculated age
    const transformedBookings = bookings.map((booking) => ({
      ...booking,
      customer: booking.customer
        ? {
            ...booking.customer,
            age: calculateAge(booking.customer.dob),
          }
        : null,
      model: booking.model
        ? {
            ...booking.model,
            age: calculateAge(booking.model.dob),
          }
        : null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      bookings: transformedBookings,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  } catch (error) {
    console.error("GET_BOOKINGS_ERROR:", error);
    throw error;
  }
}

export async function getBookingStats(): Promise<BookingStats> {
  const [total, pending, confirmed, completed, cancelled, disputed] =
    await Promise.all([
      prisma.service_booking.count(),
      prisma.service_booking.count({ where: { status: "pending" } }),
      prisma.service_booking.count({ where: { status: "confirmed" } }),
      prisma.service_booking.count({ where: { status: "completed" } }),
      prisma.service_booking.count({ where: { status: "cancelled" } }),
      prisma.service_booking.count({ where: { status: "disputed" } }),
    ]);

  return { total, pending, confirmed, completed, cancelled, disputed };
}

export async function getBookingById(id: string) {
  const booking = await prisma.service_booking.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          dob: true,
          gender: true,
          whatsapp: true,
          Wallet: { select: { id: true, totalBalance: true } },
        },
      },
      model: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profile: true,
          dob: true,
          gender: true,
          whatsapp: true,
          Wallet: { select: { id: true, totalBalance: true, totalDeposit: true } },
        },
      },
      modelService: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              description: true,
              commission: true,
              billingType: true,
              baseRate: true,
              hourlyRate: true,
              oneTimePrice: true,
              oneNightPrice: true,
            },
          },
        },
      },
    },
  });

  if (!booking) return null;

  return {
    ...booking,
    customer: booking.customer
      ? {
          ...booking.customer,
          age: calculateAge(booking.customer.dob),
        }
      : null,
    model: booking.model
      ? {
          ...booking.model,
          age: calculateAge(booking.model.dob),
        }
      : null,
  };
}

/**
 * Refund a booking - return funds to customer
 */
export async function refundBooking(
  bookingId: string,
  approverUserId: string,
  reason?: string
) {
  if (!bookingId) {
    throw new FieldValidationError({ id: "Booking ID is required!" });
  }

  const auditBase = {
    action: "REFUND_BOOKING",
    user: approverUserId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            Wallet: { select: { id: true, totalBalance: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({ id: "Booking not found!" });
    }

    if (!booking.customer) {
      throw new FieldValidationError({ id: "No customer associated with this booking!" });
    }

    const customerWallet = booking.customer.Wallet?.[0];
    if (!customerWallet) {
      throw new FieldValidationError({ id: "Customer wallet not found!" });
    }

    const refundAmount = booking.price;

    // If there's a held transaction, update it
    if (booking.holdTransactionId) {
      await prisma.transaction_history.update({
        where: { id: booking.holdTransactionId },
        data: {
          status: "refunded",
          ApprovedBy: { connect: { id: approverUserId } },
          updatedAt: new Date(),
        },
      });
    }

    // Create refund transaction
    const refundTransaction = await prisma.transaction_history.create({
      data: {
        identifier: "booking_refund",
        amount: refundAmount,
        status: "approved",
        comission: 0,
        fee: 0,
        customerId: booking.customerId,
        reason: reason || `Refund for booking #${bookingId}`,
      },
    });

    // Update customer wallet
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: {
        totalBalance: customerWallet.totalBalance + refundAmount,
      },
    });

    // Update booking status
    await prisma.service_booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
        paymentStatus: "refunded",
        disputeResolution: "refunded",
        disputeResolvedAt: new Date(),
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Booking ${bookingId} refunded. Amount: ${refundAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: refundTransaction,
    });

    return refundTransaction;
  } catch (error) {
    console.error("REFUND_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Failed to refund booking ${bookingId}`,
      status: "failed",
      onError: error,
    });
    throw error;
  }
}

/**
 * Complete a booking - release payment to model with commission deduction
 */
export async function completeBooking(
  bookingId: string,
  approverUserId: string
) {
  if (!bookingId) {
    throw new FieldValidationError({ id: "Booking ID is required!" });
  }

  const auditBase = {
    action: "COMPLETE_BOOKING",
    user: approverUserId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      include: {
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            Wallet: { select: { id: true, totalBalance: true, totalDeposit: true } },
          },
        },
        modelService: {
          select: {
            service: {
              select: {
                commission: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({ id: "Booking not found!" });
    }

    if (!booking.model) {
      throw new FieldValidationError({ id: "No model associated with this booking!" });
    }

    let modelWallet = booking.model.Wallet?.[0];

    // Auto-create wallet if model doesn't have one
    if (!modelWallet) {
      const newWallet = await prisma.wallet.create({
        data: {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          status: "active",
          model: { connect: { id: booking.model.id } },
        },
      });
      modelWallet = { id: newWallet.id, totalBalance: 0, totalDeposit: 0 };
    }

    const totalAmount = booking.price;
    const commissionRate = booking.modelService?.service?.commission || 0;
    const commissionAmount = Math.floor((totalAmount * commissionRate) / 100);
    const netAmount = totalAmount - commissionAmount;

    // If there's a held transaction, update it
    if (booking.holdTransactionId) {
      await prisma.transaction_history.update({
        where: { id: booking.holdTransactionId },
        data: {
          status: "released",
          ApprovedBy: { connect: { id: approverUserId } },
          updatedAt: new Date(),
        },
      });
    }

    // Create earning transaction for model
    const earningTransaction = await prisma.transaction_history.create({
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

    // Update model wallet
    await prisma.wallet.update({
      where: { id: modelWallet.id },
      data: {
        totalBalance: modelWallet.totalBalance + netAmount,
        totalDeposit: modelWallet.totalDeposit + netAmount,
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
        disputeResolution: "released",
        disputeResolvedAt: booking.disputedAt ? new Date() : undefined,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Booking ${bookingId} completed. Total: ${totalAmount.toLocaleString()} LAK, Commission: ${commissionAmount.toLocaleString()} LAK (${commissionRate}%), Model receives: ${netAmount.toLocaleString()} LAK`,
      status: "success",
      onSuccess: earningTransaction,
    });

    return { earningTransaction, commissionAmount, netAmount, commissionRate };
  } catch (error) {
    console.error("COMPLETE_BOOKING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Failed to complete booking ${bookingId}`,
      status: "failed",
      onError: error,
    });
    throw error;
  }
}

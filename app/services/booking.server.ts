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
          customerHidden: true,
          modelHidden: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: true,
              dob: true,
              gender: true,
              whatsapp: true,
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
          referredById: true,
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
        model: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            Wallet: { select: { id: true, totalPending: true } },
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

    // If booking was confirmed (model has pending transaction), update it to refunded
    if (booking.status === "confirmed" && booking.releaseTransactionId) {
      await prisma.transaction_history.update({
        where: { id: booking.releaseTransactionId },
        data: {
          status: "refunded",
          reason: reason || `Refunded - Admin refunded booking #${bookingId}`,
        },
      });

      // Remove from model's pending balance
      const modelWallet = booking.model?.Wallet?.[0];
      if (modelWallet && booking.model) {
        const commissionRate = booking.modelService?.service?.commission || 0;
        const commissionAmount = Math.floor((booking.price * commissionRate) / 100);
        const netAmount = booking.price - commissionAmount;

        await prisma.wallet.update({
          where: { id: modelWallet.id },
          data: {
            totalPending: Math.max(0, (modelWallet.totalPending || 0) - netAmount),
          },
        });
      }
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

    // Update customer wallet: increment totalRefunded
    // Customer wallet fields:
    // - totalBalance: all recharged amount (unchanged)
    // - totalSpend: all spent amount (unchanged)
    // - totalRefunded: all refunded amount (incremented here)
    // - totalAvailable = totalBalance - totalSpend + totalRefunded (calculated)
    await prisma.wallet.update({
      where: { id: customerWallet.id },
      data: {
        totalRefunded: {
          increment: refundAmount,
        },
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

    // Send notifications to customer and model
    try {
      const { notifyAdminBookingRefunded } = await import("./email.server");
      await notifyAdminBookingRefunded({
        bookingId,
        customerId: booking.customerId || "",
        modelId: booking.modelId || "",
        serviceName: booking.modelService?.service?.name || "Service",
        modelName: booking.model ? `${booking.model.firstName} ${booking.model.lastName || ""}`.trim() : "Model",
        customerName: `${booking.customer.firstName} ${booking.customer.lastName || ""}`.trim(),
        refundAmount,
        reason,
      });
    } catch (notificationError) {
      // Don't fail the refund if notification fails
      console.error("Booking refund notification error (non-fatal):", notificationError);
    }

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
            Wallet: { select: { id: true, totalBalance: true, totalDeposit: true, totalPending: true } },
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
          totalPending: 0,
          status: "active",
          model: { connect: { id: booking.model.id } },
        },
      });
      modelWallet = { id: newWallet.id, totalBalance: 0, totalDeposit: 0, totalPending: 0 };
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

    // Process referral commission for the model who referred this booked model (if any)
    // Special models get 2%, Partner models get 4% of the booking price
    let referralCommissionResult = null;
    try {
      const { processBookingReferralCommission } = await import("./referral.server");
      referralCommissionResult = await processBookingReferralCommission(
        booking.model.id,
        totalAmount,
        bookingId
      );
      if (referralCommissionResult.success) {
        console.log(`Booking referral commission processed: ${referralCommissionResult.commissionAmount} Kip to model ${referralCommissionResult.referrerId}`);
      }
    } catch (commissionError) {
      // Don't fail the booking completion if commission processing fails
      console.error("Booking referral commission error (non-fatal):", commissionError);
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
      // Don't fail the booking completion if notification fails
      console.error("Booking complete notification error (non-fatal):", notificationError);
    }

    return {
      earningTransaction,
      commissionAmount,
      netAmount,
      commissionRate,
      referralCommission: referralCommissionResult?.success ? referralCommissionResult.commissionAmount : 0,
    };
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

/**
 * Admin resolves a disputed booking
 * Admin decides to either release payment to model or refund to customer
 */
export async function adminResolveDispute(
  bookingId: string,
  adminId: string,
  resolution: "released" | "refunded"
) {
  if (!bookingId) throw new Error("Missing booking id!");
  if (!adminId) throw new Error("Missing admin id!");
  if (!resolution || (resolution !== "released" && resolution !== "refunded")) {
    throw new Error("Invalid resolution! Must be 'released' or 'refunded'");
  }

  const auditBase = {
    action: "ADMIN_RESOLVE_DISPUTE",
    user: adminId,
  };

  try {
    const booking = await prisma.service_booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        price: true,
        modelId: true,
        customerId: true,
        holdTransactionId: true,
        releaseTransactionId: true,
        modelService: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!booking) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The booking does not exist!",
      });
    }

    if (booking.status !== "disputed") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Only disputed bookings can be resolved!",
      });
    }

    if (!booking.modelId || !booking.customerId) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Booking missing model or customer information!",
      });
    }

    if (resolution === "released") {
      // RELEASE to model: Move from pending to available
      const modelWallet = await prisma.wallet.findFirst({
        where: { modelId: booking.modelId, status: "active" },
      });

      if (!modelWallet) {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: "Model wallet not found!",
        });
      }

      // Calculate net amount (after commission)
      const commissionRate = booking.modelService?.service?.commission || 0;
      const commissionAmount = Math.floor((booking.price * commissionRate) / 100);
      const netAmount = booking.price - commissionAmount;

      // Update or create earning transaction
      let earningTransaction;
      if (booking.releaseTransactionId) {
        // Update the existing pending transaction to approved
        earningTransaction = await prisma.transaction_history.update({
          where: { id: booking.releaseTransactionId },
          data: {
            status: "approved",
            reason: `Earning from disputed booking #${booking.id} resolved by admin (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
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
            modelId: booking.modelId,
            reason: `Earning from disputed booking #${booking.id} resolved by admin (${commissionRate}% commission: ${commissionAmount.toLocaleString()} LAK)`,
          },
        });
      }

      // Update hold transaction status to released
      if (booking.holdTransactionId) {
        await prisma.transaction_history.update({
          where: { id: booking.holdTransactionId },
          data: { status: "released" },
        });
      }

      // Move from pending to available: decrease pending, increase balance
      // Model wallet fields:
      // - totalBalance: all approved earnings (incremented here)
      // - totalPending: pending earnings (decremented here)
      // - totalAvailable = totalBalance - totalWithdraw (calculated)
      await prisma.wallet.update({
        where: { id: modelWallet.id },
        data: {
          totalPending: {
            decrement: netAmount,
          },
          totalBalance: {
            increment: netAmount,
          },
        },
      });

      // Update booking to completed
      await prisma.service_booking.update({
        where: { id: bookingId },
        data: {
          status: "completed",
          paymentStatus: "released",
          completedAt: new Date(),
          disputeResolvedAt: new Date(),
          disputeResolution: "released",
          releaseTransactionId: earningTransaction.id,
        },
      });

      await createAuditLogs({
        ...auditBase,
        description: `Admin resolved dispute for booking ${bookingId} - Released ${netAmount.toLocaleString()} LAK to model. Commission: ${commissionAmount.toLocaleString()} LAK.`,
        status: "success",
        onSuccess: { booking, transaction: earningTransaction },
      });
    } else {
      // REFUND to customer
      const customerWallet = await prisma.wallet.findFirst({
        where: { customerId: booking.customerId, status: "active" },
      });

      if (!customerWallet) {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: "Customer wallet not found!",
        });
      }

      // Refund held payment
      if (booking.holdTransactionId) {
        await prisma.transaction_history.update({
          where: { id: booking.holdTransactionId },
          data: { status: "refunded" },
        });

        const refundTransaction = await prisma.transaction_history.create({
          data: {
            identifier: "booking_refund",
            amount: booking.price,
            status: "approved",
            comission: 0,
            fee: 0,
            customerId: booking.customerId,
            reason: `Refund for booking #${booking.id}: Admin resolved dispute in favor of customer`,
          },
        });

        // Update customer wallet: increment totalRefunded
        await prisma.wallet.update({
          where: { id: customerWallet.id },
          data: {
            totalRefunded: {
              increment: booking.price,
            },
          },
        });
      }

      // Get model wallet and remove from pending balance
      const modelWallet = await prisma.wallet.findFirst({
        where: { modelId: booking.modelId, status: "active" },
      });

      const commissionRate = booking.modelService?.service?.commission || 0;
      const commissionAmount = Math.floor((booking.price * commissionRate) / 100);
      const netAmount = booking.price - commissionAmount;

      // Update model's pending transaction to refunded
      if (booking.releaseTransactionId) {
        await prisma.transaction_history.update({
          where: { id: booking.releaseTransactionId },
          data: {
            status: "refunded",
            reason: `Refunded - Admin resolved dispute for booking #${booking.id} in favor of customer`,
          },
        });
      }

      if (modelWallet) {
        // Remove from pending balance
        await prisma.wallet.update({
          where: { id: modelWallet.id },
          data: {
            totalPending: Math.max(0, modelWallet.totalPending - netAmount),
          },
        });
      }

      // Update booking to cancelled with refund
      await prisma.service_booking.update({
        where: { id: bookingId },
        data: {
          status: "cancelled",
          paymentStatus: "refunded",
          disputeResolvedAt: new Date(),
          disputeResolution: "refunded",
        },
      });

      await createAuditLogs({
        ...auditBase,
        description: `Admin resolved dispute for booking ${bookingId} - Refunded ${booking.price.toLocaleString()} LAK to customer.`,
        status: "success",
        onSuccess: booking,
      });
    }

    return { success: true, resolution };
  } catch (error) {
    console.error("ADMIN_RESOLVE_DISPUTE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Admin resolve dispute failed!`,
      status: "failed",
      onError: error,
    });

    if (error instanceof FieldValidationError) {
      throw error;
    }

    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to resolve dispute!",
    });
  }
}

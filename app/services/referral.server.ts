import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { notifyReferralBonusReceived, notifyReferralTracked, notifyBookingCommissionEarned } from "./email.server";

// Referral reward amount in Kip (for normal model type only)
export const REFERRAL_REWARD_AMOUNT = 50000;

// Minimum referred models required for commission eligibility
// Local: 2, Production: 20
export const MIN_REFERRED_MODELS_FOR_COMMISSION = parseInt(
  process.env.MIN_REFERRED_MODELS_FOR_COMMISSION || "2",
  10
);

// Minimum earnings required for partner-level commission
// Local: 10,000 Kip, Production: 1,000,000 Kip
export const MIN_EARNINGS_FOR_PARTNER_COMMISSION = parseInt(
  process.env.MIN_EARNINGS_FOR_PARTNER_COMMISSION || "10000",
  10
);

// Commission rates for booking referrals
export const BOOKING_COMMISSION_RATE_SPECIAL = 0.02; // 2% for special
export const BOOKING_COMMISSION_RATE_PARTNER = 0.04; // 4% for partner

/**
 * Generate a unique referral code for a model
 * Format: XSR + last 6 characters of model ID (uppercase)
 */
export function generateReferralCode(modelId: string): string {
  const suffix = modelId.slice(-6).toUpperCase();
  return `XSR${suffix}`;
}

/**
 * Ensure a model has a referral code (generate if missing)
 * Call this when a model is approved
 */
export async function ensureReferralCode(modelId: string): Promise<string> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: { id: true, referralCode: true },
  });

  if (!model) {
    throw new Error("Model not found");
  }

  if (model.referralCode) {
    return model.referralCode;
  }

  // Generate and save referral code
  const referralCode = generateReferralCode(modelId);

  await prisma.model.update({
    where: { id: modelId },
    data: { referralCode },
  });

  return referralCode;
}

/**
 * Process referral reward when a referred model is approved
 * This should be called when admin approves a model
 *
 * - Normal models: Get 50,000 Kip flat bonus per referral
 * - Special/Partner models who are commission-eligible: NO flat bonus, but earn % from bookings
 * - Special/Partner models who are NOT yet commission-eligible: Get 50,000 Kip flat bonus
 */
export async function processReferralReward(approvedModelId: string, adminUserId: string) {
  console.log(`[Referral] processReferralReward called for model ${approvedModelId} by admin ${adminUserId}`);
  const auditBase = {
    action: "PROCESS_REFERRAL_REWARD",
    user: adminUserId,
  };

  try {
    // Get the approved model with referral info
    const approvedModel = await prisma.model.findUnique({
      where: { id: approvedModelId },
      select: {
        id: true,
        firstName: true,
        referredById: true,
        referralRewardPaid: true,
        status: true,
      },
    });

    if (!approvedModel) {
      console.log(`Referral reward skipped: Model ${approvedModelId} not found`);
      return { success: false, reason: "Model not found" };
    }

    // Check if model was referred
    if (!approvedModel.referredById) {
      console.log(`Referral reward skipped: Model ${approvedModelId} has no referrer`);
      return { success: false, reason: "No referrer" };
    }

    // Check if reward was already paid/processed
    if (approvedModel.referralRewardPaid) {
      console.log(`Referral reward skipped: Reward already processed for ${approvedModelId}`);
      return { success: false, reason: "Reward already processed" };
    }

    // Get the referrer with their details for notifications
    const referrer = await prisma.model.findUnique({
      where: { id: approvedModel.referredById },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        type: true,
        whatsapp: true,
        totalReferredModels: true,
        totalReferralEarnings: true,
      },
    });

    if (!referrer) {
      console.log(`Referral reward skipped: Referrer ${approvedModel.referredById} not found`);
      return { success: false, reason: "Referrer not found" };
    }

    console.log(`[Referral] Found referrer: ${referrer.id}, type: ${referrer.type}, whatsapp: ${referrer.whatsapp}, totalReferredModels: ${referrer.totalReferredModels}`);

    const referrerName = `${referrer.firstName} ${referrer.lastName || ""}`.trim();
    const referredModelName = approvedModel.firstName;

    // Increment the referrer's total referred models count
    const newTotalReferred = (referrer.totalReferredModels || 0) + 1;
    await prisma.model.update({
      where: { id: referrer.id },
      data: { totalReferredModels: newTotalReferred },
    });

    // Check if referrer is commission-eligible (special/partner with minimum referrals)
    // After incrementing, check if they now meet commission eligibility
    const isSpecialOrPartner = referrer.type === "special" || referrer.type === "partner";
    const meetsMinReferrals = newTotalReferred >= MIN_REFERRED_MODELS_FOR_COMMISSION;
    const meetsPartnerEarnings = referrer.type !== "partner" ||
      (referrer.totalReferralEarnings || 0) >= MIN_EARNINGS_FOR_PARTNER_COMMISSION;
    const isCommissionEligible = isSpecialOrPartner && meetsMinReferrals && meetsPartnerEarnings;

    if (isCommissionEligible) {
      // Commission-eligible referrer: NO flat bonus, they earn % from bookings
      // Just mark as processed and send notification about referral tracked
      await prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true }, // Mark as processed (no bonus paid)
      });

      await createAuditLogs({
        ...auditBase,
        description: `Referral tracked for commission-eligible ${referrer.type} model ${referrer.id}. No flat bonus paid (earns booking commission instead).`,
        status: "success",
        onSuccess: {
          referrerId: referrer.id,
          referrerType: referrer.type,
          referredId: approvedModelId,
          totalReferred: newTotalReferred,
          bonusPaid: false,
          reason: "Commission-eligible: earns % from bookings",
        },
      });

      // Send notification about referral tracked (not bonus)
      console.log(`[Referral] Calling notifyReferralTracked for commission-eligible referrer ${referrer.id}`);
      try {
        await notifyReferralTracked({
          referrerId: referrer.id,
          referrerName,
          referrerWhatsapp: referrer.whatsapp,
          referredModelName,
          referrerType: referrer.type,
          totalReferred: newTotalReferred,
        });
        console.log(`[Referral] notifyReferralTracked completed successfully`);
      } catch (notifyError) {
        console.error(`[Referral] notifyReferralTracked failed:`, notifyError);
      }

      console.log(`Referral tracked for ${referrer.type} model ${referrer.id}. No bonus paid (commission-eligible).`);

      return {
        success: true,
        referrerId: referrer.id,
        amount: 0, // No bonus paid
        bonusPaid: false,
        reason: "Commission-eligible",
      };
    }

    // NOT commission-eligible: Pay 50,000 Kip flat bonus
    // Get the referrer's wallet
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: approvedModel.referredById,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`Referral reward skipped: Referrer ${approvedModel.referredById} has no wallet`);
      await createAuditLogs({
        ...auditBase,
        description: `Referral reward failed: Referrer ${approvedModel.referredById} has no active wallet`,
        status: "failed",
        onError: { reason: "Referrer wallet not found" },
      });
      return { success: false, reason: "Referrer wallet not found" };
    }

    // Update wallet balance and create transaction in a transaction
    const [updatedWallet, transaction, updatedModel, updatedReferrer] = await prisma.$transaction([
      // Add reward to referrer's wallet
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + REFERRAL_REWARD_AMOUNT,
          totalRecharge: referrerWallet.totalRecharge + REFERRAL_REWARD_AMOUNT,
        },
      }),
      // Create transaction record
      prisma.transaction_history.create({
        data: {
          identifier: "referral",
          amount: REFERRAL_REWARD_AMOUNT,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: approvedModel.referredById,
          reason: `Referral reward for inviting ${approvedModel.firstName} (ID: ${approvedModelId})`,
        },
      }),
      // Mark reward as paid
      prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true },
      }),
      // Update referrer's total referral earnings (for partner commission eligibility)
      prisma.model.update({
        where: { id: referrer.id },
        data: {
          totalReferralEarnings: (referrer.totalReferralEarnings || 0) + REFERRAL_REWARD_AMOUNT,
        },
      }),
    ]);

    await createAuditLogs({
      ...auditBase,
      description: `Referral reward of ${REFERRAL_REWARD_AMOUNT} Kip paid to model ${approvedModel.referredById} for referring ${approvedModelId}`,
      status: "success",
      onSuccess: {
        referrerId: approvedModel.referredById,
        referredId: approvedModelId,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
        newBalance: updatedWallet.totalBalance,
      },
    });

    console.log(`Referral reward paid: ${REFERRAL_REWARD_AMOUNT} Kip to model ${approvedModel.referredById}`);

    // Send notification about bonus received
    console.log(`[Referral] Calling notifyReferralBonusReceived for referrer ${referrer.id}, whatsapp: ${referrer.whatsapp}`);
    try {
      await notifyReferralBonusReceived({
        referrerId: referrer.id,
        referrerName,
        referrerWhatsapp: referrer.whatsapp,
        referredModelName,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
      });
      console.log(`[Referral] notifyReferralBonusReceived completed successfully`);
    } catch (notifyError) {
      console.error(`[Referral] notifyReferralBonusReceived failed:`, notifyError);
    }

    return {
      success: true,
      referrerId: approvedModel.referredById,
      amount: REFERRAL_REWARD_AMOUNT,
      transactionId: transaction.id,
      bonusPaid: true,
    };
  } catch (error) {
    console.error("Error processing referral reward:", error);
    await createAuditLogs({
      ...auditBase,
      description: `Referral reward processing failed for model ${approvedModelId}`,
      status: "failed",
      onError: error,
    });
    return { success: false, reason: "Processing error", error };
  }
}

/**
 * Check if a model meets commission eligibility conditions
 */
export async function checkCommissionEligibility(modelId: string): Promise<{
  eligible: boolean;
  reason?: string;
  modelType: string;
  totalReferredModels: number;
  totalReferralEarnings: number;
}> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      type: true,
      totalReferredModels: true,
      totalReferralEarnings: true,
    },
  });

  if (!model) {
    return {
      eligible: false,
      reason: "Model not found",
      modelType: "normal",
      totalReferredModels: 0,
      totalReferralEarnings: 0,
    };
  }

  // Normal models don't earn percentage commissions (only flat 50K bonus)
  if (model.type === "normal") {
    return {
      eligible: false,
      reason: "Normal models earn flat bonus only",
      modelType: model.type,
      totalReferredModels: model.totalReferredModels || 0,
      totalReferralEarnings: model.totalReferralEarnings || 0,
    };
  }

  // Check minimum referral count
  if ((model.totalReferredModels || 0) < MIN_REFERRED_MODELS_FOR_COMMISSION) {
    return {
      eligible: false,
      reason: `Need ${MIN_REFERRED_MODELS_FOR_COMMISSION} referred models (current: ${model.totalReferredModels || 0})`,
      modelType: model.type,
      totalReferredModels: model.totalReferredModels || 0,
      totalReferralEarnings: model.totalReferralEarnings || 0,
    };
  }

  // For partner, also check minimum earnings
  if (model.type === "partner" && (model.totalReferralEarnings || 0) < MIN_EARNINGS_FOR_PARTNER_COMMISSION) {
    return {
      eligible: false,
      reason: `Partner needs ${MIN_EARNINGS_FOR_PARTNER_COMMISSION.toLocaleString()} Kip earnings (current: ${(model.totalReferralEarnings || 0).toLocaleString()})`,
      modelType: model.type,
      totalReferredModels: model.totalReferredModels || 0,
      totalReferralEarnings: model.totalReferralEarnings || 0,
    };
  }

  return {
    eligible: true,
    modelType: model.type,
    totalReferredModels: model.totalReferredModels || 0,
    totalReferralEarnings: model.totalReferralEarnings || 0,
  };
}

/**
 * Process booking commission for a model who referred the booked model
 * Called when a booking is completed and payment is released
 *
 * @param bookedModelId - The model who was booked
 * @param bookingPrice - The total booking price
 * @param bookingId - The booking ID for reference
 * @returns Commission processing result
 */
export async function processBookingReferralCommission(
  bookedModelId: string,
  bookingPrice: number,
  bookingId: string
) {
  const auditBase = {
    action: "BOOKING_REFERRAL_COMMISSION",
    model: bookedModelId,
  };

  try {
    // Get the booked model with their referrer info
    const bookedModel = await prisma.model.findUnique({
      where: { id: bookedModelId },
      select: {
        id: true,
        firstName: true,
        referredById: true,
      },
    });

    if (!bookedModel || !bookedModel.referredById) {
      // Model was not referred by another model
      return { success: false, reason: "No referrer", adjustedSystemRate: null };
    }

    // Check if referrer is eligible for commission
    const eligibility = await checkCommissionEligibility(bookedModel.referredById);

    if (!eligibility.eligible) {
      console.log(`Booking commission skipped: ${eligibility.reason}`);
      return { success: false, reason: eligibility.reason, adjustedSystemRate: null };
    }

    // Get the referrer model
    const referrer = await prisma.model.findUnique({
      where: { id: bookedModel.referredById },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        type: true,
        whatsapp: true,
        totalReferralEarnings: true,
      },
    });

    if (!referrer || (referrer.type !== "special" && referrer.type !== "partner")) {
      return { success: false, reason: "Referrer not eligible for booking commission", adjustedSystemRate: null };
    }

    // Calculate commission based on model type
    const commissionRate = referrer.type === "partner"
      ? BOOKING_COMMISSION_RATE_PARTNER
      : BOOKING_COMMISSION_RATE_SPECIAL;

    const commissionAmount = Math.floor(bookingPrice * commissionRate);

    // Calculate adjusted system rate (10% total - referrer share)
    const adjustedSystemRate = referrer.type === "partner" ? 6 : 8; // Partner: 6%, Special: 8%

    if (commissionAmount <= 0) {
      return { success: false, reason: "Commission amount is zero", adjustedSystemRate };
    }

    // Get the referrer's wallet
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: referrer.id,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`Booking commission skipped: Referrer ${referrer.id} has no wallet`);
      return { success: false, reason: "Referrer wallet not found", adjustedSystemRate };
    }

    // Process commission payment in a transaction
    const [updatedWallet, transaction] = await prisma.$transaction([
      // Add commission to referrer's wallet (totalBalance = all approved earnings)
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + commissionAmount,
        },
      }),
      // Create transaction record
      prisma.transaction_history.create({
        data: {
          identifier: "booking_referral",
          amount: commissionAmount,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: referrer.id,
          reason: `${commissionRate * 100}% commission from ${bookedModel.firstName}'s booking #${bookingId} (${bookingPrice.toLocaleString()} Kip)`,
        },
      }),
    ]);

    // Update referrer's total referral earnings (for partner condition tracking)
    await prisma.model.update({
      where: { id: referrer.id },
      data: {
        totalReferralEarnings: (referrer.totalReferralEarnings || 0) + commissionAmount,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Booking commission of ${commissionAmount.toLocaleString()} Kip (${commissionRate * 100}%) paid to ${referrer.type} model ${referrer.id} for ${bookedModel.firstName}'s booking #${bookingId}`,
      status: "success",
      onSuccess: {
        referrerId: referrer.id,
        referrerType: referrer.type,
        bookedModelId: bookedModel.id,
        bookingId,
        bookingPrice,
        commissionRate,
        commissionAmount,
        adjustedSystemRate,
        transactionId: transaction.id,
      },
    });

    console.log(`Booking commission paid: ${commissionAmount.toLocaleString()} Kip to ${referrer.type} model ${referrer.id}`);

    // Send notification to referrer about commission earned
    const referrerName = `${referrer.firstName} ${referrer.lastName || ""}`.trim();
    console.log(`[Referral] Calling notifyBookingCommissionEarned for referrer ${referrer.id}`);
    try {
      await notifyBookingCommissionEarned({
        referrerId: referrer.id,
        referrerName,
        referrerWhatsapp: referrer.whatsapp,
        bookedModelName: bookedModel.firstName,
        bookingId,
        bookingPrice,
        commissionAmount,
        commissionRate,
        transactionId: transaction.id,
      });
      console.log(`[Referral] notifyBookingCommissionEarned completed successfully`);
    } catch (notifyError) {
      console.error(`[Referral] notifyBookingCommissionEarned failed:`, notifyError);
    }

    return {
      success: true,
      referrerId: referrer.id,
      commissionAmount,
      commissionRate,
      adjustedSystemRate,
      transactionId: transaction.id,
    };
  } catch (error) {
    console.error("Error processing booking referral commission:", error);
    await createAuditLogs({
      ...auditBase,
      description: `Booking referral commission processing failed for model ${bookedModelId}`,
      status: "failed",
      onError: error,
    });
    return { success: false, reason: "Processing error", error, adjustedSystemRate: null };
  }
}

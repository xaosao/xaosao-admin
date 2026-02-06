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
 * Logic:
 * - Count <= threshold: Pay 50K AND upgrade to special if count >= threshold
 * - Count > threshold: No 50K (referrer should already be special/partner)
 * - Special/Partner referrers: No 50K (they earn commission instead)
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
      console.log(`[Referral] Skipped: Model ${approvedModelId} not found`);
      return { success: false, reason: "Model not found" };
    }

    // Check if model was referred
    if (!approvedModel.referredById) {
      console.log(`[Referral] Skipped: Model ${approvedModelId} has no referrer`);
      return { success: false, reason: "No referrer" };
    }

    // Check if reward was already paid/processed
    if (approvedModel.referralRewardPaid) {
      console.log(`[Referral] Skipped: Reward already processed for ${approvedModelId}`);
      return { success: false, reason: "Reward already processed" };
    }

    // Get the referrer with their details
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
      console.log(`[Referral] Skipped: Referrer ${approvedModel.referredById} not found`);
      return { success: false, reason: "Referrer not found" };
    }

    // Count ACTUAL active referred models from database (more accurate than cached field)
    const actualReferredCount = await prisma.model.count({
      where: {
        referredById: referrer.id,
        status: "active",
      },
    });

    const newTotalReferred = actualReferredCount;

    // Log important values for debugging
    console.log(`[Referral] Processing referral for model ${approvedModelId}`);
    console.log(`[Referral] Referrer: ${referrer.id}, Type: ${referrer.type}`);
    console.log(`[Referral] Actual referred count: ${newTotalReferred}, Threshold: ${MIN_REFERRED_MODELS_FOR_COMMISSION}`);

    // Update the cached field to match actual count
    await prisma.model.update({
      where: { id: referrer.id },
      data: { totalReferredModels: newTotalReferred },
    });

    const referrerName = `${referrer.firstName} ${referrer.lastName || ""}`.trim();
    const referredModelName = approvedModel.firstName;

    // ==========================================
    // AUTO-UPGRADE LOGIC
    // ==========================================
    // If referrer is "normal" and count >= threshold, upgrade to "special"
    let currentReferrerType = referrer.type;
    let wasUpgraded = false;

    if (currentReferrerType === "normal" && newTotalReferred >= MIN_REFERRED_MODELS_FOR_COMMISSION) {
      console.log(`[Referral] Upgrading referrer ${referrer.id} from normal to special. Count: ${newTotalReferred}, Threshold: ${MIN_REFERRED_MODELS_FOR_COMMISSION}`);

      // Upgrade the referrer to special
      await prisma.model.update({
        where: { id: referrer.id },
        data: { type: "special" },
      });

      currentReferrerType = "special";
      wasUpgraded = true;

      await createAuditLogs({
        ...auditBase,
        action: "AUTO_UPGRADE_MODEL_TYPE",
        description: `Model ${referrer.id} auto-upgraded from normal to special. Total referred: ${newTotalReferred} (threshold: ${MIN_REFERRED_MODELS_FOR_COMMISSION})`,
        status: "success",
        onSuccess: {
          referrerId: referrer.id,
          previousType: "normal",
          newType: "special",
          totalReferredModels: newTotalReferred,
          threshold: MIN_REFERRED_MODELS_FOR_COMMISSION,
        },
      });

      console.log(`[Referral] Referrer ${referrer.id} upgraded from normal to special!`);

      // Send upgrade notification via SMS
      if (referrer.whatsapp) {
        try {
          const { sendSMS } = await import("./email.server");
          const upgradeMessage = `XaoSao: ຍິນດີດ້ວຍ ${referrer.firstName}! ທ່ານໄດ້ຮັບການອັບເກຣດເປັນ Special Model ແລ້ວ. ຕອນນີ້ທ່ານຈະໄດ້ຮັບຄ່ານາຍໜ້າ 20% ຈາກການສະໝັກສະມາຊິກ ແລະ 2% ຈາກການຈອງຂອງລູກຄ້າທີ່ທ່ານແນະນຳ.`;
          await sendSMS(referrer.whatsapp.toString(), upgradeMessage);
          console.log(`[Referral] Upgrade notification sent to ${referrer.whatsapp}`);
        } catch (smsError) {
          console.error(`[Referral] Failed to send upgrade SMS:`, smsError);
        }
      }
    }

    // ==========================================
    // BONUS PAYMENT LOGIC
    // ==========================================
    const isSpecialOrPartner = currentReferrerType === "special" || currentReferrerType === "partner";
    const shouldPayBonus = newTotalReferred <= MIN_REFERRED_MODELS_FOR_COMMISSION;

    console.log(`[Referral] isSpecialOrPartner: ${isSpecialOrPartner}, shouldPayBonus: ${shouldPayBonus}`);

    // If referrer is special/partner AND past the bonus threshold, no bonus
    if (isSpecialOrPartner && !shouldPayBonus) {
      // Mark as processed (no bonus paid)
      await prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true },
      });

      await createAuditLogs({
        ...auditBase,
        description: `Referral tracked for ${currentReferrerType} referrer ${referrer.id}. No bonus for model #${newTotalReferred} (past threshold of ${MIN_REFERRED_MODELS_FOR_COMMISSION}).`,
        status: "success",
        onSuccess: {
          referrerId: referrer.id,
          referredId: approvedModelId,
          referrerType: currentReferrerType,
          newTotalReferred,
          threshold: MIN_REFERRED_MODELS_FOR_COMMISSION,
          bonusPaid: false,
          wasUpgraded,
        },
      });

      console.log(`[Referral] No 50K bonus for model #${newTotalReferred} (referrer is ${currentReferrerType}, past threshold).`);

      // Send notification about referral tracked (no bonus)
      try {
        await notifyReferralTracked({
          referrerId: referrer.id,
          referrerName,
          referrerWhatsapp: referrer.whatsapp,
          referredModelName,
          referrerType: currentReferrerType,
          totalReferred: newTotalReferred,
        });
      } catch (notifyError) {
        console.error(`[Referral] notifyReferralTracked failed:`, notifyError);
      }

      return {
        success: true,
        referrerId: referrer.id,
        amount: 0,
        bonusPaid: false,
        upgraded: wasUpgraded,
        newType: wasUpgraded ? currentReferrerType : undefined,
      };
    }

    // Pay 50K bonus (count <= threshold)
    const referrerWallet = await prisma.wallet.findFirst({
      where: {
        modelId: approvedModel.referredById,
        status: "active",
      },
    });

    if (!referrerWallet) {
      console.log(`[Referral] Skipped: Referrer ${approvedModel.referredById} has no wallet`);
      await createAuditLogs({
        ...auditBase,
        description: `Referral reward failed: Referrer ${approvedModel.referredById} has no active wallet`,
        status: "failed",
        onError: { reason: "Referrer wallet not found" },
      });
      return { success: false, reason: "Referrer wallet not found" };
    }

    // Update wallet balance and create transaction
    const [updatedWallet, transaction, updatedModel, updatedReferrer] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + REFERRAL_REWARD_AMOUNT,
          totalRecharge: referrerWallet.totalRecharge + REFERRAL_REWARD_AMOUNT,
        },
      }),
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
      prisma.model.update({
        where: { id: approvedModelId },
        data: { referralRewardPaid: true },
      }),
      prisma.model.update({
        where: { id: referrer.id },
        data: {
          totalReferralEarnings: (referrer.totalReferralEarnings || 0) + REFERRAL_REWARD_AMOUNT,
        },
      }),
    ]);

    await createAuditLogs({
      ...auditBase,
      description: `Referral reward of ${REFERRAL_REWARD_AMOUNT} Kip paid to model ${approvedModel.referredById}. Model #${newTotalReferred}/${MIN_REFERRED_MODELS_FOR_COMMISSION}.${wasUpgraded ? ` Upgraded to ${currentReferrerType}!` : ''}`,
      status: "success",
      onSuccess: {
        referrerId: approvedModel.referredById,
        referredId: approvedModelId,
        referrerType: currentReferrerType,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
        newBalance: updatedWallet.totalBalance,
        totalReferred: newTotalReferred,
        threshold: MIN_REFERRED_MODELS_FOR_COMMISSION,
        upgraded: wasUpgraded,
      },
    });

    console.log(`[Referral] Reward paid: ${REFERRAL_REWARD_AMOUNT} Kip to model ${approvedModel.referredById}. Model #${newTotalReferred}/${MIN_REFERRED_MODELS_FOR_COMMISSION}${wasUpgraded ? ` (upgraded to ${currentReferrerType})` : ''}`);

    // Send notification about bonus received
    try {
      await notifyReferralBonusReceived({
        referrerId: referrer.id,
        referrerName,
        referrerWhatsapp: referrer.whatsapp,
        referredModelName,
        amount: REFERRAL_REWARD_AMOUNT,
        transactionId: transaction.id,
      });
    } catch (notifyError) {
      console.error(`[Referral] notifyReferralBonusReceived failed:`, notifyError);
    }

    return {
      success: true,
      referrerId: approvedModel.referredById,
      amount: REFERRAL_REWARD_AMOUNT,
      transactionId: transaction.id,
      bonusPaid: true,
      totalReferred: newTotalReferred,
      upgraded: wasUpgraded,
      newType: wasUpgraded ? currentReferrerType : undefined,
    };
  } catch (error) {
    console.error("[Referral] Error processing referral reward:", error);
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

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

// Referral reward amount in Kip
export const REFERRAL_REWARD_AMOUNT = 50000;

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
 */
export async function processReferralReward(approvedModelId: string, adminUserId: string) {
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

    // Check if reward was already paid
    if (approvedModel.referralRewardPaid) {
      console.log(`Referral reward skipped: Reward already paid for ${approvedModelId}`);
      return { success: false, reason: "Reward already paid" };
    }

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
    const [updatedWallet, transaction, updatedModel] = await prisma.$transaction([
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

    return {
      success: true,
      referrerId: approvedModel.referredById,
      amount: REFERRAL_REWARD_AMOUNT,
      transactionId: transaction.id,
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

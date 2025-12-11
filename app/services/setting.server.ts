import { ISettingInputs } from "~/interfaces";
import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";

export async function getSettings() {
  try {
    return await prisma.setting.findFirst();
  } catch (error) {
    console.error("GET_ADMINS_FAILED", error);
    throw new Error("Failed to fetch admins.");
  }
}

export async function updateSettings(
  id: string,
  data: ISettingInputs,
  userId: string
) {
  const auditBase = {
    action: "UPDATE_SETTING",
    user: userId,
  };
  try {
    const setting = await prisma.setting.update({
      data: {
        platform_fee_percent: data.platform_fee_percent,
        min_payout: data.min_payout,
        max_withdrawal_day: data.max_withdrawal_day,
        max_withdrawal_week: data.max_withdrawal_week,
        max_withdrawal_month: data.max_withdrawal_month,
        exchange_rate: data.exchange_rate,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
        qr_code: data.qr_code,
        require_2fa_admin: data.require_2fa_admin,
        auto_approve_models: data.auto_approve_models,
        require_email_verification: data.require_email_verification,
        require_phone_verification: data.require_phone_verification,
        min_age: data.min_age,
      },
      where: { id },
    });

    if (setting.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update setting successfully.`,
        status: "success",
        onSuccess: setting,
      });
    }
    return setting;
  } catch (error: any) {
    console.error("UPDATE_SETTING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update setting failed!`,
      status: "failed",
      onError: error,
    });

    throw new Error("Failed to update setting information");
  }
}

export interface ISettingInputs {
  id: string;
  platform_fee_percent: number;
  min_payout: number;
  max_withdrawal_day: number;
  max_withdrawal_week: number;
  max_withdrawal_month: number;
  exchange_rate: number;
  bank_account_name: string;
  bank_account_number: string;
  qr_code: string;
  require_2fa_admin: boolean;
  auto_approve_models: boolean;
  require_email_verification: boolean;
  require_phone_verification: boolean;
  min_age: number;
}

export interface ISettingResponse extends ISettingInputs {
  createdAt: string;
  updatedAt: string;
}

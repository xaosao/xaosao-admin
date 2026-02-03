import { UserStatus } from "./base";

export interface IWalletInputs {
  totalBalance: number;
  totalRecharge: number;
  // New wallet schema fields
  totalWithdraw: number;
  totalSpend: number;
  totalRefunded: number;
  totalPending: number;
  // Deprecated field (kept for backwards compatibility)
  totalDeposit?: number;
  status: UserStatus;
  model?: string;
  customer?: string;
  updatedBy?: string;
}

export interface IWallets extends IWalletInputs {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  bannedBy: string;
}

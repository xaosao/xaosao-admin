import { UserStatus } from "./base";

export interface IWalletInputs {
  totalBalance: number;
  totalRecharge: number;
  totalDeposit: number;
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

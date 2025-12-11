// ===== BASE ENTITIES =====
export interface BaseEntity {
  createdAt: string;
  updatedAt: string | null;
  createdById: string;
  deletedById: string | null;
  updatedById: string | null;
}

// ===== SHARED ENUMS =====
export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}

export enum AvailableStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  BUSY = "busy",
  AWAY = "away",
}

export interface IPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  limit: number;
}

export interface IBaseFilters {
  fromDate: string;
  toDate: string;
  page: number;
  showBy: number;
}

export interface IFilters extends IBaseFilters {
  status: string;
  search: string;
}

export interface ISessionFilters extends IBaseFilters {
  sessionStatus: string;
  paymentStatus: string;
  search: string;
}

export interface IConversationFilters extends IBaseFilters {
  status: string;
  search: string;
}

export enum Identifier {
  RECHARGE = "recharge",
  DEPOSIT = "deposit",
  REFUND = "refund",
  ADD_FUND = "add_fund",
  SUBTRACT_FUND = "subtract_fund",
}

export enum TransactionStatus {
  ACTIVE = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

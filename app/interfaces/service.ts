import { BaseEntity, UserStatus } from "./base";

export type BillingType = "per_day" | "per_hour" | "per_session" | "per_minute";

export interface IServices extends BaseEntity {
  id: string;
  name: string;
  description: string;
  baseRate: number;
  commission: number;
  status: UserStatus;
  billingType: BillingType;
  hourlyRate?: number | null;
  oneTimePrice?: number | null;
  oneNightPrice?: number | null;
  minuteRate?: number | null;
}

export interface IServicesInput {
  name: string;
  description: string;
  baseRate: number;
  commission: number;
  status: UserStatus;
  billingType: BillingType;
  hourlyRate?: number | null;
  oneTimePrice?: number | null;
  oneNightPrice?: number | null;
  minuteRate?: number | null;
}

export interface IModelService {
  id: string;
  customRate: number;
  isAvailable: boolean;
  minSessionDuration: number;
  maxSessionDuration: number;
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  modelId: string;
  serviceId: string;
  service: IService;
}

export interface IService {
  id: string;
  name: string;
  baseRate: number;
}

export interface IModelServicesInput {
  id: string;
  customRate: number;
  minSessionDuration: number;
  maxSessionDuration: number;
  isAvailable: boolean;
  status: "active" | "inactive";
}

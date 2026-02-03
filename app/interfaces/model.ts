import { AvailableStatus, BaseEntity, Gender, UserStatus } from "./base";
import { IModelService } from "./service";

export interface IModels extends BaseEntity {
  id: string;
  firstName: string;
  lastName?: string;
  username: string;
  password: string;
  dob: string;
  gender: Gender;
  bio: string;
  whatsapp: number;
  address?: string;
  status: UserStatus;
  available_status: AvailableStatus;
  profile?: string;
  latitude?: number;
  longitude?: number;
  location: JSON;
  rating: number | 0;
  total_review: number | 0;
  ModelService: IModelService[];

  // Additional profile fields
  hourly_rate_talking?: number;
  hourly_rate_video?: number;
  interests?: string[];
  relationshipStatus?: string;
  career?: string;
  education?: string;

  // Notification settings
  sendMailNoti?: boolean;
  sendSMSNoti?: boolean;
  sendPushNoti?: boolean;

  // Account settings
  defaultLanguage?: string;
  defaultTheme?: string;
  twofactorEnabled?: boolean;

  // Model type for tiered commission system
  type?: "normal" | "special" | "partner";

  // Referral fields
  referralCode?: string;
  customerReferralCode?: string;
  referredById?: string;
  referralRewardPaid?: boolean;
  totalReferredModels?: number;
  totalReferredCustomers?: number;
  totalReferralEarnings?: number;
  referredBy?: {
    id: string;
    firstName: string;
    lastName?: string;
    username: string;
    referralCode?: string;
  } | null;

  // Admin relations
  createdBy?: { firstName: string; lastName?: string };
  approveBy?: { firstName: string; lastName?: string };
  rejectedBy?: { firstName: string; lastName?: string };
}

export interface IModelUpdateInput {
  firstName: string;
  lastName?: string;
  gender: Gender;
  dob: string;
  whatsapp: number;
  address?: string;
  bio: string;
  status: UserStatus;
  available_status: AvailableStatus;
  profile?: string;
  type?: "normal" | "special" | "partner";
}

export interface IModelInput extends IModelUpdateInput {
  username: string;
  password: string;
}

export interface IEntityLogs {
  id: string;
  action: string;
  description: string;
  status: string;
  createdAt: string;
}

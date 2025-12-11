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

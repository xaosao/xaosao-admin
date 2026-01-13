import { IAdminInput } from "./admin";
import { BaseEntity, UserStatus } from "./base";

export interface ICustomer extends BaseEntity {
  id: string;
  number: string;
  firstName: string;
  lastName?: string;
  dob: string;
  gender: string;
  username?: string;
  password: string;
  latitude: number;
  longitude: number;
  country: string;
  ip: string;
  tier: string;
  whatsapp: number;
  location?: JSON;
  profile?: string;
  status: UserStatus;
  createdBy?: IAdminInput;
}

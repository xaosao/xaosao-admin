import { BaseEntity, Gender, UserStatus } from "./base";

export interface BaseAdmin extends BaseEntity {
  id: string;
  number: string;
  firstName: string;
  lastName?: string;
  gender: Gender;
  tel: number;
  email: string;
  username: string;
  password: string;
  address: string;
  profile?: string;
  is2FAEnabled?: boolean;
  status: UserStatus;
}

export interface IAdminUpdateInput {
  firstName: string;
  lastName?: string;
  gender: Gender;
  tel: number;
  email: string;
  address: string;
  profile?: string;
  role: string;
  status: UserStatus;
}

export interface IAdminInput extends BaseAdmin {
  role: string;
}

export interface IAdminResponse extends BaseAdmin {
  role: {
    id: string;
    name: string;
  };
}

export interface IStatusItem {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

export interface LoaderAdmin {
  id: string;
  number: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  tel: number;
  email: string;
  username: string;
  address: string | null;
  profile: string | null;
  role: {
    id: string;
    name: string;
  };
  createdAt: string; // because Date becomes string
  updatedAt: string;
}

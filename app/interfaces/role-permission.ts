import { BaseEntity } from "./base";

export interface IPermission extends BaseEntity {
  id: string;
  name: string;
  groupName: string;
  status: string;
  userId: string | null;
}

// export interface IRole {
//   id: string;
//   name: string;
//   status: UserStatus;
//   createdAt: string;
//   updatedAt: string;
//   permissions?: IPermission[];
// }

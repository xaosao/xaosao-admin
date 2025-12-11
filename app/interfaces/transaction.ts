import { Identifier, TransactionStatus } from "./base";

export interface Iidentifier {
  identifier: Identifier;
  amount: number;
  reason?: string;
  status: TransactionStatus;
  model?: string;
  customer?: string;
}

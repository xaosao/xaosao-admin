export interface IFinanceSummary {
  label: string;
  value: string;
  rawValue: number;
  icon: string;
  color: string;
}

export interface IFinanceSubItem {
  label: string;
  amount: number;
  formattedAmount: string;
  color: string;
}

export interface IFinanceBreakdownItem {
  category: string;
  label: string;
  amount: number;
  formattedAmount: string;
  count: number;
  percentage: number;
  color: string;
  subItems?: IFinanceSubItem[];
}

export interface IModelEarnings {
  modelId: string;
  firstName: string;
  lastName: string;
  profile: string;
  type: string;
  bookingEarnings: number;
  referralBonuses: number;
  bookingCommission: number;
  subscriptionCommission: number;
  totalEarnings: number;
}

export interface IFinanceFilters {
  search: string;
  identifier: string;
  status: string;
  period: string;
  fromDate: string;
  toDate: string;
  showBy: number;
}

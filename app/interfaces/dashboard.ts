export interface IDashboardStats {
  title: string;
  value: number;
  icon: string;
  color: string;
}

export interface IDashboardReport {
  name: string;
  models: number;
  customers: number;
  subscriptions: number;
  completedTransactions: number;
  bookings: number;
  posts: number;
}

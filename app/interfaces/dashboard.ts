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
  chats: number;
  callSessions: number;
  videoSessions: number;
  revenue: number;
  expended: number;
}

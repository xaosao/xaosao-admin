import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  UserCog,
  Wallet,
  Receipt,
  Star,
  FileText,
  DollarSign,
  CalendarDays,
} from "lucide-react";

export const status: any = [
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Suspended", value: "suspended" },
  { label: "Deleted", value: "deleted" },
];

export const available_status: any = [
  { label: "Online", value: "online" },
  { label: "Offline", value: "offline" },
  { label: "Busy", value: "busy" },
  { label: "Away", value: "away" },
];

export const customer_type: any = [
  { label: "Basic", value: "basic" },
  { label: "VIP", value: "vip" },
];

export const gender: any = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

export const model_type: any = [
  { label: "Normal", value: "normal" },
  { label: "Special", value: "special" },
  { label: "Partner", value: "partner" },
];

export const adjustment: any = [
  { label: "Add Funds", value: "add fund" },
  { label: "Subtract Funds", value: "substract fund" },
];

export const billingTypes: any = [
  { label: "Per Day", value: "per_day" },
  { label: "Per Hour", value: "per_hour" },
  { label: "Per Session", value: "per_session" },
  { label: "Per Minute (Call Service)", value: "per_minute" },
];

// Sidebar menu
export const singleNavigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: { group: "dashboard", action: "view" },
  },
  {
    name: "Admins",
    href: "/dashboard/admins",
    icon: UserCog,
    permission: { group: "admin", action: "view" },
  },
  {
    name: "Models",
    href: "/dashboard/models",
    icon: UserCheck,
    permission: { group: "model", action: "view" },
  },
  {
    name: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    permission: { group: "customer", action: "view" },
  },
  {
    name: "Services",
    href: "/dashboard/services",
    icon: Settings,
    permission: { group: "service", action: "view" },
  },
  // {
  //   name: "Chats",
  //   href: "/dashboard/chats",
  //   icon: MessageSquare,
  //   permission: { group: "chat", action: "view" },
  // },
  // {
  //   name: "Call Sessions",
  //   href: "/dashboard/call-sessions",
  //   icon: Phone,
  //   permission: { group: "call", action: "view" },
  // },
  {
    name: "Wallets",
    href: "/dashboard/wallets",
    icon: Wallet,
    permission: { group: "wallet", action: "view" },
  },
  {
    name: "Transactions",
    href: "/dashboard/transactions",
    icon: Receipt,
    permission: { group: "transaction", action: "view" },
  },
  {
    name: "Bookings",
    href: "/dashboard/bookings",
    icon: CalendarDays,
    permission: { group: "transaction", action: "view" },
  },
  {
    name: "Revenue",
    href: "/dashboard/revenue",
    icon: DollarSign,
    permission: { group: "revenue", action: "view" },
  },
  {
    name: "Reviews",
    href: "/dashboard/reviews",
    icon: Star,
    permission: { group: "review", action: "view" },
  },
  {
    name: "Audit Logs",
    href: "/dashboard/logs",
    icon: FileText,
    permission: { group: "audit-log", action: "view" },
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permission: { group: "setting", action: "view" },
  },
];

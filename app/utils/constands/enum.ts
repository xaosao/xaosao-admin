import {
  Phone,
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  UserCog,
  Wallet,
  Receipt,
  Star,
  UserSearch,
  DollarSign,
  CalendarDays,
  Landmark,
  Bell,
  Megaphone,
  CreditCard,
  Gift,
  ImageIcon,
  Trophy,
  Bot,
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
    name: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: CreditCard,
    permission: { group: "subscription", action: "view" },
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
  {
    // Per-minute calls: who called whom, for how long, what it cost and
    // what the model earned. Grouped under `session` permissions — the
    // group that exists for this; there has never been a "call" group,
    // which is why this entry was invisible while it was commented out.
    name: "Calls",
    href: "/dashboard/call-sessions",
    icon: Phone,
    permission: { group: "session", action: "view" },
  },
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
    permission: { group: "booking", action: "view" },
  },
  {
    name: "Revenue",
    href: "/dashboard/revenue",
    icon: DollarSign,
    permission: { group: "revenue", action: "view" },
  },
  {
    name: "Finance",
    href: "/dashboard/finance",
    icon: Landmark,
    permission: { group: "finance", action: "view" },
  },
  {
    name: "Posts",
    href: "/dashboard/posts",
    icon: Megaphone,
    permission: { group: "post", action: "view" },
  },
  {
    name: "Gifts",
    href: "/dashboard/gifts",
    icon: Gift,
    permission: { group: "gift", action: "view" },
  },
  {
    // Daily login rewards paid by the platform. Sits under `setting`
    // permissions rather than `gift` — it spends real money on a schedule,
    // so it belongs with the controls that configure the platform.
    name: "Rewards",
    href: "/dashboard/rewards",
    icon: Trophy,
    permission: { group: "setting", action: "view" },
  },
  {
    // Conversations customers had with the AI assistant. Grouped under
    // `chat` permissions — it is reading customer messages, even though
    // the other side is a bot.
    name: "AI chats",
    href: "/dashboard/assistant",
    icon: Bot,
    permission: { group: "chat", action: "view" },
  },
  {
    name: "Images",
    href: "/dashboard/images",
    icon: ImageIcon,
    permission: { group: "admin", action: "view" },
  },
  {
    name: "Reviews",
    href: "/dashboard/reviews",
    icon: Star,
    permission: { group: "review", action: "view" },
  },
  {
    name: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    permission: { group: "notification", action: "view" },
  },
  {
    name: "Audit Logs",
    href: "/dashboard/logs",
    icon: UserSearch,
    permission: { group: "log", action: "view" },
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permission: { group: "setting", action: "view" },
  },
];

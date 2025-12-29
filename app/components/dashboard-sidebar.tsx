import { cn, singleNavigation } from "~/utils"
import { Link, useLocation } from "@remix-run/react"
import { useAuthStore } from "~/store/permissionStore"
import { ScrollArea } from "~/components/ui/scroll-area"
import type { PendingCounts } from "~/services/dashboard.server"

interface DashboardSidebarProps {
  pendingCounts?: PendingCounts;
}

export function DashboardSidebar({ pendingCounts }: DashboardSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname

  const isAuthReady = useAuthStore((state) => state.isAuthReady)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const role = useAuthStore((state) => state.role)

  if (!isAuthReady) return null

  const visibleNavigation = singleNavigation.filter((item) => {
    // Always allow superadmin
    if (role?.name === "superadmin") return true

    // If no permission specified, hide it
    if (!item.permission) return false

    return hasPermission(item.permission.group, item.permission.action)
  })

  // Get badge count for specific menu items
  const getBadgeCount = (itemName: string): number => {
    if (!pendingCounts) return 0;
    switch (itemName) {
      case "Models":
        return pendingCounts.pendingModels;
      case "Transactions":
        return pendingCounts.pendingTransactions;
      case "Bookings":
        return pendingCounts.pendingBookings;
      case "Reviews":
        return pendingCounts.newReviews;
      default:
        return 0;
    }
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-gray-200">
      <div className="flex h-16 items-center justify-center px-6 border-b border-gray-200">
        <img src="/images/logo-pink.png" className="w-28 h-8" />
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {visibleNavigation.map((item) => {
            const isActive = pathname === item.href
            const badgeCount = getBadgeCount(item.name);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-dark-pink text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <div className="flex items-center">
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </div>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      "ml-2 px-2 py-0.5 text-xs font-semibold rounded-full",
                      isActive
                        ? "bg-white text-rose-500"
                        : "bg-rose-500 text-white"
                    )}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}

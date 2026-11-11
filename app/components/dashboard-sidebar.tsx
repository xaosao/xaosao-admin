import { useEffect, useRef } from "react"
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

  // The menu is longer than the sidebar, so the page you are on can sit
  // below the fold — on Settings it showed as a stripe of highlight under
  // the last visible item. Bring it into view instead.
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  const isAuthReady = useAuthStore((state) => state.isAuthReady)

  // `isAuthReady` matters as much as the path: the menu is not rendered
  // until permissions arrive, so an effect keyed on the path alone runs
  // once against an empty sidebar and never again.
  useEffect(() => {
    if (!isAuthReady) return
    const link = activeRef.current
    if (!link) return
    const frame = requestAnimationFrame(() =>
      link.scrollIntoView({ block: "nearest" }),
    )
    return () => cancelAnimationFrame(frame)
  }, [pathname, isAuthReady])

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
      case "Subscriptions":
        return pendingCounts.activeSubscriptions;
      case "Posts":
        return pendingCounts.activePosts;
      default:
        return 0;
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200 px-6">
        <img src="/images/logo-pink.png" className="w-28 h-8" />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-4">
        <nav className="w-full space-y-1 pb-2 pr-1">
          {visibleNavigation.map((item) => {
            const isActive = pathname === item.href
            const badgeCount = getBadgeCount(item.name);
            return (
              <Link
                key={item.name}
                to={item.href}
                ref={isActive ? activeRef : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-dark-pink text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <div className="flex min-w-0 items-center">
                  <item.icon className="mr-3 h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
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

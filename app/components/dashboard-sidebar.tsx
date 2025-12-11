import { cn, singleNavigation } from "~/utils"
import { Link, useLocation } from "@remix-run/react"
import { ScrollArea } from "~/components/ui/scroll-area"
import { useAuthStore } from "~/store/permissionStore"

export function DashboardSidebar() {
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

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white border-r border-gray-200">
      <div className="flex h-16 items-center justify-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 uppercase">Xaosao Admin</h1>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {visibleNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-dark-pink text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                )}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}

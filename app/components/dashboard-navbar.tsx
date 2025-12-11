import { Form } from "@remix-run/react"
import { Bell, LogOut, User, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

import { LoaderAdmin } from "~/interfaces"

interface DashboardNavbarProps {
  admin: LoaderAdmin | null;
}

export function DashboardNavbar({ admin }: DashboardNavbarProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4">
      <div className="flex items-center flex-1 max-w-sm">
      </div>

      <div className="flex items-center space-x-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
              <Bell className="h-4 w-4 text-gray-600" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-pink-500 text-white text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Notifications</span>
                <Badge variant="secondary" className="text-xs">
                  3 new
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-pink-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">New model application</p>
                  <p className="text-xs text-gray-500">Sarah Johnson submitted verification documents</p>
                  <p className="text-xs text-gray-400 mt-1">2 minutes ago</p>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Payment received</p>
                  <p className="text-xs text-gray-500">$250 payment from VIP member John Smith</p>
                  <p className="text-xs text-gray-400 mt-1">15 minutes ago</p>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 cursor-pointer">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Content flagged</p>
                  <p className="text-xs text-gray-500">User reported inappropriate content for review</p>
                  <p className="text-xs text-gray-400 mt-1">1 hour ago</p>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-center text-sm text-pink-600 cursor-pointer">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={admin?.profile ?? ""} alt={admin?.firstName} />
                <AvatarFallback className="bg-dark-pink text-white text-xs">
                  {admin?.firstName?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{admin?.firstName}&nbsp;{admin?.lastName}</p>
                <p className="text-xs leading-none text-muted-foreground">{admin?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm text-gray-500 cursor-pointer">
              <User className="mr-2 h-3 w-3" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-sm text-gray-500 cursor-pointer">
              <Settings className="mr-2 h-3 w-3" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Form method="post" action="/logout">
                <button type="submit" className="text-red-600 text-sm flex items-center justify-start w-full">
                  <LogOut className="mr-2 h-3 w-3" />
                  <span>Log out</span>
                </button>
              </Form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
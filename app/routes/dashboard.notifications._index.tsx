import React, { useCallback } from "react";
import {
  Form,
  json,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
  useNavigation,
} from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";

// Components
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import EmptyPage from "~/components/ui/empty";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Plus,
  Search,
  EyeIcon,
  MoreVertical,
  Bell,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Smartphone,
  Mail,
  Ban,
} from "lucide-react";

// Backend
import type { IPagination } from "~/interfaces/base";
import { useAuthStore } from "~/store/permissionStore";
import { formatDate1 } from "~/utils";
import { getBroadcastNotifications } from "~/services/broadcast.server";
import { prisma } from "~/services/database.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";

// Status badge config
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200" },
  sending: { label: "Sending", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  sent: { label: "Sent", className: "bg-green-100 text-green-700 border-green-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

// Target user type labels
const targetLabels: Record<string, string> = {
  customer: "Customers",
  model: "Models",
  all: "All Users",
};

interface LoaderData {
  notifications: any[];
  pagination: IPagination;
  total: number;
  filters: { search: string };
}

export default function NotificationsList() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { notifications, pagination, total, filters } =
    useLoaderData<LoaderData>();
  const isCancelling = navigation.state === "submitting";

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      if (!updates.page) {
        params.set("page", "1");
      }
      navigate(`?${params.toString()}`, { replace: true });
    },
    [searchParams, navigate]
  );

  const handleSearchSubmit = useCallback(
    (formData: FormData) => {
      const search = formData.get("search") as string;
      updateFilters({ search: search || "" });
    },
    [updateFilters]
  );

  const canAccess = hasPermission("notification", "view");
  const canCreate = hasPermission("notification", "create");
  const canEdit = hasPermission("notification", "edit");
  const canDelete = hasPermission("notification", "delete");

  if (!canAccess) {
    return (
      <div className="h-full flex items-center justify-center">
        <ForbiddenCard
          title="Unallowed for your role"
          subtitle="This area requires additional permissions. Please request access or go back."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
        <div>
          <h1 className="text-md sm:text-lg font-semibold text-gray-900 mb-2">
            Broadcast Notifications
          </h1>
          <Breadcrumb
            items={[
              { label: "Dashboard", value: "/dashboard" },
              { label: "Notifications", value: "/dashboard/notifications" },
            ]}
          />
        </div>
        <div className="flex items-center space-x-2">
          {canEdit && notifications.some((n) => n.status === "scheduled") && (
            <Form method="post">
              <input type="hidden" name="intent" value="cancelAllScheduled" />
              <Button
                type="submit"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                disabled={isCancelling}
              >
                <Ban className="h-4 w-4 mr-2" />
                {isCancelling ? "Cancelling..." : "Cancel All Scheduled"}
              </Button>
            </Form>
          )}
          {canCreate && (
            <Button className="bg-dark-pink hover:opacity-90 text-white">
              <Link
                to="/dashboard/notifications/create"
                className="flex items-center space-x-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Notification
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md rounded-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">{total}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50">
                <Bell className="h-4 w-4 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Scheduled
                </p>
                <p className="text-xl font-bold text-blue-600 mt-1">
                  {notifications.filter((n) => n.status === "scheduled").length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Sent
                </p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  {notifications.filter((n) => n.status === "sent").length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md rounded-md bg-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Failed
                </p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  {notifications.filter((n) => n.status === "failed").length}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-50">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-md rounded-md">
        <CardHeader className="p-2 sm:p-4">
          <Form
            method="get"
            onChange={(e) => {
              const formData = new FormData(e.currentTarget);
              handleSearchSubmit(formData);
            }}
            className="flex items-center"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                name="search"
                placeholder="Search notifications..."
                className="pl-9 w-64 border-gray-200 focus:border-pink-300 focus:ring-pink-300"
                defaultValue={filters.search}
              />
            </div>
          </Form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="uppercase">
              <TableRow className="border-t border-gray-100 bg-gray-50">
                <TableHead className="text-xs font-semibold">No</TableHead>
                <TableHead className="text-xs font-semibold">Title</TableHead>
                <TableHead className="text-xs font-semibold">Target</TableHead>
                <TableHead className="text-xs font-semibold">Channels</TableHead>
                <TableHead className="text-xs font-semibold">Schedule</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Delivery</TableHead>
                <TableHead className="text-xs font-semibold">Created</TableHead>
                <TableHead className="text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications && notifications.length > 0 ? (
                notifications.map((notification, index) => {
                  const statusInfo =
                    statusConfig[notification.status] || statusConfig.draft;
                  return (
                    <TableRow
                      key={notification.id}
                      className="border-gray-50 hover:bg-gray-50 text-gray-500 text-sm"
                    >
                      <TableCell>
                        {(pagination.currentPage - 1) * pagination.limit +
                          index +
                          1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[200px]">
                            {notification.message}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="text-xs"
                          >
                            {targetLabels[notification.targetUserType] || notification.targetUserType}
                          </Badge>
                          {notification.targetGender && (
                            <p className="text-xs text-gray-400">
                              {notification.targetGender}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {notification.targetPackage && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">
                                {notification.targetPackage === "free" ? "Free" : notification.targetPackage}
                              </span>
                            )}
                            {notification.targetService && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600">
                                {notification.targetService === "no_service" ? "No Svc" : "Drinking"}
                              </span>
                            )}
                            {notification.targetBooking && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-orange-50 text-orange-600">
                                {notification.targetBooking === "never_booked" ? "No Book" : "No Got Book"}
                              </span>
                            )}
                            {notification.targetImages && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-50 text-cyan-600">
                                {"<6 Images"}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {notification.channelInApp && (
                            <Bell className="h-3.5 w-3.5 text-blue-500" title="In-App" />
                          )}
                          {notification.channelSMS && (
                            <MessageSquare className="h-3.5 w-3.5 text-green-500" title="SMS" />
                          )}
                          {notification.channelPush && (
                            <Smartphone className="h-3.5 w-3.5 text-purple-500" title="Push" />
                          )}
                          {notification.channelWhatsApp && (
                            <Mail className="h-3.5 w-3.5 text-emerald-500" title="WhatsApp" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {notification.scheduleType === "immediate" ? (
                            <span className="text-gray-500">Immediate</span>
                          ) : (
                            <span className="text-blue-600">
                              {notification.recurrence !== "once"
                                ? `${notification.recurrence} @ ${notification.recurrenceTime}`
                                : notification.scheduledAt
                                ? formatDate1(notification.scheduledAt)
                                : "-"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">
                          {notification.sentCount}/{notification.totalRecipients}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate1(notification.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-48"
                            align="end"
                            forceMount
                          >
                            <DropdownMenuItem className="text-sm">
                              <Link
                                to={`${notification.id}`}
                                className="flex space-x-2 text-gray-500 w-full"
                              >
                                <EyeIcon className="mr-2 h-3 w-3" />
                                <span>View Details</span>
                              </Link>
                            </DropdownMenuItem>

                            {canEdit &&
                              notification.status === "draft" && (
                                <DropdownMenuItem className="text-sm">
                                  <Link
                                    to={`${notification.id}/edit`}
                                    className="flex space-x-2 text-gray-500 w-full"
                                  >
                                    <Send className="mr-2 h-3 w-3" />
                                    <span>Edit</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                            {canEdit &&
                              ["draft", "scheduled"].includes(notification.status) && (
                                <DropdownMenuItem className="text-sm">
                                  <Link
                                    to={`${notification.id}/cancel`}
                                    className="flex space-x-2 text-gray-500 w-full"
                                  >
                                    <Ban className="mr-2 h-3 w-3" />
                                    <span>Cancel</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}

                            {canDelete &&
                              notification.status === "draft" && (
                                <DropdownMenuItem className="text-sm">
                                  <Link
                                    to={`${notification.id}/delete`}
                                    className="flex space-x-2 text-red-500 w-full"
                                  >
                                    <XCircle className="mr-2 h-3 w-3" />
                                    <span>Delete</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <EmptyPage
                      title="No notifications found!"
                      description="Create your first broadcast notification to reach your users."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            limit={pagination.limit}
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            baseUrl=""
            searchParams={searchParams}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "view",
  });

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("showBy") || "20", 10);

  try {
    const result = await getBroadcastNotifications(page, limit, search || undefined);

    return json({
      notifications: result.notifications,
      total: result.total,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalCount: result.total,
        limit,
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
      },
      filters: { search },
    });
  } catch (error) {
    console.error("LOAD_NOTIFICATIONS_FAILED", error);
    throw new Error("Failed to fetch notifications");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "edit",
  });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "cancelAllScheduled") {
    const result = await prisma.broadcast_notification.updateMany({
      where: { status: "scheduled" },
      data: { status: "cancelled" },
    });
    console.log(`[Notifications] Cancelled ${result.count} scheduled notification(s)`);
    return json({ success: true, cancelled: result.count });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

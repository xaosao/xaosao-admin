import {
  json,
  Link,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";

// Components
import Modal from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import {
  Bell,
  MessageSquare,
  Smartphone,
  Mail,
  Users,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";

// Backend
import { useAuthStore } from "~/store/permissionStore";
import { formatDate1 } from "~/utils";
import { getBroadcastNotification } from "~/services/broadcast.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";

// Status badge config
const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700", icon: Clock },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700", icon: Clock },
  sending: { label: "Sending", className: "bg-yellow-100 text-yellow-700", icon: Send },
  sent: { label: "Sent", className: "bg-green-100 text-green-700", icon: CheckCircle },
  failed: { label: "Failed", className: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-500", icon: Ban },
};

const targetLabels: Record<string, string> = {
  customer: "Customers",
  model: "Models",
  all: "All Users",
};

export default function NotificationDetail() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { notification } = useLoaderData<typeof loader>();

  function closeHandler() {
    navigate("/dashboard/notifications");
  }

  const canAccess = hasPermission("notification", "view");

  if (!canAccess) {
    return (
      <div className="h-full flex items-center justify-center">
        <ForbiddenCard
          title="Unallowed for your role"
          subtitle="This area requires additional permissions."
        />
      </div>
    );
  }

  if (!notification) {
    return (
      <Modal onClose={closeHandler} className="w-3/5">
        <div className="text-center py-8">
          <p className="text-gray-500">Notification not found</p>
        </div>
      </Modal>
    );
  }

  const statusInfo = statusConfig[notification.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <Modal onClose={closeHandler} className="w-4/5 max-w-3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-md font-bold text-gray-900">
              {notification.title}
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              Created {formatDate1(notification.createdAt)}
            </p>
          </div>
          <Badge className={`${statusInfo.className} border-0`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>

        {/* Message */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {notification.message}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500">Total Recipients</p>
              <p className="text-lg font-bold text-gray-900">
                {notification.totalRecipients}
              </p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500">Sent</p>
              <p className="text-lg font-bold text-green-600">
                {notification.sentCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500">Failed</p>
              <p className="text-lg font-bold text-red-600">
                {notification.failedCount}
              </p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-500">Pending</p>
              <p className="text-lg font-bold text-yellow-600">
                {Math.max(
                  0,
                  notification.totalRecipients -
                    notification.sentCount -
                    notification.failedCount
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Target */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900">
              Target Audience
            </h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">User Type</span>
                <span className="font-medium">
                  {targetLabels[notification.targetUserType] || notification.targetUserType}
                </span>
              </div>
              {notification.targetGender && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Gender</span>
                  <span className="font-medium capitalize">
                    {notification.targetGender}
                  </span>
                </div>
              )}
              {(notification.targetAgeMin || notification.targetAgeMax) && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Age Range</span>
                  <span className="font-medium">
                    {notification.targetAgeMin || "Any"} -{" "}
                    {notification.targetAgeMax || "Any"}
                  </span>
                </div>
              )}
              {notification.targetCountry && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Country</span>
                  <span className="font-medium">
                    {notification.targetCountry}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Schedule & Channels */}
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-gray-900">
              Delivery Info
            </h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Schedule</span>
                <span className="font-medium capitalize">
                  {notification.scheduleType}
                </span>
              </div>
              {notification.recurrence !== "once" && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Recurrence</span>
                  <span className="font-medium capitalize">
                    {notification.recurrence}
                    {notification.recurrenceTime
                      ? ` @ ${notification.recurrenceTime}`
                      : ""}
                  </span>
                </div>
              )}
              {notification.scheduledAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Scheduled At</span>
                  <span className="font-medium">
                    {formatDate1(notification.scheduledAt)}
                  </span>
                </div>
              )}
              {notification.sentAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent At</span>
                  <span className="font-medium">
                    {formatDate1(notification.sentAt)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Channels</span>
                <div className="flex items-center gap-2">
                  {notification.channelInApp && (
                    <span className="flex items-center gap-1 text-xs text-blue-600">
                      <Bell className="h-3 w-3" /> In-App
                    </span>
                  )}
                  {notification.channelSMS && (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <MessageSquare className="h-3 w-3" /> SMS
                    </span>
                  )}
                  {notification.channelPush && (
                    <span className="flex items-center gap-1 text-xs text-purple-600">
                      <Smartphone className="h-3 w-3" /> Push
                    </span>
                  )}
                  {notification.channelWhatsApp && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Mail className="h-3 w-3" /> WhatsApp
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-start space-x-2 border-t pt-4">
          <Button variant="outline" onClick={closeHandler}>
            Close
          </Button>
          {["draft", "scheduled"].includes(notification.status) && (
            <Link to={`/dashboard/notifications/${notification.id}/cancel`}>
              <Button variant="outline" className="text-red-500 border-red-200">
                <Ban className="h-4 w-4 mr-2" />
                Cancel Notification
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Modal>
  );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "view",
  });

  const notification = await getBroadcastNotification(params.id as string);

  return json({ notification });
}

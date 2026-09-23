import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { LoaderCircle, Send } from "lucide-react";

// Components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";

// Backend
import {
  estimateRecipients,
  getBroadcastNotification,
  resendBroadcastNotification,
} from "~/services/broadcast.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";

export default function ResendNotification() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { title, message, estimate, lastSentAt } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const isSubmitting = navigation.state !== "idle";

  function closeHandler() {
    navigate("/dashboard/notifications");
  }

  return (
    <Modal onClose={closeHandler} className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-pink-100">
            <Send className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h4 className="text-md font-bold text-gray-900">
              Resend Notification
            </h4>
            <p className="text-sm text-gray-500">
              Sends this one again. No new notification is created.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 p-3 space-y-1">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 line-clamp-3">{message}</p>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <p>
            Goes to roughly{" "}
            <span className="font-semibold text-gray-900">{estimate}</span>{" "}
            {estimate === 1 ? "user" : "users"} matching the same filters.
          </p>
          {lastSentAt && (
            <p className="text-xs text-gray-500">
              Last sent {new Date(lastSentAt).toLocaleString()}
            </p>
          )}
          <p className="text-xs text-amber-600">
            Anyone who received it before and still matches will get it again.
          </p>
        </div>

        {actionData?.error && (
          <p className="text-sm text-red-600">{actionData.error}</p>
        )}

        <div className="flex items-center justify-end space-x-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={closeHandler}>
            Go Back
          </Button>
          <Form method="post">
            <Button
              type="submit"
              className="bg-pink-500 hover:bg-pink-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? "Sending..." : "Resend Now"}
            </Button>
          </Form>
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
    action: "create",
  });

  const notification = await getBroadcastNotification(params.id as string);
  if (!notification) {
    throw new Response("Not Found", { status: 404 });
  }

  // Re-count against the live audience rather than the original run's
  // totals — that is who a resend would actually reach.
  const estimate = await estimateRecipients(notification);

  return json({
    title: notification.title,
    message: notification.message,
    estimate,
    lastSentAt: notification.lastSentAt,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "create",
  });

  try {
    await resendBroadcastNotification(params.id as string);
    return redirect("/dashboard/notifications");
  } catch (error: any) {
    console.error("RESEND_NOTIFICATION_FAILED", error);
    return json({ error: error.message || "Failed to resend notification" });
  }
}

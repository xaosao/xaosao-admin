import { json, redirect } from "@remix-run/node";
import { Form, useNavigate, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { LoaderCircle, Ban } from "lucide-react";

// Components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";

// Backend
import { cancelBroadcastNotification } from "~/services/broadcast.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";

export default function CancelNotification() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  function closeHandler() {
    navigate("/dashboard/notifications");
  }

  return (
    <Modal onClose={closeHandler} className="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-100">
            <Ban className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h4 className="text-md font-bold text-gray-900">
              Cancel Notification
            </h4>
            <p className="text-sm text-gray-500">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Are you sure you want to cancel this notification? It will not be sent
          to any users.
        </p>

        <div className="flex items-center justify-end space-x-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={closeHandler}>
            Go Back
          </Button>
          <Form method="post">
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Ban className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? "Cancelling..." : "Cancel Notification"}
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
    action: "edit",
  });
  return json({});
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "notification",
    action: "edit",
  });

  try {
    await cancelBroadcastNotification(params.id as string);
    return redirect("/dashboard/notifications");
  } catch (error: any) {
    console.error("CANCEL_NOTIFICATION_FAILED", error);
    return json({ error: error.message || "Failed to cancel notification" });
  }
}

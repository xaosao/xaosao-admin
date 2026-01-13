import { LoaderCircle, X } from "lucide-react";
import { Form, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";

// utils
import { requireUserSession } from "~/services/auth.server";
import { getModel, updateModelStatus } from "~/services/model.server";

export default function UpdateModelStatusPage() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { model } = useLoaderData<typeof loader>();
  const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";

  function closeHandler() {
    navigate("..");
  }

  return (
    <Modal onClose={closeHandler} className="w-full max-w-md">
      <div>
        <h3 className="text-black text-md font-bold">Update Model Status</h3>
        <p className="text-gray-500 text-sm mt-1">
          Change the status for {model.firstName} {model.lastName}
        </p>
      </div>
      <Form className="space-y-4 mt-4" method="patch">
        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium text-gray-700">
            Select New Status
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={model.status}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="pending">Pending (Cannot login, hidden from customers)</option>
            <option value="verified">Verified (Can login, hidden from customers)</option>
            <option value="active">Active (Can login, visible to customers)</option>
            <option value="inactive">Inactive (Cannot login, hidden from customers)</option>
            <option value="suspended">Suspended (Cannot login, hidden from customers)</option>
            <option value="deleted">Deleted (Cannot login, hidden from customers)</option>
          </select>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-xs text-blue-700">
            <strong>Status Meanings:</strong>
          </p>
          <ul className="text-xs text-blue-600 mt-2 space-y-1">
            <li>• <strong>Pending:</strong> Awaiting approval - cannot login</li>
            <li>• <strong>Verified:</strong> Approved but hidden - can login, not visible to customers</li>
            <li>• <strong>Active:</strong> Fully active - can login and is shown to customers</li>
            <li>• <strong>Inactive:</strong> Temporarily disabled - cannot login</li>
            <li>• <strong>Suspended:</strong> Suspended by admin - cannot login</li>
            <li>• <strong>Deleted:</strong> Soft deleted - cannot login</li>
          </ul>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <p className="text-xs text-yellow-700">
            <strong>Current Status:</strong> <span className="capitalize font-semibold">{model.status}</span>
          </p>
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button type="button" variant="outline" onClick={closeHandler}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? "Updating..." : "Update Status"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  await requireUserSession(request);
  const model = await getModel(params.id!);
  if (!model) {
    throw new Response("Model not found", { status: 404 });
  }
  return json({ model });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  const formData = await request.formData();
  const newStatus = formData.get("status") as "pending" | "verified" | "active" | "inactive" | "suspended" | "deleted";

  if (request.method === "PATCH") {
    try {
      await updateModelStatus(params.id!, newStatus, userId);
      return redirect("/dashboard/models?success=Model+status+updated+successfully");
    } catch (error) {
      console.error("UPDATE_MODEL_STATUS_ERROR", error);
      return json({ error: "Failed to update model status" }, { status: 500 });
    }
  }

  return json({ message: "Invalid request method" }, { status: 405 });
}

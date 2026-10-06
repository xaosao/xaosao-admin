import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { LoaderCircle, PhoneCall } from "lucide-react";

// Components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";

// Backend
import {
  getModel,
  getModelContacts,
  logModelContact,
} from "~/services/model.server";
import {
  requireUserPermission,
  requireUserSession,
} from "~/services/auth.server";
import { formatDate1 } from "~/utils";

export default function ContactModel() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { modelName, whatsapp, history } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const isSubmitting = navigation.state !== "idle";

  function closeHandler() {
    navigate("/dashboard/models");
  }

  return (
    <Modal onClose={closeHandler} className="w-full max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-100">
            <PhoneCall className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-md font-bold text-gray-900">
              Mark as contacted
            </h4>
            <p className="text-sm text-gray-500">
              {modelName}
              {whatsapp ? ` · ${whatsapp}` : ""}
            </p>
          </div>
        </div>

        <Form method="post" className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="note" className="text-xs text-gray-500">
              Note (optional)
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxLength={500}
              placeholder="e.g. Called, no answer. Will try again tomorrow."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
            />
            <p className="text-[11px] text-gray-400">
              Each time you log a contact it is added to the history below, so
              the same model can be contacted as many times as needed.
            </p>
          </div>

          {actionData?.error && (
            <p className="text-sm text-red-600">{actionData.error}</p>
          )}

          <div className="flex items-center justify-end space-x-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={closeHandler}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <PhoneCall className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? "Saving..." : "Log contact"}
            </Button>
          </div>
        </Form>

        <div className="space-y-2 border-t pt-4">
          <h5 className="text-xs font-semibold text-gray-700">
            Contact history ({history.length})
          </h5>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400">
              No contact has been logged for this model yet.
            </p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-700">
                      {entry.by}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatDate1(entry.createdAt)}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="mt-1 text-xs text-gray-600">{entry.note}</p>
                  )}
                </li>
              ))}
            </ul>
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
    group: "model",
    action: "edit",
  });

  const modelId = params.id as string;
  const [model, contacts] = await Promise.all([
    getModel(modelId),
    getModelContacts(modelId),
  ]);

  if (!model) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({
    modelName: `${model.firstName} ${model.lastName || ""}`.trim(),
    whatsapp: model.whatsapp ? String(model.whatsapp) : null,
    history: contacts.map((c) => ({
      id: c.id,
      note: c.note,
      createdAt: c.createdAt,
      by: `${c.contactedBy?.firstName ?? "Admin"} ${
        c.contactedBy?.lastName ?? ""
      }`.trim(),
    })),
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserSession(request);
  await requireUserPermission({
    userId,
    group: "model",
    action: "edit",
  });

  const formData = await request.formData();
  const note = (formData.get("note") as string) || null;

  try {
    await logModelContact(params.id as string, userId as string, note);
    return redirect("/dashboard/models");
  } catch (error: any) {
    console.error("LOG_MODEL_CONTACT_FAILED", error);
    return json({ error: error.message || "Failed to log contact" });
  }
}

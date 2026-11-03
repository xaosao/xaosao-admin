import { useState } from "react"
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { Form, json, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { LoaderCircle, PencilLine } from "lucide-react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"

// services
import { useAuthStore } from "~/store/permissionStore"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { getModel, requestModelRevision } from "~/services/model.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

/**
 * Common reasons, so an admin doesn't have to type the same sentence
 * twenty times a day. They fill the box rather than submitting directly,
 * so the wording can still be edited before sending.
 */
const PRESETS = [
    "ຮູບໂປຣໄຟລ໌ບໍ່ຊັດເຈນ ກະລຸນາອັບໂຫລດຮູບໃໝ່",
    "ຮູບໂປຣໄຟລ໌ບໍ່ແມ່ນຮູບຂອງທ່ານເອງ ກະລຸນາໃຊ້ຮູບຈິງ",
    "ຂໍ້ມູນສ່ວນຕົວບໍ່ຄົບຖ້ວນ ກະລຸນາຕື່ມຂໍ້ມູນໃຫ້ຄົບ",
    "ເນື້ອຫາໃນໂປຣໄຟລ໌ບໍ່ເໝາະສົມ ກະລຸນາແກ້ໄຂ",
]

export default function RequestModelRevisionModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const model = useLoaderData<typeof loader>();
    const actionData = useActionData<{ reason?: string; id?: string }>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const [reason, setReason] = useState("");

    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("model", "edit");
    if (!canEdit) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        )
    }

    const modelName = `${model?.firstName ?? ""} ${model?.lastName ?? ""}`.trim();

    return (
        <Modal onClose={closeHandler} className="w-full max-w-lg">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100">
                        <PencilLine className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="text-md font-bold text-gray-900">Request changes</h4>
                        <p className="text-sm text-gray-500">{modelName}</p>
                    </div>
                </div>

                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4 text-sm text-amber-800 space-y-1">
                        <p className="font-semibold">This is not a rejection.</p>
                        <p>
                            The model keeps their account and receives an SMS with your
                            reason and a link to fix their profile. When they resubmit,
                            they come back here as pending for another look.
                        </p>
                        <p className="text-xs text-amber-700">
                            Rejecting instead is permanent — their phone number stays
                            taken, so they can never sign up again.
                        </p>
                    </CardContent>
                </Card>

                <Form method="patch" className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="reason" className="text-xs text-gray-500">
                            What does the model need to change? *
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setReason(preset)}
                                    className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 hover:bg-amber-100"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        <textarea
                            id="reason"
                            name="reason"
                            required
                            rows={4}
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. ຮູບໂປຣໄຟລ໌ບໍ່ຊັດເຈນ ກະລຸນາອັບໂຫລດຮູບໃໝ່"
                            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                        />
                        <p className="text-[11px] text-gray-400">
                            This text is sent to the model word for word, so write it in
                            the language they read. The link expires in 7 days.
                        </p>
                        {actionData?.reason && (
                            <p className="text-sm text-red-600">{actionData.reason}</p>
                        )}
                        {actionData?.id && (
                            <p className="text-sm text-red-600">{actionData.id}</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end space-x-2 border-t pt-4">
                        <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSubmitting ? (
                                <LoaderCircle className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <PencilLine className="w-4 h-4 mr-2" />
                            )}
                            {isSubmitting ? "Sending..." : "Send request"}
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    )
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "model", action: "edit" });

    const model = await getModel(params.id as string);
    if (!model) {
        throw new Response("Not Found", { status: 404 });
    }
    return json(model);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "model", action: "edit" });

    if (request.method !== "PATCH") {
        return json({ error: "Invalid request method." });
    }

    try {
        const formData = await request.formData();
        const reason = ((formData.get("reason") as string) || "").trim().slice(0, 500);
        const res = await requestModelRevision(params.id as string, userId, reason);
        if (res.id) {
            return redirect(
                "/dashboard/models/approval?success=Change+request+sent+to+the+model"
            );
        }
    } catch (error: any) {
        console.log("REQUEST_MODEL_REVISION_FAILED", error);
        return error?.fieldErrors ?? error?.errors ?? error;
    }

    return json({ error: "Invalid request method." });
}

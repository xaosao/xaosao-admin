import { Crown, AlertTriangle } from "lucide-react";
import { Form, json, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

// services
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { prisma } from "~/services/database.server";
import { createAuditLogs } from "~/services/log.server";

export default function ToggleVipModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const model = useLoaderData<typeof loader>();
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";

    function closeHandler() {
        navigate("..");
    }

    const willBeVip = !model.vip;

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-96 p-4">
            <div className="space-y-4">
                <div className="text-center">
                    <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${willBeVip ? "bg-amber-100" : "bg-gray-100"}`}>
                        <Crown className={`h-7 w-7 ${willBeVip ? "text-amber-500" : "text-gray-400"}`} />
                    </div>
                    <h3 className={`text-lg font-bold ${willBeVip ? "text-amber-600" : "text-gray-700"}`}>
                        {willBeVip ? "Set VIP Status" : "Remove VIP Status"}
                    </h3>
                </div>

                {/* Model Info */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={model.profile ?? ""} />
                        <AvatarFallback>{model.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-gray-900">{model.firstName} {model.lastName || ""}</p>
                        <p className="text-xs text-gray-500">Current: {model.vip ? "VIP" : "Normal"}</p>
                    </div>
                    {model.vip && (
                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold">
                            <Crown className="h-3 w-3" /> VIP
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${willBeVip ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${willBeVip ? "text-amber-500" : "text-gray-400"}`} />
                    <p className={`text-sm ${willBeVip ? "text-amber-700" : "text-gray-600"}`}>
                        {willBeVip
                            ? "This model will appear on the VIP tab and be more visible to customers. An SMS will be sent to notify the model."
                            : "This model will be removed from the VIP tab. An SMS will be sent to notify the model."
                        }
                    </p>
                </div>

                <Form method="patch">
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className={willBeVip
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "bg-gray-600 hover:bg-gray-700 text-white"
                            }
                        >
                            {isSubmitting
                                ? "Processing..."
                                : willBeVip ? "Confirm Set VIP" : "Confirm Remove VIP"
                            }
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "model", action: "edit" });

    const model = await prisma.model.findUnique({
        where: { id: params.id! },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: true,
            whatsapp: true,
            vip: true,
        },
    });

    if (!model) {
        throw new Response("Model not found", { status: 404 });
    }

    return json(model);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "model", action: "edit" });

    const modelId = params.id!;

    const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: { id: true, firstName: true, lastName: true, whatsapp: true, vip: true },
    });

    if (!model) {
        throw new Response("Model not found", { status: 404 });
    }

    const newVipStatus = !model.vip;

    await prisma.model.update({
        where: { id: modelId },
        data: { vip: newVipStatus },
    });

    await createAuditLogs({
        action: "TOGGLE_VIP",
        user: userId,
        description: `${newVipStatus ? "Enabled" : "Disabled"} VIP for model ${model.firstName} ${model.lastName || ""} (${modelId})`,
        status: "success",
        onSuccess: { modelId, vip: newVipStatus },
    });

    // Send SMS to model
    try {
        const { sendSMS } = await import("~/services/email.server");
        if (model.whatsapp) {
            const phone = model.whatsapp.toString();
            const message = newVipStatus
                ? "XaoSao: ຊົມເຊີຍ! ທ່ານໄດ້ຮັບສະຖານະ VIP ແລ້ວ. ລູກຄ້າຈະເຫັນທ່ານຫຼາຍຂຶ້ນ!"
                : "XaoSao: ສະຖານະ VIP ຂອງທ່ານໄດ້ຖືກຍົກເລີກແລ້ວ.";
            sendSMS(phone, message).catch((err) =>
                console.error("Failed to send VIP SMS:", err)
            );
        }
    } catch (e) {
        console.error("VIP SMS error (non-fatal):", e);
    }

    return redirect("/dashboard/models?success=VIP+status+updated+successfully");
}

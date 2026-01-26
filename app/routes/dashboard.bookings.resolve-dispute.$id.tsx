import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Form, json, useLoaderData, useNavigate, useNavigation, useActionData } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

// services
import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { getBookingById } from "~/services/booking.server";
import { adminResolveDispute } from "~/services/booking.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
    await requireUserPermission(request, "booking", "edit");
    const booking = await getBookingById(params.id!);

    if (!booking) {
        throw new Response("Booking not found", { status: 404 });
    }

    if (booking.status !== "disputed") {
        throw new Response("Only disputed bookings can be resolved", { status: 400 });
    }

    return json(booking);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const adminId = await requireUserSession(request);
    await requireUserPermission(request, "booking", "edit");

    const formData = await request.formData();
    const resolution = formData.get("resolution") as "released" | "refunded";

    if (!resolution || (resolution !== "released" && resolution !== "refunded")) {
        return json({
            success: false,
            error: "Invalid resolution type"
        }, { status: 400 });
    }

    try {
        await adminResolveDispute(params.id!, adminId, resolution);
        return redirect("/dashboard/bookings?toastMessage=Dispute+resolved+successfully&toastType=success");
    } catch (error: any) {
        return json({
            success: false,
            error: error.message || "Failed to resolve dispute"
        }, { status: 500 });
    }
}

export default function ResolveDisputeModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";
    const booking = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();

    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("booking", "edit");

    if (!canEdit) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        );
    }

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-md font-bold text-orange-500">
                        <AlertTriangle className="h-5 w-5" />&nbsp;Resolve Dispute
                    </h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2">
                        Review and resolve the dispute for Booking #{booking.id}
                    </p>
                </div>

                {/* Booking Information */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Booking ID</p>
                                <p className="font-medium">{booking.id}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Amount</p>
                                <p className="font-medium">{booking.price.toLocaleString()} LAK</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Customer</p>
                                <p className="font-medium">{booking.customer?.firstName} {booking.customer?.lastName}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Model</p>
                                <p className="font-medium">{booking.model?.firstName} {booking.model?.lastName}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-500">Dispute Reason</p>
                                <p className="font-medium text-orange-600">{booking.disputeReason || "No reason provided"}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-gray-500">Disputed At</p>
                                <p className="font-medium">
                                    {booking.disputedAt ? new Date(booking.disputedAt).toLocaleString() : "N/A"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Resolution Options */}
                <div className="space-y-3">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800">
                                <p className="font-medium">Important Decision</p>
                                <p>
                                    Contact the model directly to get details about the dispute before making a decision.
                                    Your decision is final and will immediately release payment or issue a refund.
                                </p>
                            </div>
                        </div>
                    </div>

                    {actionData?.error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start space-x-3">
                                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                <p className="text-sm text-red-800">{actionData.error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={closeHandler}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>

                    <Form method="post" className="inline">
                        <input type="hidden" name="resolution" value="refunded" />
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={isSubmitting}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            <XCircle className="h-4 w-4 mr-1" />
                            Refund Customer
                        </Button>
                    </Form>

                    <Form method="post" className="inline">
                        <input type="hidden" name="resolution" value="released" />
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-emerald-500 hover:bg-emerald-600"
                        >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Release to Model
                        </Button>
                    </Form>
                </div>
            </div>
        </Modal>
    );
}

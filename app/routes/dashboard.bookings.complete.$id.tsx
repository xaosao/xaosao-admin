import { CheckCircle, AlertTriangle, UserCheck, Calculator } from "lucide-react";
import { Form, json, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

// services
import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { getBookingById, completeBooking } from "~/services/booking.server";

interface LoaderData {
    booking: any;
    commission: number;
    commissionAmount: number;
    netAmount: number;
}

export default function CompleteBookingModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const { booking, commission, commissionAmount, netAmount } = useLoaderData<LoaderData>();
    const model = booking?.model;

    const totalAmount = booking.price;

    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("booking", "edit") || hasPermission("transaction", "edit");

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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-md font-bold text-green-500">
                        <CheckCircle className="h-5 w-5" />&nbsp;Complete Booking
                    </h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2">
                        Release payment to the model with commission deduction.
                    </p>
                </div>
                <div className="space-y-4">
                    {/* Model Info */}
                    <Card>
                        <CardContent className="p-4 rounded border border-green-500 bg-green-50">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={model?.profile ?? ""} />
                                        <AvatarFallback>{model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm text-gray-600">
                                            {model?.firstName ?? "Unknown"}&nbsp;{model?.lastName ?? ""}
                                        </p>
                                        <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                            <UserCheck className="h-3 w-3" />&nbsp;Model
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-green-200">
                                    <p className="text-sm text-gray-600">
                                        Service: {booking.modelService?.service?.name}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Commission Calculation */}
                    <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-blue-800">Payment Calculation</h4>
                                    <div className="mt-3 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Amount:</span>
                                            <span className="font-medium">{totalAmount.toLocaleString()} LAK</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Service Commission ({commission}%):</span>
                                            <span className="font-medium text-red-600">- {commissionAmount.toLocaleString()} LAK</span>
                                        </div>
                                        <div className="border-t border-blue-200 pt-2 mt-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold text-gray-700">Model Receives:</span>
                                                <span className="font-bold text-green-600 text-lg">{netAmount.toLocaleString()} LAK</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Warning */}
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-yellow-800">Completion Impact</h4>
                                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                                        <li>• Booking status will be changed to "completed"</li>
                                        <li>• {netAmount.toLocaleString()} LAK will be added to model's wallet</li>
                                        <li>• {commissionAmount.toLocaleString()} LAK commission will be retained by platform</li>
                                        <li>• This action cannot be undone</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Form method="patch" className="space-y-4">
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                                {isSubmitting ? "Processing..." : "Complete & Release Payment"}
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </Modal>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "edit",
    });

    const booking = await getBookingById(params.id!);
    if (!booking) {
        throw new Response("Booking not found", { status: 404 });
    }

    // Only allow complete for confirmed or disputed bookings that haven't been released
    if (!["confirmed", "disputed"].includes(booking.status) || booking.paymentStatus === "released") {
        throw new Response("Booking is not eligible for completion", { status: 400 });
    }

    // Calculate commission
    const totalAmount = booking.price;
    const commissionRate = booking.modelService?.service?.commission || 0;
    const commissionAmount = Math.floor((totalAmount * commissionRate) / 100);
    const netAmount = totalAmount - commissionAmount;

    return json({
        booking,
        commission: commissionRate,
        commissionAmount,
        netAmount,
    });
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "edit",
    });

    const bookingId = params.id;

    if (request.method === "PATCH") {
        try {
            const res = await completeBooking(bookingId as string, userId);
            if (res.earningTransaction?.id) {
                return redirect("/dashboard/bookings?success=Booking+completed+successfully");
            }
        } catch (error: any) {
            console.log("COMPLETE_BOOKING_FAILED", error);
            const errorMessage = error?.message || "Failed to complete booking";
            return redirect(`/dashboard/bookings?error=${encodeURIComponent(errorMessage)}`);
        }
    }

    return json({ error: "Invalid request method." });
}

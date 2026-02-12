import { RotateCcw, AlertTriangle, Users } from "lucide-react";
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
import { getBookingById, refundBooking } from "~/services/booking.server";

export default function RefundBookingModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const booking = useLoaderData<typeof loader>();

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

    const amount = booking.price;

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-md font-bold text-orange-500">
                        <RotateCcw className="h-5 w-5" />&nbsp;Refund Booking
                    </h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2">
                        Refund the booking payment back to the customer's wallet.
                    </p>
                </div>
                <div className="space-y-4">
                    {/* Customer Info */}
                    <Card>
                        <CardContent className="p-4 rounded border border-orange-500 bg-orange-50">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={booking.customer?.profile ?? ""} />
                                        <AvatarFallback>{booking.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm text-gray-600">
                                            {booking.customer?.firstName ?? "Unknown"}&nbsp;{booking.customer?.lastName ?? ""}
                                        </p>
                                        <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                            <Users className="h-3 w-3" />&nbsp;Customer
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-orange-200">
                                    <p className="text-sm text-gray-600">Service: {booking.modelService?.service?.name}</p>
                                    <p className="text-sm text-gray-600">Amount to refund:</p>
                                    <p className="text-xl font-bold text-orange-600">
                                        {amount.toLocaleString()} LAK
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Warning */}
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-orange-800">Refund Impact</h4>
                                    <ul className="text-sm text-orange-700 mt-1 space-y-1">
                                        <li>• Booking status will be changed to "cancelled"</li>
                                        <li>• {amount.toLocaleString()} LAK will be returned to customer's wallet</li>
                                        <li>• The model will not receive payment for this booking</li>
                                        <li>• This action cannot be undone</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Form method="patch" className="space-y-4">
                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                Refund Reason (optional)
                            </label>
                            <textarea
                                id="reason"
                                name="reason"
                                rows={2}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="Enter reason for refund..."
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">
                                {isSubmitting ? "Processing..." : "Refund"}
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
        group: "booking",
        action: "edit",
    });

    const booking = await getBookingById(params.id!);
    if (!booking) {
        throw new Response("Booking not found", { status: 404 });
    }

    // Admin can refund pending, confirmed, or disputed bookings (not already refunded)
    if (!["pending", "confirmed", "disputed"].includes(booking.status) || booking.paymentStatus === "refunded") {
        throw new Response("Booking is not eligible for refund. Only pending, confirmed, or disputed bookings can be refunded.", { status: 400 });
    }

    return json(booking);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "booking",
        action: "edit",
    });

    const bookingId = params.id;

    if (request.method === "PATCH") {
        try {
            const formData = await request.formData();
            const reason = formData.get("reason") as string | undefined;

            const res = await refundBooking(bookingId as string, userId, reason || undefined);
            if (res.id) {
                return redirect("/dashboard/bookings?success=Booking+refunded+successfully");
            }
        } catch (error: any) {
            console.log("REFUND_BOOKING_FAILED", error);
            const errorMessage = error?.message || "Failed to refund booking";
            return redirect(`/dashboard/bookings?error=${encodeURIComponent(errorMessage)}`);
        }
    }

    return json({ error: "Invalid request method." });
}

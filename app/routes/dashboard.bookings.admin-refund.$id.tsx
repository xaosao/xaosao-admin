import { useState, useEffect } from "react";
import { ShieldAlert, AlertTriangle, Users, Loader2, Mail } from "lucide-react";
import { json, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

// services
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getBookingById, sendAdminRefundCode, verifyAndRefundCompletedBooking } from "~/services/booking.server";
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";

export default function AdminRefundBookingModal() {
    const navigate = useNavigate();
    const fetcher = useFetcher<any>();
    const booking = useLoaderData<typeof loader>();
    const [step, setStep] = useState<"confirm" | "verify">("confirm");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");

    const isSubmitting = fetcher.state !== "idle";

    function closeHandler() {
        navigate("..");
    }

    const amount = booking.price;
    const commissionRate = booking.modelService?.service?.commission || 10;
    const modelReceived = Math.floor(amount * (1 - commissionRate / 100));
    const customerRefund = modelReceived;
    const modelDeduct = modelReceived;

    // Handle fetcher response
    useEffect(() => {
        if (fetcher.state !== "idle" || !fetcher.data) return;
        if (fetcher.data.codeSent) {
            setStep("verify");
            setError("");
        } else if (fetcher.data.error) {
            setError(fetcher.data.error);
        }
    }, [fetcher.state, fetcher.data]);

    const handleSendCode = () => {
        setError("");
        fetcher.submit(
            { intent: "send-code" },
            { method: "post" }
        );
    };

    const handleVerify = () => {
        if (code.length !== 6) {
            setError("Please enter a 6-digit code.");
            return;
        }
        setError("");
        fetcher.submit(
            { intent: "verify", code },
            { method: "post" }
        );
    };

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-md font-bold text-red-600">
                        <ShieldAlert className="h-5 w-5" />&nbsp;Admin Refund Completed Booking
                    </h3>
                    <p className="text-gray-500 text-sm ml-6 mt-1">
                        Refund a completed booking. Requires email verification.
                    </p>
                </div>

                {/* Booking Info */}
                <Card>
                    <CardContent className="p-4 rounded border border-red-200 bg-red-50">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={booking.customer?.profile ?? ""} />
                                        <AvatarFallback>{booking.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">{booking.customer?.firstName ?? "Unknown"} {booking.customer?.lastName ?? ""}</p>
                                        <p className="text-xs text-gray-500 flex items-center"><Users className="h-3 w-3 mr-1" />Customer</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={booking.model?.profile ?? ""} />
                                        <AvatarFallback>{booking.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium">{booking.model?.firstName ?? "Unknown"} {booking.model?.lastName ?? ""}</p>
                                        <p className="text-xs text-gray-500 flex items-center"><Users className="h-3 w-3 mr-1" />Model</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-red-200">
                                <p className="text-sm text-gray-600">Service: <strong>{booking.modelService?.service?.name}</strong></p>
                                <p className="text-sm text-gray-600">Booking Amount: <strong>{amount.toLocaleString()} LAK</strong></p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Breakdown */}
                <Card className="border-gray-200">
                    <CardContent className="p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Refund Breakdown</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Model received on completion ({100 - commissionRate}%)</span>
                                <span>{modelReceived.toLocaleString()} LAK</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t">
                                <span className="text-green-700">Customer receives</span>
                                <span className="font-bold text-green-700">+{customerRefund.toLocaleString()} LAK</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-600">Model deducted</span>
                                <span className="font-bold text-red-600">-{modelDeduct.toLocaleString()} LAK</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 pt-1 border-t">
                                <span>System commission (already taken at {commissionRate}%)</span>
                                <span>{(amount - modelReceived).toLocaleString()} LAK</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Warning */}
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-3">
                        <div className="flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-orange-700 space-y-1">
                                <p>This action cannot be undone.</p>
                                <p>Only 1 completed booking refund is allowed per day.</p>
                                <p>A 6-digit verification code will be sent to the admin email.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                        {error}
                    </div>
                )}

                {/* Step 1: Confirm & Send Code */}
                {step === "confirm" && (
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSendCode}
                            disabled={isSubmitting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending Code...</>
                            ) : (
                                <><Mail className="h-4 w-4 mr-2" />Send Verification Code</>
                            )}
                        </Button>
                    </div>
                )}

                {/* Step 2: Enter Code & Verify */}
                {step === "verify" && (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Enter 6-digit verification code
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Code sent to admin email. Expires in 5 minutes.</p>
                            <input
                                type="text"
                                maxLength={6}
                                value={code}
                                onChange={(e) => {
                                    setError("");
                                    setCode(e.target.value.replace(/\D/g, ""));
                                }}
                                className="w-full text-center text-2xl tracking-[12px] font-bold rounded-md border border-gray-300 px-3 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="000000"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStep("confirm");
                                    setCode("");
                                    setError("");
                                }}
                                disabled={isSubmitting}
                                className="text-sm text-gray-500"
                            >
                                Resend Code
                            </Button>
                            <div className="flex space-x-2">
                                <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleVerify}
                                    disabled={isSubmitting || code.length !== 6}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                                    ) : (
                                        "Verify & Refund"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
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

    if (booking.status !== "completed") {
        throw new Response("Only completed bookings can be admin-refunded.", { status: 400 });
    }

    if (booking.paymentStatus === "refunded") {
        throw new Response("This booking has already been refunded.", { status: 400 });
    }

    const daysSinceBooking = (new Date().getTime() - new Date(booking.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceBooking > 7) {
        throw new Response("Admin refund is only available for bookings within the last 7 days.", { status: 400 });
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

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "send-code") {
        try {
            await sendAdminRefundCode(params.id!, userId);
            return json({ codeSent: true });
        } catch (error: any) {
            return json({ error: error.message || "Failed to send verification code." });
        }
    }

    if (intent === "verify") {
        const code = formData.get("code") as string;
        if (!code || code.length !== 6) {
            return json({ error: "Please enter a valid 6-digit code." });
        }

        try {
            await verifyAndRefundCompletedBooking(params.id!, userId, code);
            return redirect("/dashboard/bookings?success=Completed+booking+refunded+successfully");
        } catch (error: any) {
            return json({ error: error.message || "Failed to process refund." });
        }
    }

    return json({ error: "Invalid request." });
}

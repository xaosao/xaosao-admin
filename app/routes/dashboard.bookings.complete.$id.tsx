import { CheckCircle, AlertTriangle, UserCheck, Calculator, Users } from "lucide-react";
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
import { prisma } from "~/services/database.server";

interface LoaderData {
    booking: any;
    commission: number;
    commissionAmount: number;
    netAmount: number;
    // Referral commission info
    referrer: {
        id: string;
        firstName: string;
        lastName: string | null;
        type: string;
        profile: string | null;
        totalReferredModels: number;
        isEligible: boolean;
        commissionRate: number;
        commissionAmount: number;
    } | null;
}

export default function CompleteBookingModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH";
    const { booking, commission, commissionAmount, netAmount, referrer } = useLoaderData<LoaderData>();
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
                                        {/* Show commission breakdown if referrer is eligible */}
                                        {referrer?.isEligible && (
                                            <div className="ml-4 pl-2 border-l-2 border-blue-200 space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">→ Platform ({commission - referrer.commissionRate}%):</span>
                                                    <span className="text-gray-600">{(commissionAmount - referrer.commissionAmount).toLocaleString()} LAK</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-purple-600">→ Referrer ({referrer.commissionRate}%):</span>
                                                    <span className="text-purple-600">{referrer.commissionAmount.toLocaleString()} LAK</span>
                                                </div>
                                            </div>
                                        )}
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

                    {/* Referral Commission - Only show if model has referrer */}
                    {referrer && (
                        <Card className={`${referrer.isEligible ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                            <CardContent className="p-4">
                                <div className="flex items-start space-x-3">
                                    <Users className={`h-5 w-5 mt-0.5 ${referrer.isEligible ? 'text-purple-600' : 'text-gray-400'}`} />
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-semibold ${referrer.isEligible ? 'text-purple-800' : 'text-gray-600'}`}>
                                            Referral Commission {referrer.isEligible ? '(From Service Commission)' : ''}
                                        </h4>
                                        <div className="mt-2 flex items-center space-x-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={referrer.profile ?? ""} />
                                                <AvatarFallback>{referrer.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm text-gray-700">{referrer.firstName} {referrer.lastName ?? ""}</p>
                                                <p className="text-xs text-gray-500">
                                                    {referrer.type === 'partner' ? 'Partner' : referrer.type === 'special' ? 'Special' : 'Normal'} Model
                                                    {' · '}{referrer.totalReferredModels} referrals
                                                </p>
                                            </div>
                                        </div>
                                        {referrer.isEligible ? (
                                            <div className="mt-3 p-2 bg-purple-100 rounded">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-purple-700">Referral Commission ({referrer.commissionRate}% of booking):</span>
                                                    <span className="font-semibold text-purple-800">{referrer.commissionAmount.toLocaleString()} LAK</span>
                                                </div>
                                                <p className="text-xs text-purple-600 mt-1">
                                                    Deducted from {commission}% service commission → Platform receives {commission - referrer.commissionRate}%
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-xs text-gray-500">
                                                Not eligible for commission (needs 2+ referrals or special/partner type)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                        {referrer?.isEligible ? (
                                            <>
                                                <li>• {(commissionAmount - referrer.commissionAmount).toLocaleString()} LAK commission retained by platform</li>
                                                <li>• {referrer.commissionAmount.toLocaleString()} LAK referral commission to {referrer.firstName}</li>
                                            </>
                                        ) : (
                                            <li>• {commissionAmount.toLocaleString()} LAK commission retained by platform</li>
                                        )}
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
        group: "booking",
        action: "edit",
    });

    const booking = await getBookingById(params.id!);
    if (!booking) {
        throw new Response("Booking not found", { status: 404 });
    }

    // Admin can complete pending, confirmed, or disputed bookings (not already released)
    if (!["pending", "confirmed", "disputed"].includes(booking.status) || booking.paymentStatus === "released") {
        throw new Response("Booking is not eligible for completion. Only pending, confirmed, or disputed bookings can be completed.", { status: 400 });
    }

    // Calculate commission
    const totalAmount = booking.price;
    const commissionRate = booking.modelService?.service?.commission || 0;
    const commissionAmount = Math.floor((totalAmount * commissionRate) / 100);
    const netAmount = totalAmount - commissionAmount;

    // Check if model has a referrer and get referrer info
    let referrer = null;
    if (booking.model?.referredById) {
        const referrerModel = await prisma.model.findUnique({
            where: { id: booking.model.referredById },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                type: true,
                profile: true,
                totalReferredModels: true,
            }
        });

        if (referrerModel) {
            // Check if referrer is eligible for commission
            // Must be special/partner type AND have >= 2 referred models
            const MIN_REFERRED_MODELS = 2;
            const isSpecialOrPartner = referrerModel.type === "special" || referrerModel.type === "partner";
            const hasMinReferrals = (referrerModel.totalReferredModels || 0) >= MIN_REFERRED_MODELS;
            const isEligible = isSpecialOrPartner && hasMinReferrals;

            // Commission rates: 2% for special, 4% for partner
            const referralCommissionRate = referrerModel.type === "partner" ? 4 : 2;
            const referralCommissionAmount = isEligible ? Math.floor((totalAmount * referralCommissionRate) / 100) : 0;

            referrer = {
                id: referrerModel.id,
                firstName: referrerModel.firstName,
                lastName: referrerModel.lastName,
                type: referrerModel.type,
                profile: referrerModel.profile,
                totalReferredModels: referrerModel.totalReferredModels || 0,
                isEligible,
                commissionRate: referralCommissionRate,
                commissionAmount: referralCommissionAmount,
            };
        }
    }

    return json({
        booking,
        commission: commissionRate,
        commissionAmount,
        netAmount,
        referrer,
    });
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

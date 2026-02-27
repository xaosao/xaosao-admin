import { json, useLoaderData, useNavigate } from "@remix-run/react";
import {
    Eye,
    Users,
    UserCheck,
    Calendar,
    MapPin,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    DollarSign,
    Phone,
    Mail,
    Shirt,
    Coins,
} from "lucide-react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

// services
import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { getBookingById } from "~/services/booking.server";
import { formatDate1 } from "~/utils";

// Status badge configuration
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: "Pending", color: "text-yellow-800", bgColor: "bg-yellow-100 border-yellow-200" },
    confirmed: { label: "Confirmed", color: "text-blue-800", bgColor: "bg-blue-100 border-blue-200" },
    completed: { label: "Completed", color: "text-green-800", bgColor: "bg-green-100 border-green-200" },
    cancelled: { label: "Cancelled", color: "text-gray-800", bgColor: "bg-gray-100 border-gray-200" },
    rejected: { label: "Rejected", color: "text-red-800", bgColor: "bg-red-100 border-red-200" },
    disputed: { label: "Disputed", color: "text-orange-800", bgColor: "bg-orange-100 border-orange-200" },
};

const paymentStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending: { label: "Pending", color: "text-yellow-800", bgColor: "bg-yellow-100" },
    held: { label: "Held", color: "text-blue-800", bgColor: "bg-blue-100" },
    pending_release: { label: "Pending Release", color: "text-purple-800", bgColor: "bg-purple-100" },
    released: { label: "Released", color: "text-green-800", bgColor: "bg-green-100" },
    refunded: { label: "Refunded", color: "text-orange-800", bgColor: "bg-orange-100" },
};

export default function ViewBookingModal() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const booking = useLoaderData<typeof loader>();

    function closeHandler() {
        navigate("..");
    }

    const canAccess = hasPermission("booking", "view");

    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        );
    }

    const statusInfo = statusConfig[booking.status] || statusConfig.pending;
    const paymentInfo = paymentStatusConfig[booking.paymentStatus] || paymentStatusConfig.pending;

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5 max-h-[90vh] overflow-y-auto p-4">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="flex items-center text-lg font-bold text-gray-900">
                        <Eye className="h-5 w-5 mr-2" />
                        Booking Details
                    </h3>
                    <div className="flex gap-2">
                        <span className={`inline-flex items-center px-3 py-1 text-sm rounded-full border ${statusInfo.bgColor} ${statusInfo.color}`}>
                            {statusInfo.label}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 text-sm rounded-full ${paymentInfo.bgColor} ${paymentInfo.color}`}>
                            {paymentInfo.label}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Info */}
                    <Card className="border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4 text-blue-600" />
                                <h4 className="font-semibold text-blue-800">Customer</h4>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={booking.customer?.profile ?? ""} />
                                    <AvatarFallback>{booking.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {booking.customer?.firstName ?? "Unknown"} {booking.customer?.lastName ?? ""}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {booking.customer?.age ? `${booking.customer.age} years old` : "Age N/A"} • {booking.customer?.gender ?? "N/A"}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1 text-sm">
                                {booking.customer?.whatsapp && (
                                    <p className="flex items-center text-gray-600">
                                        <Phone className="h-3 w-3 mr-2" />
                                        {booking.customer.whatsapp}
                                    </p>
                                )}
                                {booking.customer?.email && (
                                    <p className="flex items-center text-gray-600">
                                        <Mail className="h-3 w-3 mr-2" />
                                        {booking.customer.email}
                                    </p>
                                )}
                            </div>
                            {/* Customer Check-in Status */}
                            <div className="mt-3 pt-3 border-t">
                                {booking.customerCheckedInAt ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                                        <CheckCircle className="h-3 w-3" />
                                        Checked in at {formatDate1(booking.customerCheckedInAt)}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                                        <Clock className="h-3 w-3" />
                                        Not checked in
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Model Info */}
                    <Card className="border-pink-200">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <UserCheck className="h-4 w-4 text-pink-600" />
                                <h4 className="font-semibold text-pink-800">Model</h4>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={booking.model?.profile ?? ""} />
                                    <AvatarFallback>{booking.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {booking.model?.firstName ?? "Unknown"} {booking.model?.lastName ?? ""}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {booking.model?.age ? `${booking.model.age} years old` : "Age N/A"} • {booking.model?.gender ?? "N/A"}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1 text-sm">
                                {booking.model?.whatsapp && (
                                    <p className="flex items-center text-gray-600">
                                        <Phone className="h-3 w-3 mr-2" />
                                        {booking.model.whatsapp}
                                    </p>
                                )}
                            </div>
                            {/* Model Check-in Status */}
                            <div className="mt-3 pt-3 border-t">
                                {booking.modelCheckedInAt ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                                        <CheckCircle className="h-3 w-3" />
                                        Checked in at {formatDate1(booking.modelCheckedInAt)}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                                        <Clock className="h-3 w-3" />
                                        Not checked in
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Service & Booking Details */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="h-4 w-4 text-gray-600" />
                            <h4 className="font-semibold text-gray-800">Booking Information</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Service</p>
                                    <p className="font-medium">{booking.modelService?.service?.name ?? "Unknown Service"}</p>
                                    <p className="text-xs text-gray-500">{booking.modelService?.service?.billingType ?? ""}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Price</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-green-600 text-lg">{booking.price?.toLocaleString()} LAK</p>
                                        {booking.hasTip && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
                                                <Coins className="h-3 w-3" />
                                                Has Tip
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Commission Rate</p>
                                    <p className="font-medium">{booking.modelService?.service?.commission ?? 0}%</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase">Start Date</p>
                                    <p className="font-medium">{formatDate1(booking.startDate)}</p>
                                </div>
                                {booking.endDate && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">End Date</p>
                                        <p className="font-medium">{formatDate1(booking.endDate)}</p>
                                    </div>
                                )}
                                {booking.dayAmount > 0 && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Days</p>
                                        <p className="font-medium">{booking.dayAmount} day(s)</p>
                                    </div>
                                )}
                                {booking.hours && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Hours</p>
                                        <p className="font-medium">{booking.hours} hour(s)</p>
                                    </div>
                                )}
                                {booking.sessionType && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Session Type</p>
                                        <p className="font-medium capitalize">{booking.sessionType.replace("_", " ")}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Location & Preferences */}
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="h-4 w-4 text-gray-600" />
                                    <p className="text-xs text-gray-500 uppercase">Location</p>
                                </div>
                                <p className="font-medium">{booking.location}</p>
                            </div>
                            {booking.preferredAttire && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shirt className="h-4 w-4 text-gray-600" />
                                        <p className="text-xs text-gray-500 uppercase">Preferred Attire</p>
                                    </div>
                                    <p className="font-medium">{booking.preferredAttire}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Dispute Information (if disputed) */}
                {booking.status === "disputed" && (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                                <h4 className="font-semibold text-orange-800">Dispute Information</h4>
                            </div>
                            <div className="space-y-2">
                                {booking.disputeReason && (
                                    <div>
                                        <p className="text-xs text-orange-600 uppercase">Reason</p>
                                        <p className="font-medium text-orange-900">{booking.disputeReason}</p>
                                    </div>
                                )}
                                {booking.disputedAt && (
                                    <div>
                                        <p className="text-xs text-orange-600 uppercase">Disputed At</p>
                                        <p className="text-sm text-orange-800">{formatDate1(booking.disputedAt)}</p>
                                    </div>
                                )}
                                {booking.disputeResolution && (
                                    <div>
                                        <p className="text-xs text-orange-600 uppercase">Resolution</p>
                                        <p className="font-medium text-orange-900 capitalize">{booking.disputeResolution}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Rejection Reason (if rejected) */}
                {booking.status === "rejected" && booking.rejectReason && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <h4 className="font-semibold text-red-800">Rejection Reason</h4>
                            </div>
                            <p className="text-red-900">{booking.rejectReason}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Timestamps */}
                <div className="flex justify-between text-xs text-gray-400 pt-2 border-t">
                    <span>Created: {formatDate1(booking.createdAt)}</span>
                    {booking.completedAt && <span>Completed: {formatDate1(booking.completedAt)}</span>}
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Close
                    </Button>
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
        action: "view",
    });

    const booking = await getBookingById(params.id!);
    if (!booking) {
        throw new Response("Booking not found", { status: 404 });
    }

    return json(booking);
}

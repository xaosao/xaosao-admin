import { useState } from "react"
import { json } from "react-router"
import { LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"
import { User, Clock, FileText, Check, X, Download, Calendar, DollarSign, Users, UserCheck, Mars, Venus, Building2, CreditCard, QrCode, Maximize2 } from "lucide-react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Separator } from "~/components/ui/separator"

// utils and service
import { formatDate } from "~/utils"
import { useAuthStore } from "~/store/permissionStore"
import { downloadImage } from "~/utils/functions/download"
import { getTransaction } from "~/services/transaction.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function TransactionDetails() {
    const navigate = useNavigate();
    const transaction = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const owner = transaction.model || transaction.customer;
    const [showQrFullscreen, setShowQrFullscreen] = useState(false);

    const handleDownloadSlip = async () => {
        if (transaction?.paymentSlip) {
            downloadImage(transaction.paymentSlip, `payment-slip-${transaction.identifier}.jpg`);
        }
    };

    function closeHandler() {
        navigate("..");
    }

    const canAccess = hasPermission("transaction", "view");
    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        )
    }

    // Get status badge style
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return "bg-green-100 text-green-700 border-green-200";
            case "rejected":
                return "bg-red-100 text-red-700 border-red-200";
            default:
                return "bg-yellow-100 text-yellow-700 border-yellow-200";
        }
    };

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-4/5 lg:w-3/5 p-4 max-h-[90vh] overflow-y-auto">
            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="flex items-center text-black text-lg font-bold">Transaction Details</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm  border capitalize ${getStatusBadge(transaction.status)}`}>
                        {transaction.status}
                    </span>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <User className="h-5 w-5 mr-2" />
                            User Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <div>
                            {transaction.identifier === "payment" ? (
                                <div className="flex items-center justify-start">
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={transaction.customer.profile} />
                                            <AvatarFallback>{transaction.customer.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm  text-gray-900">{transaction.customer.firstName} {transaction.customer.lastName}</p>
                                            <p className="flex items-center justify-start text-xs  text-gray-500"><Users className="h-3 w-3" />&nbsp;Customer</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 pl-4">
                                        <div className="text-xs text-gray-400">→</div>
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={transaction.model.profile} />
                                            <AvatarFallback>{transaction.model.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-gray-600">{transaction.model.firstName}&nbsp;{transaction.model.lastName}</p>
                                            <p className="flex items-center justify-start text-xs  text-gray-500">
                                                <UserCheck className="h-3 w-3" />&nbsp;Model
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-3">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={owner?.profile} />
                                        <AvatarFallback>{owner?.firstName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm  text-gray-900">{owner?.firstName}&nbsp;{owner?.lastName}</p>
                                        <p className="flex items-center justify-start text-xs  text-gray-500">
                                            {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"}
                                            {owner?.gender && (
                                                <>
                                                    &nbsp;•&nbsp;
                                                    {owner.gender === "male" ? <Mars className="h-3 w-3" /> : <Venus className="h-3 w-3" />}
                                                    &nbsp;{owner.gender}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            {/* Created */}
                            <div className="flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-blue-50">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex items-center justify-start gap-2">
                                    <p className=" text-sm">Transaction Created:</p>
                                    <p className="text-xs text-gray-500">{formatDate(transaction?.createdAt)}</p>
                                </div>
                            </div>

                            {/* Approved */}
                            {transaction?.status === "approved" && (
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-green-50">
                                        <Check className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div className="flex items-center justify-start gap-2">
                                        <p className=" text-sm">Transaction Approved:</p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(transaction?.updatedAt)} • by {transaction?.ApprovedBy?.firstName}&nbsp;{transaction?.ApprovedBy?.lastName}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Rejected */}
                            {transaction?.status === "rejected" && (
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-red-50">
                                        <X className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="flex items-center justify-start gap-2">
                                        <p className=" text-sm">Transaction Rejected:</p>
                                        <p className="text-xs text-gray-500">
                                            {formatDate(transaction?.updatedAt)} • by {transaction?.RejectedBy?.firstName}&nbsp;{transaction?.RejectedBy?.lastName}
                                        </p>
                                        {transaction?.rejectReason && (
                                            <p className="text-xs text-red-600 mt-1">Reason: {transaction.rejectReason}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Pending */}
                            {transaction?.status === "pending" && (
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 rounded-lg bg-yellow-50">
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                    </div>
                                    <div className="flex items-center justify-start gap-2">
                                        <p className=" text-sm">Awaiting Review:</p>
                                        <p className="text-xs text-gray-500">Transaction is pending admin approval</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <FileText className="h-5 w-5 mr-2" />
                            Transaction Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-1">
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm  text-gray-500 tracking-wide">Transaction ID:</label>
                                <p className="mtext-sm text-gray-900">{transaction?.id}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm  text-gray-500 tracking-wide">Type:</label>
                                <p className="text-sm  text-gray-900">{transaction?.identifier?.replace(/_/g, ' ')}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm  text-gray-500 tracking-wide">Amount:</label>
                                <p className={` text-lg font-semibold ${transaction.identifier === "withdrawal" ? "text-red-600" : "text-green-600"}`}>
                                    {transaction.identifier === "withdrawal" ? "-" : "+"}{transaction.amount?.toLocaleString()} Kip
                                </p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm  text-gray-500 tracking-wide">Created At:</label>
                                <p className="text-sm text-gray-900">{formatDate(transaction?.createdAt)}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm  text-gray-500 tracking-wide">Last Updated:</label>
                                <p className="text-sm text-gray-900">{formatDate(transaction?.updatedAt)}</p>
                            </div>
                            {transaction?.reason && (
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <label className="text-sm  text-gray-500 tracking-wide">Description:</label>
                                    <p className="mt-1 text-sm text-gray-900">{transaction.reason}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {transaction.identifier === "withdrawal" && transaction.bank?.qr_code && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-md flex items-center">
                                <QrCode className="h-5 w-5 mr-2" />
                                Bank QR Code
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
                                <div
                                    className="relative cursor-pointer group"
                                    onClick={() => setShowQrFullscreen(true)}
                                >
                                    <img
                                        src={transaction.bank.qr_code}
                                        alt="Bank QR Code"
                                        className="max-h-48 rounded-md border border-gray-200 transition-opacity group-hover:opacity-80"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Maximize2 className="h-8 w-8 text-gray-700 bg-white/80 rounded-full p-1.5" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Click to view fullscreen</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {transaction.identifier !== "withdrawal" && transaction.identifier !== "booking_hold" && (
                    <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-md flex items-center">
                            <DollarSign className="h-5 w-5 mr-2" />
                            Payment Slip
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transaction?.paymentSlip ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <FileText className="h-6 w-6 text-blue-600" />
                                        <div>
                                            <p className="text-sm ">Payment Slip Available</p>
                                            <p className="text-xs text-gray-500">Uploaded with transaction</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleDownloadSlip}>
                                        <Download className="h-4 w-4 mr-1" />
                                        Download
                                    </Button>
                                </div>
                                <div className="rounded-lg bg-gray-50 p-4">
                                    <img
                                        src={transaction.paymentSlip}
                                        alt="Payment Slip"
                                        className="mx-auto rounded-md max-h-64 object-contain"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">No payment slip provided</p>
                                <p className="text-xs text-gray-400">This transaction was processed without a payment slip</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={closeHandler}>
                        Close
                    </Button>
                </div>
            </div>

            {/* Fullscreen QR Code Modal */}
            {showQrFullscreen && transaction.bank?.qr_code && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
                    onClick={() => setShowQrFullscreen(false)}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <button
                            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                            onClick={() => setShowQrFullscreen(false)}
                        >
                            <X className="h-8 w-8" />
                        </button>
                        <img
                            src={transaction.bank.qr_code}
                            alt="Bank QR Code - Fullscreen"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        />
                        <p className="text-center text-white/70 mt-4 text-sm">Click anywhere to close</p>
                    </div>
                </div>
            )}
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "view",
    });
    const transaction = await getTransaction(params.id!);
    return json(transaction);
}

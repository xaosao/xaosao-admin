import { json } from "react-router"
import { LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"
import { User, Clock, FileText, Check, X, Download, Calendar, DollarSign, Users, UserCheck, Mars, Venus } from "lucide-react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

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

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold">Transaction Details</h3>
                    <p className="text-gray-500 text-sm ml-2">Complete transaction information and processing history</p>
                </div>
                <div className="space-y-2 border">
                    <Card className="py-0">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                                <User className="h-5 w-5 mr-2" />
                                User Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {transaction.identifier === "payment" ? <div className="flex items-center justify-start">
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={transaction.customer.profile} />
                                            <AvatarFallback>{transaction.customer.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{transaction.customer.firstName} {transaction.customer.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-900"><Users className="h-3 w-3" />&nbsp;{transaction.customer.gender}</p>
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
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"},&nbsp;
                                                {transaction.model ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div> :
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={owner.profile} />
                                            <AvatarFallback>{owner.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-gray-600">{owner.firstName}&nbsp;{owner.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"},&nbsp;
                                                {transaction.model ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                            </p>
                                        </div>
                                    </div>
                                }
                            </div>
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="details"><span className="hidden sm:block">Transaction</span> Details</TabsTrigger>
                            <TabsTrigger value="payment"><span className="block sm:hidden">Payment Slip</span><span className="hidden sm:block">Payment Information</span></TabsTrigger>
                            <TabsTrigger value="history"><span className="hidden sm:block">Processing</span> History</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-md flex items-center">
                                        <FileText className="h-5 w-5 mr-2" />
                                        Transaction Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Transaction ID</label>
                                            <p className="mt-1 text-sm font-mono">{transaction?.id}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Identifier</label>
                                            <p className="mt-1 text-sm font-mono">{transaction?.identifier}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Description</label>
                                            <p className="mt-1 text-sm">{transaction?.description || "No description provided"}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Amount</label>
                                            <p className="mt-1 text-lg font-semibold text-green-600">${transaction.amount}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Created At</label>
                                            <p className="mt-1 text-sm">{formatDate(transaction?.createdAt)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Last Updated</label>
                                            <p className="mt-1 text-sm">{formatDate(transaction?.updatedAt)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="payment" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-md flex items-center">
                                        <DollarSign className="h-5 w-5 mr-2" />
                                        Payment Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {transaction?.paymentSlip ? (
                                        <div className="space-y-4">
                                            <div className="sm:border sm:border-gray-200 rounded p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:space-x-3 space-y-2 sm:space-y-0">
                                                    <div className="flex items-center space-x-3">
                                                        <FileText className="h-8 w-8 text-blue-600" />
                                                        <div>
                                                            <p className="text-sm font-medium">Payment Slip Available</p>
                                                            <p className="text-sm text-gray-500">Uploaded with transaction</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm" className="hidden sm:block" onClick={handleDownloadSlip}>
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </Button>
                                                </div>
                                                <div className="rounded-lg text-center mt-2">
                                                    <img
                                                        src={transaction.paymentSlip}
                                                        alt="Payment Slip"
                                                        className="mx-auto rounded-md max-h-96 object-contain"
                                                    />
                                                </div>
                                                <Button variant="outline" size="sm" className="flex sm:hidden mt-2" onClick={handleDownloadSlip}>
                                                    <Download className="h-4 w-4" />
                                                    Download
                                                </Button>
                                            </div>

                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500">No payment slip provided</p>
                                            <p className="text-sm text-gray-400">This transaction was processed without a payment slip</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-md flex items-center">
                                        <Clock className="h-5 w-5 mr-2" />
                                        Processing History
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="p-2 rounded-lg bg-blue-50">
                                                <Calendar className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">Transaction Created</p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDate(transaction?.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status Updates */}
                                        {transaction?.status === "approved" && (
                                            <div className="flex items-start space-x-3">
                                                <div className="p-2 rounded-lg bg-green-50">
                                                    <Check className="h-4 w-4 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">Transaction Approved</p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatDate(transaction?.updatedAt)} • by {transaction?.ApprovedBy.firstName}&nbsp;{transaction?.ApprovedBy.lastName}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {transaction?.status === "rejected" && (
                                            <div className="flex items-start space-x-3">
                                                <div className="p-2 rounded-lg bg-red-50">
                                                    <X className="h-4 w-4 text-red-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">Transaction Rejected</p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatDate(transaction?.updatedAt)} • by {transaction?.RejectedBy?.firstName}&nbsp;{transaction?.RejectedBy?.lastName}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {transaction?.status === "pending" && (
                                            <div className="flex items-start space-x-3">
                                                <div className="p-2 rounded-lg bg-yellow-50">
                                                    <Clock className="h-4 w-4 text-yellow-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">Awaiting Review</p>
                                                    <p className="text-xs text-gray-500">Transaction is pending admin approval</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={closeHandler}>
                        Close
                    </Button>
                </div>
            </div >
        </Modal >
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
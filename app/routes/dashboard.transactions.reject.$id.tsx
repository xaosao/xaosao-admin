import { AlertTriangle, Mars, UserCheck, Users, Venus, X } from "lucide-react"
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { Form, json, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import { Card, CardContent } from "~/components/ui/card"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// utils and services
import { useAuthStore } from "~/store/permissionStore"
import { getTransaction, rejectTransaction } from "~/services/transaction.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export interface ITransactionInput {
    reject_type: string;
    reject_reason: string;
}

export default function RejectTransactionModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";

    const transaction = useLoaderData<typeof loader>();
    const owner = transaction.model || transaction.customer;

    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("transaction", "edit");

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

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold text-red-500"> <X className="h-5 w-5" />&nbsp;Reject Transaction</h3>
                    <p className="text-gray-500 text-sm ml-4 space-y-2">Provide a reason for rejecting this transaction. The user will be notified of the rejection.</p>
                </div>
                <div className="space-y-4">
                    <Card className="border-red-500 bg-red-50">
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                {transaction.identifier === "payment" ? <div className="flex items-center justify-start">
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={transaction.customer?.profile ?? ""} />
                                            <AvatarFallback>{transaction.customer?.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{transaction.customer?.firstName} {transaction.customer?.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-900"><Users className="h-3 w-3" /></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 pl-4">
                                        <div className="text-xs text-gray-400">→</div>
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={transaction.model?.profile ?? ""} />
                                            <AvatarFallback>{transaction.model?.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-gray-600">{transaction.model?.firstName}&nbsp;{transaction.model?.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"},&nbsp;
                                                {transaction.model ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div> :
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={owner?.profile ?? ""} />
                                            <AvatarFallback>{owner?.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-gray-600">{owner?.firstName}&nbsp;{owner?.lastName}</p>
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
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-orange-800">Rejection Impact</h4>
                                    <ul className="text-sm text-orange-700 mt-1 space-y-1">
                                        <li>• Transaction will be marked as rejected</li>
                                        <li>• User will receive rejection notification</li>
                                        <li>• Funds will not be processed</li>
                                        <li>• User may resubmit with corrections</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Form method="patch" className="space-y-4">
                        <div className="space-y-2">
                            <Textfield
                                required
                                type="text"
                                id="reason"
                                name="reject_reason"
                                multiline
                                rows={2}
                                title="Rejected reason"
                                color="text-gray-500"
                                placeholder="Enter reject reason...."
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                                {isSubmitting ? "Rejecting..." : "Reject"}
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "edit",
    });
    const transaction = await getTransaction(params.id!);
    if (!transaction) {
        throw new Response("Transaction not found", { status: 404 });
    }
    return json(transaction);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "edit",
    });
    const transactionId = params.id;
    const formData = await request.formData();
    const transaction = Object.fromEntries(formData) as Record<string, string>;
    if (request.method === "PATCH") {
        try {
            const input: ITransactionInput = {
                reject_type: transaction.reject_type,
                reject_reason: transaction.reject_reason,
            }
            const res = await rejectTransaction(transactionId as string, input, userId);
            if (res.id) {
                return redirect("/dashboard/transactions?success=Rejected+service+successfully");
            }
        } catch (error: any) {
            console.log("REJECT_TRANSACTION_FAILED", error);
            return error
        }
    }

    return json({ error: "Invalid request method." });
}
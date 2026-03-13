import { Check, AlertTriangle, Users, UserCheck, Mars, Venus, RotateCcw } from "lucide-react"
import { Form, json, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// services
import { useAuthStore } from "~/store/permissionStore"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { reapproveTransaction, getTransaction } from "~/services/transaction.server"

export default function ReapproveTransactionModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";
    const transaction = useLoaderData<typeof loader>();
    const owner = transaction.model || transaction.customer;

    function closeHandler() {
        navigate("..");
    }

    const canReapprove = hasPermission("transaction", "reapprove");

    if (!canReapprove) {
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
                    <h3 className="flex items-center text-black text-md font-bold text-amber-600">
                        <RotateCcw className="h-5 w-5" />&nbsp;Re-approve Rejected Transaction
                    </h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2">
                        This transaction was previously rejected. Re-approving will process the payment and credit the user's wallet.
                    </p>
                </div>
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 rounded border border-amber-400 bg-amber-50">
                            <div className="space-y-2">
                                {transaction.identifier === "payment" ? (
                                    <div className="flex items-center justify-start">
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
                                                    {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={owner?.profile ?? ""} />
                                            <AvatarFallback>{owner?.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm text-gray-600">{owner?.firstName}&nbsp;{owner?.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-2 pt-2 border-t border-amber-200">
                                    <p className="text-sm text-amber-800">
                                        Amount: <span className="font-semibold">{transaction.amount?.toLocaleString()} Kip</span>
                                    </p>
                                    {transaction.rejectReason && (
                                        <p className="text-xs text-red-600 mt-1">
                                            Previous rejection reason: {transaction.rejectReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-800">Re-approval Impact</h4>
                                    <ul className="text-sm text-amber-700 mt-1 space-y-1">
                                        <li>• Transaction status will change from "rejected" to "approved"</li>
                                        <li>• User's wallet will be credited with the transaction amount</li>
                                        <li>• Any linked subscription will be re-activated</li>
                                        <li>• User will receive approval notification</li>
                                        <li>• This action is restricted to super admin only</li>
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
                            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                                {isSubmitting ? "Re-approving..." : "Re-approve Transaction"}
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
        action: "reapprove",
    });
    const transaction = await getTransaction(params.id!);
    if (!transaction) {
        throw new Response("Transaction not found", { status: 404 });
    }
    if (transaction.status !== "rejected") {
        throw new Response("Only rejected transactions can be re-approved", { status: 400 });
    }
    return json(transaction);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "reapprove",
    });
    const transactionId = params.id;
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type !== "model" && type !== "customer") {
        return json({ error: "Invalid transaction type." });
    }

    if (request.method === "PATCH") {
        try {
            const res = await reapproveTransaction(transactionId as string, userId, type);
            if (res.id) {
                return redirect("/dashboard/transactions?success=Transaction+re-approved+successfully");
            }
        } catch (error: any) {
            console.log("REAPPROVE_TRANSACTION_FAILED", error);
            const errorMessage = error?.errors?.id || error?.message || "Failed to re-approve transaction";
            return redirect(`/dashboard/transactions?error=${encodeURIComponent(errorMessage)}`);
        }
    }

    return json({ error: "Invalid request method." });
}

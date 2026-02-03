import { RotateCcw, AlertTriangle, Users, UserCheck, Mars, Venus } from "lucide-react"
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
import { getTransaction, refundHeldTransaction } from "~/services/transaction.server"

export default function RefundTransactionModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";
    const transaction = useLoaderData<typeof loader>();
    const owner = transaction.customer;

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

    // Get absolute amount (held transactions have negative amount)
    const amount = Math.abs(transaction.amount);

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold text-orange-500"> <RotateCcw className="h-5 w-5" />&nbsp;Refund Transaction</h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2">Refund the held payment back to the customer's wallet.</p>
                </div>
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 rounded border border-orange-500 bg-orange-50">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={owner?.profile ?? ""} />
                                        <AvatarFallback>{owner?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm text-gray-600">{owner?.firstName ?? "Unknown"}&nbsp;{owner?.lastName ?? ""}</p>
                                        <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                            <Users className="h-3 w-3" />&nbsp;Customer
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-orange-200">
                                    <p className="text-sm text-gray-600">Amount to refund:</p>
                                    <p className="text-xl font-bold text-orange-600">
                                        {amount.toLocaleString()} LAK
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-orange-800">Refund Impact</h4>
                                    <ul className="text-sm text-orange-700 mt-1 space-y-1">
                                        <li>• Transaction status will be changed to "refunded"</li>
                                        <li>• {amount.toLocaleString()} LAK will be returned to customer's wallet</li>
                                        <li>• The associated booking will be marked as refunded</li>
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
                </div >
            </div >
        </Modal >
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

    // Must be a booking_hold transaction
    if (transaction.identifier !== "booking_hold") {
        throw new Response("Only booking hold transactions can be refunded", { status: 400 });
    }

    // Don't allow if already refunded
    if (transaction.status === "refunded") {
        throw new Response("This transaction has already been refunded", { status: 400 });
    }

    // Extract booking ID from reason to check booking status
    const reasonMatch = transaction.reason?.match(/[Bb]ooking #(\w+)/);
    if (reasonMatch) {
        const { prisma } = await import("~/services/database.server");
        const booking = await prisma.service_booking.findUnique({
            where: { id: reasonMatch[1] },
            select: { status: true }
        });

        // Allow refund for held transactions OR when booking is confirmed/disputed
        const allowedBookingStatuses = ["confirmed", "disputed"];
        if (transaction.status !== "held" && booking && !allowedBookingStatuses.includes(booking.status)) {
            throw new Response("Transaction is not eligible for refund. Booking must be confirmed or disputed.", { status: 400 });
        }

        // Don't allow if booking already completed or refunded
        if (booking && (booking.status === "completed" || booking.status === "refunded")) {
            throw new Response("Cannot refund - booking has already been " + booking.status, { status: 400 });
        }
    } else if (transaction.status !== "held") {
        // If we can't find booking info and transaction is not held, don't allow
        throw new Response("Transaction is not eligible for refund", { status: 400 });
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

    if (request.method === "PATCH") {
        try {
            const formData = await request.formData();
            const reason = formData.get("reason") as string | undefined;

            const res = await refundHeldTransaction(transactionId as string, userId, reason || undefined);
            if (res.id) {
                return redirect("/dashboard/transactions?success=Transaction+refunded+successfully");
            }
        } catch (error: any) {
            console.log("REFUND_TRANSACTION_FAILED", error);
            const errorMessage = error?.message || "Failed to refund transaction";
            return redirect(`/dashboard/transactions?error=${encodeURIComponent(errorMessage)}`);
        }
    }

    return json({ error: "Invalid request method." });
}

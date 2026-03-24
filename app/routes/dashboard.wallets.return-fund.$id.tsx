import { RotateCcw } from "lucide-react"
import { Form, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node"

import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import { Separator } from "~/components/ui/separator"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

import { useAuthStore } from "~/store/permissionStore"
import { getWallet } from "~/services/wallet.server"
import { prisma } from "~/services/database.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { createCustomerNotification } from "~/services/email.server"
import { createAuditLogs } from "~/services/log.server"

export default function ReturnFundModal() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const wallet = useLoaderData<typeof loader>()
    const hasPermission = useAuthStore((state) => state.hasPermission)
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST"
    const owner = wallet?.customer

    const availableBalance =
        (wallet?.totalBalance ?? 0) - (wallet?.totalSpend ?? 0) + (wallet?.totalRefunded ?? 0)

    function closeHandler() {
        navigate("..")
    }

    const canEdit = hasPermission("wallet", "edit")
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
            <h1 className="flex items-start text-xl font-bold mb-2">
                <RotateCcw className="mr-2 h-5 w-5 text-rose-500" />
                Return Fund
            </h1>
            <p className="text-sm text-gray-500 my-2">
                Refund money back to the customer's wallet balance.
            </p>
            <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={owner?.profile ?? ""} alt={owner?.firstName} />
                        <AvatarFallback>{owner?.firstName?.charAt(0) || "C"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-sm">
                            {owner?.firstName} {owner?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                            Available Balance: {availableBalance.toLocaleString()} Kip
                        </p>
                    </div>
                </div>

                <Separator />

                <Form method="post" className="space-y-4">
                    <Textfield
                        required
                        type="number"
                        id="amount"
                        name="amount"
                        title="Refund Amount (Kip)"
                        color="text-gray-500"
                        placeholder="Enter amount to refund..."
                    />
                    <Textfield
                        required
                        multiline
                        rows={3}
                        type="text"
                        id="reason"
                        name="reason"
                        title="Reason"
                        color="text-gray-500"
                        placeholder="e.g. Customer requested refund via WhatsApp"
                    />

                    <div className="flex gap-4">
                        <Button type="button" variant="outline" disabled={isSubmitting} onClick={closeHandler}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                        >
                            {isSubmitting ? "Processing..." : "Return Fund"}
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request)
    await requireUserPermission({ userId, group: "wallet", action: "edit" })
    const wallet = await getWallet(params.id!)

    // Only allow for customer wallets
    if (!wallet?.customerId) {
        throw new Response("Not Found", { status: 404 })
    }

    return json(wallet)
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request)
    await requireUserPermission({ userId, group: "wallet", action: "edit" })

    const walletId = params.id!
    const formData = await request.formData()
    const amount = Number(formData.get("amount"))
    const reason = formData.get("reason") as string

    if (!amount || amount <= 0) {
        return json({ error: "Amount must be greater than 0" }, { status: 400 })
    }
    if (!reason?.trim()) {
        return json({ error: "Reason is required" }, { status: 400 })
    }

    try {
        // Fetch wallet with customer relation
        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                customer: {
                    select: { id: true, firstName: true, lastName: true, whatsapp: true },
                },
            },
        })

        if (!wallet || !wallet.customerId || !wallet.customer) {
            return json({ error: "Customer wallet not found" }, { status: 404 })
        }

        // Calculate available balance
        const availableBalance =
            wallet.totalBalance - wallet.totalSpend + wallet.totalRefunded

        if (amount > availableBalance) {
            return json(
                {
                    error: `Refund amount (${amount.toLocaleString()} Kip) exceeds available balance (${availableBalance.toLocaleString()} Kip)`,
                },
                { status: 400 }
            )
        }

        // Create return_fund transaction
        const transaction = await prisma.transaction_history.create({
            data: {
                identifier: "return_fund",
                amount,
                status: "approved",
                comission: 0,
                fee: 0,
                reason,
                customerId: wallet.customerId,
            },
        })

        // Decrement totalBalance to reduce the customer's available balance
        // totalBalance IS the available balance in this system
        await prisma.wallet.update({
            where: { id: walletId },
            data: {
                totalBalance: { decrement: amount },
                updatedById: userId,
            },
        })

        // Send in-app notification to customer
        await createCustomerNotification(wallet.customerId, {
            type: "deposit_approved",
            title: "ໄດ້ຮັບຄືນເງິນ!",
            message: `ທ່ານໄດ້ຮັບການຄືນເງິນ ${amount.toLocaleString()} LAK ໃສ່ Wallet ຂອງທ່ານແລ້ວ.`,
            data: { transactionId: transaction.id, amount },
        })

        // Audit log
        await createAuditLogs({
            action: "return_fund",
            description: `Admin returned ${amount.toLocaleString()} Kip to customer ${wallet.customer.firstName} wallet. Reason: ${reason}`,
            status: "success",
            onSuccess: { transactionId: transaction.id, amount, walletId },
            user: userId,
        })

        return redirect(`/dashboard/wallets?success=Return+fund+of+${amount.toLocaleString()}+Kip+processed+successfully`)
    } catch (error: any) {
        console.error("RETURN_FUND_FAILED", error)
        return json({ error: error.message || "Failed to process return fund" }, { status: 500 })
    }
}

import { DollarSign } from "lucide-react"
import { Form, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import SelectTextfield from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// utils
import { adjustment } from "~/utils"
import { UserStatus } from "~/interfaces/base"
import { IWalletInputs } from "~/interfaces/wallet"
import { useAuthStore } from "~/store/permissionStore"
import { getWallet, updateWallet } from "~/services/wallet.server"
import { validateWalletInputs } from "~/services/validation.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function AdjustBalanceModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const wallet = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";
    const owner = wallet?.model ?? wallet?.customer;
    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("wallet", "edit");
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
            <h1 className="flex items-start text-xl font-bold mb-2"><DollarSign />&nbsp;Adjust Balance</h1>
            <p className="text-sm text-gray-500 my-2">Add or subtract funds from {"wallet.owner_name"}'s wallet</p>
            <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={owner?.profile ?? ""} alt={owner?.firstName} />
                        <AvatarFallback>{owner?.firstName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-sm">{"wallet.owner_name"}</p>
                        <p className="text-xs text-gray-500">Current Balance: ${wallet?.totalBalance}</p>
                    </div>
                </div>

                <Separator />

                <Form method="patch" className="space-y-4">
                    <div className="space-y-2">
                        <SelectTextfield
                            required
                            title="Adjustment Type"
                            name="adjustment"
                            option={adjustment}
                        />
                    </div>
                    <div className="space-y-2">
                        <Textfield
                            required
                            type="number"
                            id="amount"
                            name="amount"
                            title="Amount"
                            color="text-gray-500"
                            placeholder="Enter amount...."
                        />
                    </div>
                    <div className="space-y-2">
                        <Textfield
                            required
                            multiline
                            rows={2}
                            type="text"
                            id="reason"
                            name="reason"
                            title="Reason"
                            color="text-gray-500"
                            placeholder="Enter reason..."
                        />
                    </div>

                    <div className="flex gap-4">
                        <Button type="button" variant="outline" disabled={isSubmitting} onClick={closeHandler}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-dark-pink hover:opacity-90 text-white"
                        >
                            {isSubmitting ? "Processing..." : "Add fund"}
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "edit",
    });
    const wallet = await getWallet(params.id!);
    return json(wallet);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "edit",
    });
    const walletId = params.id;
    const formData = await request.formData();
    const wallet = Object.fromEntries(formData) as Record<string, string>;
    if (request.method === "PATCH") {
        try {
            const input: IWalletInputs = {
                totalBalance: Number(wallet.total_balance),
                totalRecharge: Number(wallet.total_recharge),
                totalWithdraw: Number(wallet.total_withdraw || 0),
                totalSpend: Number(wallet.total_spend || 0),
                totalRefunded: Number(wallet.total_refunded || 0),
                totalPending: Number(wallet.total_pending || 0),
                status: wallet.status as UserStatus,
            };

            await validateWalletInputs(input);
            const res = await updateWallet(walletId as string, input, userId);
            if (res.id) {
                return redirect("/dashboard/wallets?success=Update+wallet+successfully");
            }
        } catch (error: any) {
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}
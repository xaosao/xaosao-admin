import { Dot, Edit, Loader2, UserCheck, Users } from "lucide-react"
import { Form, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import SelectTextfield from "~/components/ui/select"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// utils
import { UserStatus } from "~/interfaces/base"
import { IWalletInputs } from "~/interfaces/wallet"
import { useAuthStore } from "~/store/permissionStore"
import { capitalizeFirstLetter, status } from "~/utils"
import { getWallet, updateWallet } from "~/services/wallet.server"
import { validateWalletInputs } from "~/services/validation.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function EditWalletModal() {
    const navigate = useNavigate();
    const navigation = useNavigation()
    const wallet = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const validationErrors = useActionData<Partial<Record<keyof string, string>>>();
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"

    const owner = wallet.model ?? wallet.customer;

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
            <h1 className="text-xl font-bold mb-2 flex"><Edit />&nbsp;&nbsp;Edit Wallet</h1>
            <p className="text-sm text-gray-500 my-2">Update wallet settings and balances:</p>
            <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={owner?.profile ?? ""} alt={owner?.firstName} />
                        <AvatarFallback>{owner?.firstName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-sm">{owner?.firstName}&nbsp;{owner?.lastName}</p>
                        <p className="flex items-center text-xs text-gray-500">
                            {wallet.customerId === null ? <UserCheck className="h-4 w-4" /> : <Users className="h-4 w-4" />}&nbsp;
                            {wallet.customerId === null ? "Model" : "Customer"}&nbsp;&nbsp;
                            <span className="flex items-center justify-center text-green-500"><Dot />{capitalizeFirstLetter(wallet.status)}</span>
                        </p>
                    </div>
                </div>
                <Form method="patch" className="space-y-4" encType="multipart/form-data">
                    <SelectTextfield
                        required
                        title="Status"
                        name="status"
                        option={status}
                        defaultValue={wallet.status}
                    />
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-semibold text-gray-900">Balance Information</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="number"
                                    id="total_balance"
                                    name="total_balance"
                                    title="Total Balances"
                                    color="text-gray-500"
                                    placeholder="Enter total balance...."
                                    defaultValue={wallet.totalBalance}
                                />
                            </div>
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="number"
                                    id="total_recharge"
                                    name="total_recharge"
                                    title="Total Recharge"
                                    color="text-gray-500"
                                    placeholder="Enter total recharge...."
                                    defaultValue={wallet.totalRecharge}
                                />
                            </div>

                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="number"
                                    id="total_deposit"
                                    name="total_deposit"
                                    title="Total Deposit"
                                    color="text-gray-500"
                                    placeholder="Enter total deposit...."
                                    defaultValue={wallet.totalDeposit}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mt-2">
                        {validationErrors && Object.keys(validationErrors).length > 0 && (
                            <div>
                                {Object.values(validationErrors).map((error, index) => (
                                    <div key={index} className="flex items-center p-2 mb-2 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
                                        <svg className="shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
                                        </svg>
                                        <span className="sr-only">Info</span>
                                        <div>
                                            {error}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex items-center justify-start space-x-4">
                        <Button type="button" variant="outline" onClick={closeHandler}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-dark-pink hover:bg-dark-pink/90"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ""}
                            {isSubmitting ? "Updating..." : "Update"}
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
    if (!wallet) {
        throw new Response("Wallet not found", { status: 404 });
    }
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
                totalDeposit: Number(wallet.total_deposit),
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

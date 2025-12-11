import { Ban, Loader2 } from "lucide-react";
import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

// backend 
import { useAuthStore } from "~/store/permissionStore";
import { bannedWallet } from "~/services/wallet.server";
import { Card, CardContent } from "~/components/ui/card";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

export default function DeleteWallet() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const validationErrors = useActionData<Partial<Record<keyof string, string>>>();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";

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
            <h1 className="flex items-start text-xl font-bold mb-2 text-orange-500"><Ban />&nbsp;Suspend Wallet!</h1>
            <p className="text-sm text-gray-500 my-2">This action will restrict access to User's wallet and prevent transactions</p>

            <Form method="patch" className="space-y-4 mt-4">
                <Card className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <h4 className="text-sm font-semibold text-orange-800 mb-2">Ban Impact Summary</h4>
                        <ul className="text-sm text-orange-700 space-y-1">
                            <li>• Wallet status will be changed to "banned"</li>
                            <li>• All transaction capabilities will be disabled</li>
                            <li>• Existing balance remains accessible</li>
                            <li>• User will receive notification of the ban</li>
                            <li>• Ban is permanent until manually lifted</li>
                        </ul>
                    </CardContent>
                </Card>
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
                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="bg-orange-500 hover:opacity-90 text-white">
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                        {isSubmitting ? "Suspending..." : "Suspend"}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "edit",
    });
    const walletId = params.id;
    if (!walletId) throw new Response("Wallet ID is required", { status: 400 });
    if (request.method === "PATCH") {
        try {
            const res = await bannedWallet(walletId, userId);
            if (res.id) {
                return redirect("/dashboard/wallets?success=Banned+wallet+successfully");
            }
        } catch (error: any) {
            console.error("BANNED_WALLET_ERROR", error);
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}

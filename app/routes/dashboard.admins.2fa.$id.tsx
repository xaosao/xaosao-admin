import { Loader2, Shield } from "lucide-react";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, json, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

// backend 
import { useAuthStore } from "~/store/permissionStore";
import { IAdminInput, IAdminResponse } from "~/interfaces";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { EnableAdminTwoFactorAuthentication, getAdmin } from "~/services/admin.server";

interface LoaderData {
    admin: IAdminResponse;
}

export default function TwoFactorAuthenticationAdmin() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const { admin } = useLoaderData<LoaderData>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const validationErrors = useActionData<Partial<Record<keyof IAdminInput, string>>>();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";

    function closeHandler() {
        navigate("..");
    }


    const canEdit = hasPermission("admin", "edit");
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-2/5">
            <h1 className="flex items-center justify-start text-xl font-bold mb-2"><Shield className="h-6 w-6 font-bold" />&nbsp;Two factor authentication enabled!</h1>
            <Form method="patch" className="space-y-4 mt-4">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                        <div className="text-sm text-gray-800 flex items-start flex-col gap-2">
                            <p className="font-medium">1. Once 2FA is enabled, you will be required to enter a verification code each time you log in.</p>
                            <p>2. A verification code will be sent to your email: <strong>{admin.email}</strong>, &nbsp;please make sure you have access to it.</p>
                        </div>

                    </div>
                </div>
                <input
                    type="hidden"
                    name="is2FAEnabled"
                    value={admin.is2FAEnabled ? "false" : "true"}
                />
                <div>
                    {validationErrors && Object.keys(validationErrors).length > 0 && (
                        <div>
                            {Object.values(validationErrors).map((error, index) => (
                                <div key={index} className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800" role="alert">
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
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className={`${admin.is2FAEnabled ? "bg-dark-pink text-white hover:text-white" : "bg-gray-200 text-black hover:text-black"} `}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {admin.is2FAEnabled ? isSubmitting ? "Disabling..." : "Disable 2FA" : isSubmitting ? "Enabling..." : "Enable 2FA"}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    await requireUserSession(request);
    const adminId = params.id;
    if (!adminId) {
        throw new Response("Admin ID is required", { status: 400 });
    }
    try {
        const admin = await getAdmin(adminId);
        return json({
            admin
        });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        throw new Response("Failed to fetch data", { status: 500 });
    }
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "edit",
    });

    const adminId = params.id;
    if (!adminId) throw new Response("Admin ID is required", { status: 400 });

    const formData = await request.formData();
    const is2FAEnabled = formData.get("is2FAEnabled") === "true";
    if (request.method === "PATCH") {
        try {
            const res = await EnableAdminTwoFactorAuthentication(adminId, is2FAEnabled, userId);
            if (res.id) {
                return redirect(`/dashboard/admins?success=2FA+${is2FAEnabled ? "enabled" : "disabled"}+successfully`);

            }
        } catch (error: any) {
            console.log("DELETE_ROLE_ERROR", error);

            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}

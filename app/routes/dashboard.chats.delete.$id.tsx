import { ActionFunctionArgs } from "@remix-run/node";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Form, json, redirect, useActionData, useNavigate, useNavigation, useParams } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

// backend 
import { ICustomer } from "~/interfaces";
import { useAuthStore } from "~/store/permissionStore";
import { deleteConversation } from "~/services/conversaion.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

export default function ConversationDeleted() {
    const { id } = useParams();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "DELETE";
    const validationErrors =
        useActionData<Partial<Record<keyof ICustomer, string>>>();

    function closeHandler() {
        navigate("..");
    }

    const canDelete = hasPermission("chat", "delete");
    if (!canDelete) {
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
            <h1 className="text-xl font-bold">Delete Conversation!</h1>
            <p className="text-sm text-gray-500 my-2">This action cannot be undone. This will permanently delete:<br /> <span className="font-bold text-primary mt-2">" {id} "</span></p>
            <Form method="delete" className="space-y-4 mt-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div className="text-sm text-red-800">
                            <p className="font-medium">This action is irreversible!</p>
                            <p>All conversation data, chat history, and transaction records will be permanently deleted.</p>
                        </div>
                    </div>
                </div>
                <div>
                    {validationErrors && Object.keys(validationErrors).length > 0 && (
                        <div>
                            {Object.values(validationErrors).map((error, index) => (
                                <div
                                    key={index}
                                    className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800"
                                    role="alert"
                                >
                                    <svg
                                        className="shrink-0 inline w-4 h-4 me-3"
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z" />
                                    </svg>
                                    <span className="sr-only">Info</span>
                                    <div>{error}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="destructive" disabled={isSubmitting} className="bg-dark-pink hover:opacity-90 text-white">
                        {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Delete
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
        group: "chat",
        action: "delete",
    });
    const conversationId = params.id;
    if (!conversationId) {
        throw new Response("Conversation ID is required", { status: 400 });
    }

    if (request.method === "DELETE") {
        try {
            const res = await deleteConversation(conversationId, userId);
            if (res.id) {
                return redirect("/dashboard/chats?success=Delete+conversation+successfully");
            }
        } catch (error: any) {
            console.log("DELETE_CONVERSATION_ERROR", error);
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}

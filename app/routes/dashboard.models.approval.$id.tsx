import { Check, AlertTriangle, UserCheck, Mars, Venus } from "lucide-react"
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node"
import { Form, json, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

// services
import { IModelInput } from "~/interfaces/model"
import { useAuthStore } from "~/store/permissionStore"
import { approveModel, getModel } from "~/services/model.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function ApproveModelModal() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const model = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";
    const validationErrors = useActionData<Partial<Record<keyof IModelInput, string>>>();

    function closeHandler() {
        navigate("..");
    }

    const canEdit = hasPermission("model", "edit");
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
            <div className="space-y-6 py-4 sm:py-2">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold text-green-500"> <Check className="h-5 w-5" />&nbsp;Approve Model</h3>
                    <p className="text-gray-500 text-sm ml-4 mt-2"> Confirm approval model. This action will process the payment immediately.</p>
                </div>
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 rounded border border-green-500 bg-green-50">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={model?.profile ?? ""} />
                                        <AvatarFallback>{model?.firstName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm text-gray-600">{model?.firstName}&nbsp;{model?.lastName}</p>
                                        <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                            <UserCheck className="h-3 w-3 mr-2" /> Model &nbsp;
                                            {model.gender === "male" ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-blue-800">Approval Impact</h4>
                                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                                        <li>• Model status will be changed to "active"</li>
                                        <li>• This model can login and serve all serive to customer</li>
                                        <li>• This action cannot be undone</li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
                    <Form method="patch" className="space-y-4">
                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" onClick={closeHandler} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                                {isSubmitting ? "Approving..." : "Approve Now"}
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
        group: "model",
        action: "edit",
    });
    const model = await getModel(params.id!);
    if (!model) {
        throw new Response("Model not found", { status: 404 });
    }
    return json(model);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "model",
        action: "edit",
    });
    const serviceId = params.id;
    if (request.method === "PATCH") {
        try {
            const res = await approveModel(serviceId as string, userId);
            if (res.id) {
                return redirect("/dashboard/models/approval?success=Approved+model+successfully");
            }
        } catch (error: any) {
            console.log("APPROVED_MODEL_FAILED", error);
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}
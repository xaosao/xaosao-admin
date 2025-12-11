import { useState } from "react"
import { LoaderCircle, Plus } from "lucide-react"
import { ActionFunctionArgs } from "@remix-run/node"
import { Form, json, redirect, useActionData, useNavigate, useNavigation } from "@remix-run/react"

// utils and service
import { status } from "~/utils"
import { UserStatus } from "~/interfaces/base"
import { createService } from "~/services/service.server"
import { IServices, IServicesInput } from "~/interfaces/service"
import { validateServiceInputs } from "~/services/validation.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

// components
import Modal from "~/components/ui/modal"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import SelectTextfield from "~/components/ui/select"
import { useAuthStore } from "~/store/permissionStore"
import { ForbiddenCard } from "~/components/ui/forbidden-card"

export default function CreateService() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const [baseRate, setBaseRate] = useState<number>(0)
    const [commission, setCommission] = useState<number>(0)
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST"
    const validationErrors = useActionData<Partial<Record<keyof IServices, string>>>();

    const commissionAmount = (baseRate * commission) / 100
    const modelReceives = baseRate - commissionAmount

    function closeHandler() {
        navigate("..")
    }

    const canCreate = hasPermission("service", "create");
    if (!canCreate) {
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <h4 className="text-lg font-bold mb-4">Create new services:</h4>
            <Form method="post" className="space-y-2" encType="multipart/form-data">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full sm:w-2/4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                                <Textfield
                                    required
                                    type="text"
                                    id="name"
                                    name="name"
                                    title="Service name"
                                    color="text-gray-500"
                                    placeholder="Enter service name...."
                                />
                            </div>
                            <div className="space-y-1">
                                <Textfield
                                    required
                                    multiline
                                    rows={2}
                                    type="text"
                                    id="description"
                                    name="description"
                                    title="Description"
                                    color="text-gray-500"
                                    placeholder="Enter your description..."
                                />
                            </div>
                            <div className="space-y-1">
                                <SelectTextfield
                                    required
                                    title="Status"
                                    name="status"
                                    option={status}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full sm:w-2/4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Textfield
                                        required
                                        type="number"
                                        id="baseRate"
                                        name="baseRate"
                                        title="Base rate"
                                        color="text-gray-500"
                                        placeholder="Enter base rate...."
                                        onChange={(e) => setBaseRate(parseFloat(e.target.value || "0"))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <Textfield
                                        required
                                        type="number"
                                        id="commission"
                                        name="commission"
                                        title="Commission percentage"
                                        color="text-gray-500"
                                        placeholder="Enter commission...."
                                        onChange={(e) => setCommission(parseFloat(e.target.value || "0"))}
                                    />
                                </div>
                            </div>
                        </div>

                        {baseRate > 0 ? (
                            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-500">
                                <h4 className="font-medium mb-2">Pricing Breakdown</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span>Customer pays:</span>
                                        <span className="font-medium">${baseRate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Platform commission ({commission}%):</span>
                                        <span className="font-medium">${commissionAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-1">
                                        <span>Model receives:</span>
                                        <span className="font-medium  text-black">${modelReceives.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : <EmptyPage
                            title="No data to calculate!"
                            description="Please enter base rate and commision!"
                        />}
                    </div>
                </div>
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
                <div className="flex items-center justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        Cancel
                    </Button>
                    <Button type="submit" className="bg-dark-pink hover:opacity-90 text-white" disabled={isSubmitting}>
                        {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {isSubmitting ? "Creating..." : "Create"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "service",
        action: "create",
    });
    const formData = await request.formData();
    const service = Object.fromEntries(formData) as Record<string, string>;
    if (request.method === "POST") {
        try {
            const input: IServicesInput = {
                name: service.name,
                description: service.description,
                status: service.status as UserStatus,
                baseRate: Number(service.baseRate),
                commission: Number(service.commission),
            };

            await validateServiceInputs(input);
            const res = await createService(input, userId);
            if (res.id) {
                return redirect("/dashboard/services?success=Create+service+successfully");
            }
        } catch (error: any) {
            console.log("CREATE_SERVICES_FAILED", error);
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}

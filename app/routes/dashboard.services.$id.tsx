import { useState } from "react"
import { LoaderCircle, SaveAll } from "lucide-react"
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"
import { Form, json, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"

// utils and service
import { status, billingTypes } from "~/utils"
import { UserStatus } from "~/interfaces/base"
import { useAuthStore } from "~/store/permissionStore"
import { IServices, IServicesInput, BillingType } from "~/interfaces/service"
import { validateServiceInputs } from "~/services/validation.server"
import { getService, updateService } from "~/services/service.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"
import SelectTextfield from "~/components/ui/select"
import { ForbiddenCard } from "~/components/ui/forbidden-card"

export default function EditService() {
    const navigate = useNavigate()
    const navigation = useNavigation()
    const service = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"
    const validationErrors = useActionData<Partial<Record<keyof IServices, string>>>();

    // Live pricing state
    const [baseRate, setBaseRate] = useState<number>(service.baseRate)
    const [commission, setCommission] = useState<number>(service.commission)
    const [billingType, setBillingType] = useState<BillingType>(service.billingType as BillingType || "per_day")
    const [hourlyRate, setHourlyRate] = useState<number>(service.hourlyRate || 0)
    const [oneTimePrice, setOneTimePrice] = useState<number>(service.oneTimePrice || 0)
    const [oneNightPrice, setOneNightPrice] = useState<number>(service.oneNightPrice || 0)
    const [minuteRate, setMinuteRate] = useState<number>(service.minuteRate || 0)

    const commissionAmount = (baseRate * commission) / 100
    const modelReceives = baseRate - commissionAmount

    // Calculate commission for different billing types
    const hourlyCommission = (hourlyRate * commission) / 100
    const hourlyModelReceives = hourlyRate - hourlyCommission
    const oneTimeCommission = (oneTimePrice * commission) / 100
    const oneTimeModelReceives = oneTimePrice - oneTimeCommission
    const oneNightCommission = (oneNightPrice * commission) / 100
    const oneNightModelReceives = oneNightPrice - oneNightCommission
    const minuteCommission = (minuteRate * commission) / 100
    const minuteModelReceives = minuteRate - minuteCommission

    function closeHandler() {
        navigate("..")
    }

    const canEdit = hasPermission("service", "edit");
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <h4 className="text-xl font-bold mb-4">Update services information:</h4>
            <Form method="patch" className="space-y-2" encType="multipart/form-data">
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
                                    defaultValue={service.name}
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
                                    defaultValue={service.description ?? ""}
                                />
                            </div>
                            <div className="space-y-1">
                                <SelectTextfield
                                    required
                                    title="Status"
                                    name="status"
                                    option={status}
                                    defaultValue={service.status}
                                />
                            </div>
                            <div className="space-y-1">
                                <SelectTextfield
                                    required
                                    title="Billing Type"
                                    name="billingType"
                                    option={billingTypes}
                                    defaultValue={service.billingType || "per_day"}
                                    onChange={(e) => setBillingType(e.target.value as BillingType)}
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
                                        title={billingType === "per_day" ? "Base rate (per day)" : "Base rate"}
                                        color="text-gray-500"
                                        placeholder="Enter base rate...."
                                        onChange={(e) => setBaseRate(parseFloat(e.target.value || "0"))}
                                        defaultValue={service.baseRate}
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
                                        defaultValue={service.commission}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Per Hour Rate Field */}
                        {billingType === "per_hour" && (
                            <div className="mt-4">
                                <Textfield
                                    required
                                    type="number"
                                    id="hourlyRate"
                                    name="hourlyRate"
                                    title="Hourly Rate"
                                    color="text-gray-500"
                                    placeholder="Enter hourly rate...."
                                    defaultValue={service.hourlyRate || 0}
                                    onChange={(e) => setHourlyRate(parseFloat(e.target.value || "0"))}
                                />
                            </div>
                        )}

                        {/* Per Session Rate Fields */}
                        {billingType === "per_session" && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <Textfield
                                    required
                                    type="number"
                                    id="oneTimePrice"
                                    name="oneTimePrice"
                                    title="One-Time Price (1-2 hrs)"
                                    color="text-gray-500"
                                    placeholder="Enter one-time price...."
                                    defaultValue={service.oneTimePrice || 0}
                                    onChange={(e) => setOneTimePrice(parseFloat(e.target.value || "0"))}
                                />
                                <Textfield
                                    required
                                    type="number"
                                    id="oneNightPrice"
                                    name="oneNightPrice"
                                    title="One-Night Price (overnight)"
                                    color="text-gray-500"
                                    placeholder="Enter one-night price...."
                                    defaultValue={service.oneNightPrice || 0}
                                    onChange={(e) => setOneNightPrice(parseFloat(e.target.value || "0"))}
                                />
                            </div>
                        )}

                        {/* Per Minute Rate Field (Call Service) */}
                        {billingType === "per_minute" && (
                            <div className="mt-4">
                                <Textfield
                                    required
                                    type="number"
                                    id="minuteRate"
                                    name="minuteRate"
                                    title="Rate per Minute (LAK)"
                                    color="text-gray-500"
                                    placeholder="Enter rate per minute...."
                                    defaultValue={service.minuteRate || 0}
                                    onChange={(e) => setMinuteRate(parseFloat(e.target.value || "0"))}
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    This rate will be charged per minute during voice/video calls.
                                </p>
                            </div>
                        )}

                        {/* Pricing Breakdown */}
                        {(baseRate > 0 || hourlyRate > 0 || oneTimePrice > 0 || oneNightPrice > 0 || minuteRate > 0) && (
                            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-500 mt-4">
                                <h4 className="font-medium mb-2">Pricing Breakdown</h4>
                                <div className="space-y-1 text-sm">
                                    {/* Per Day Breakdown */}
                                    {billingType === "per_day" && baseRate > 0 && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Customer pays (per day):</span>
                                                <span className="font-medium">${baseRate.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Platform commission ({commission}%):</span>
                                                <span className="font-medium">${commissionAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-1">
                                                <span>Model receives:</span>
                                                <span className="font-medium text-black">${modelReceives.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Per Hour Breakdown */}
                                    {billingType === "per_hour" && hourlyRate > 0 && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Customer pays (per hour):</span>
                                                <span className="font-medium">${hourlyRate.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Platform commission ({commission}%):</span>
                                                <span className="font-medium">${hourlyCommission.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-1">
                                                <span>Model receives:</span>
                                                <span className="font-medium text-black">${hourlyModelReceives.toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Per Session Breakdown */}
                                    {billingType === "per_session" && (oneTimePrice > 0 || oneNightPrice > 0) && (
                                        <>
                                            {oneTimePrice > 0 && (
                                                <div className="mb-2">
                                                    <p className="font-medium text-gray-700 mb-1">One-Time Session:</p>
                                                    <div className="flex justify-between">
                                                        <span>Customer pays:</span>
                                                        <span className="font-medium">${oneTimePrice.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Platform commission ({commission}%):</span>
                                                        <span className="font-medium">${oneTimeCommission.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Model receives:</span>
                                                        <span className="font-medium text-black">${oneTimeModelReceives.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {oneNightPrice > 0 && (
                                                <div className="border-t pt-2">
                                                    <p className="font-medium text-gray-700 mb-1">One-Night Session:</p>
                                                    <div className="flex justify-between">
                                                        <span>Customer pays:</span>
                                                        <span className="font-medium">${oneNightPrice.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Platform commission ({commission}%):</span>
                                                        <span className="font-medium">${oneNightCommission.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Model receives:</span>
                                                        <span className="font-medium text-black">${oneNightModelReceives.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Per Minute Breakdown (Call Service) */}
                                    {billingType === "per_minute" && minuteRate > 0 && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>Customer pays (per minute):</span>
                                                <span className="font-medium">{minuteRate.toLocaleString()} LAK</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Platform commission ({commission}%):</span>
                                                <span className="font-medium">{minuteCommission.toLocaleString()} LAK</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-1">
                                                <span>Model receives (per minute):</span>
                                                <span className="font-medium text-black">{minuteModelReceives.toLocaleString()} LAK</span>
                                            </div>
                                            <div className="border-t pt-2 mt-2 text-xs text-gray-400">
                                                <p>Example: 10 min call = {(minuteRate * 10).toLocaleString()} LAK (Model gets {(minuteModelReceives * 10).toLocaleString()} LAK)</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
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
                        {isSubmitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
                        {isSubmitting ? "Updating..." : "Update"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "service",
        action: "edit",
    });
    const service = await getService(params.id!);
    if (!service) {
        throw new Response("Service not found", { status: 404 });
    }
    return json(service);
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "service",
        action: "edit",
    });
    const serviceId = params.id;
    const formData = await request.formData();
    const service = Object.fromEntries(formData) as Record<string, string>;
    if (request.method === "PATCH") {
        try {
            const input: IServicesInput = {
                name: service.name,
                description: service.description,
                status: service.status as UserStatus,
                baseRate: Number(service.baseRate),
                commission: Number(service.commission),
                billingType: service.billingType as BillingType,
                hourlyRate: service.hourlyRate ? Number(service.hourlyRate) : null,
                oneTimePrice: service.oneTimePrice ? Number(service.oneTimePrice) : null,
                oneNightPrice: service.oneNightPrice ? Number(service.oneNightPrice) : null,
                minuteRate: service.minuteRate ? Number(service.minuteRate) : null,
            };

            await validateServiceInputs(input);
            const res = await updateService(serviceId as string, input, userId);
            if (res.id) {
                return redirect("/dashboard/services?success=Update+service+successfully");
            }
        } catch (error: any) {
            console.log("UPDATE_SERVICES_FAILED", error);
            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method." });
}

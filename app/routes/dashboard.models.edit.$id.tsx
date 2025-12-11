import { LoaderCircle, X } from "lucide-react"
import { Form, useLoaderData, useNavigate, useNavigation } from "@remix-run/react"
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import Textfield from "~/components/ui/text-field"

// utils 
import { requireUserSession } from "~/services/auth.server"
import { getModelServicesByModelId, updateModelService } from "~/services/service.server"
import { Switch } from "~/components/ui/switch"
import { IModelServicesInput } from "~/interfaces/service"

export default function UpdateModelRatePage() {
    const navigate = useNavigate();
    const navigation = useNavigation();
    const { modelService } = useLoaderData<typeof loader>();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === "PATCH";
    function closeHandler() {
        navigate("..");
    }

    return (
        <Modal onClose={closeHandler} className="w-3/4 max-w-4xl">
            <div>
                <h3 className="text-black text-md font-bold">Edit model service</h3>
                <p className="text-gray-500 text-sm">Complete update model service rate price:</p>
            </div>
            <Form className="space-y-6 mt-4" method="patch" encType="multipart/form-data">
                {modelService.map((service) => (
                    <div>
                        <div className="flex items-center justify-start my-4">
                            <Switch name={`status_${service.id}`} defaultChecked={service.status === "active"} />&nbsp;&nbsp;
                            <p className="text-gray-500 text-sm">Switch on-off to enable {service.service?.name}:</p>
                        </div>
                        <div key={service.id} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="text"
                                    name={`rate_${service.id}`}
                                    title={`${service.service?.name} rate price ($)`}
                                    placeholder={`Enter ${service.service?.name}`}
                                    defaultValue={service.customRate ?? service.service?.baseRate}
                                />
                            </div>
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="text"
                                    name={`min_${service.id}`}
                                    title="Min session duration / minutes"
                                    placeholder={`Enter min for ${service.service?.name}`}
                                    defaultValue={service.minSessionDuration}
                                />
                            </div>
                            <div className="space-y-2">
                                <Textfield
                                    required
                                    type="text"
                                    name={`max_${service.id}`}
                                    title="Max session duration / minutes"
                                    placeholder={`Enter max for ${service.service?.name}`}
                                    defaultValue={service.maxSessionDuration}
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={closeHandler}>
                        <X className="w-4 h-4" />
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ?? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />}
                        {isSubmitting ? "Updating..." : "Update"}
                    </Button>
                </div>
            </Form>
        </Modal>
    )
}



export async function loader({ params, request }: LoaderFunctionArgs) {
    await requireUserSession(request);
    const modelService = await getModelServicesByModelId(params.id!);
    if (!modelService) {
        throw new Response("Model Service not found", { status: 404 });
    }
    return json({ modelService });
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    const formData = await request.formData();
    const values = Object.fromEntries(formData);
    if (request.method === "PATCH") {
        const modelServiceUpdates = Object.entries(values).reduce((acc, [key, value]) => {
            const [type, id] = key.split('_');
            if (!acc[id]) acc[id] = { id };

            if (type === "rate") acc[id].customRate = Number(value);
            else if (type === "min") acc[id].minSessionDuration = Number(value);
            else if (type === "max") acc[id].maxSessionDuration = Number(value);
            else if (type === "status") acc[id].status = "active";

            return acc;
        }, {} as Record<string, Partial<IModelServicesInput> & { id: string }>);

        try {
            for (const update of Object.values(modelServiceUpdates)) {
                if (!update.status) {
                    update.status = "inactive";
                }
                update.isAvailable = update.status === "active";
            }

            const results = [];
            for (const service of Object.values(modelServiceUpdates)) {
                try {
                    await updateModelService(service as IModelServicesInput, userId);
                    results.push({ id: service.id, success: true });
                } catch (err) {
                    console.error(`Failed to update model service ${service.id}`, err);
                    results.push({ id: service.id, success: false });
                }
            }

            return redirect("/dashboard/models?success=Update+model+service+successfully");
        } catch (error) {
            console.error("UPDATE_MODEL_SERVICE_ERROR", error);
            return error
        }
    }

    return json({ message: "Update model service complete" });
}


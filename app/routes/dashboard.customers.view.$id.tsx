import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";

// components
import { User, X } from "lucide-react";
import Modal from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// backend
import { ICustomer } from "~/interfaces";
import { IEntityLogs } from "~/interfaces/model";
import { useAuthStore } from "~/store/permissionStore";
import { getCustomer } from "~/services/customer.server";
import { getAuditLogsByEntity } from "~/services/log.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { capitalizeFirstLetter, formatDate1, getStatusColor, timeAgo } from "~/utils";

interface LoaderData {
    customer: ICustomer;
    customerLogs: IEntityLogs[];
    ENV: any
}

export default function CustomersDetails() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { customer, customerLogs, ENV } = useLoaderData<LoaderData>();

    function closeHandler() {
        navigate("..");
    }
    const canView = hasPermission("customer", "view");
    if (!canView) {
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
        <Modal onClose={closeHandler} className="w-3/5">
            <div className="space-y-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                            <div className="h-12 w-12 rounded mr-2">
                                {customer.profile ? (
                                    <img
                                        src={customer.profile}
                                        alt="profile"
                                        className="h-full w-full object-cover rounded"
                                    />
                                ) : (
                                    <User className="h-5 w-5 mr-2" />
                                )}
                            </div>
                            Basic Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 flex flex-col md:flex-row items-start justify-between">
                        <div className="grid grid-cols-1 gap-1 w-2/4">
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Number:</label>
                                <p className="mt-1 text-sm">{customer.number}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Status:</label>
                                <Badge className={getStatusColor(customer.status)}>{customer.status.toUpperCase()}</Badge>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Full Name:</label>
                                <p className="mt-1 text-sm">{customer.firstName} {customer.lastName}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Username:</label>
                                <p className="mt-1 text-sm">{customer.username || "Not provided"}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Tier: </label>
                                <p className="text-sm">
                                    <Badge variant="default">
                                        VIP
                                    </Badge>
                                </p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Created At: </label>
                                <p className="mt-1 text-sm">{formatDate1(customer.createdAt)}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Last Updated: </label>
                                <p className="mt-1 text-sm">{formatDate1(customer.updatedAt ?? " ")}</p>
                            </div>
                            <div className="flex items-center justify-start gap-4">
                                <label className="text-sm font-medium text-gray-500">Last Active: </label>
                                <p className="mt-1 text-sm">"Unknown"</p>
                            </div>
                            {customer.createdById && (
                                <div className="flex items-center justify-start gap-4">
                                    <label className="text-sm font-medium text-gray-500">Created By: </label>
                                    <p className="mt-1 text-sm">{customer.createdBy?.firstName} {customer.createdBy?.lastName}</p>
                                </div>
                            )}
                            {customer.deletedById && (
                                <div className="flex items-center justify-start gap-4">
                                    <label className="text-sm font-medium text-gray-500">Deleted By: </label>
                                    <p className="mt-1 text-sm text-red-600">{customer.deletedById}</p>
                                </div>
                            )}
                        </div>
                        <div className="w-2/4 border rounded">
                            {customer.latitude && customer.longitude ? (
                                <iframe
                                    src={`https://www.google.com/maps/embed/v1/view?key=${ENV.GOOGLE_MAPS_API_KEY}&center=${customer.latitude},${customer.longitude}&zoom=14`}
                                    width="100%"
                                    height="300"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                ></iframe>
                            ) : (
                                <p className="text-sm text-gray-500">Location data not available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent Activity</h3>
                            <div className="space-y-3">
                                {customerLogs && customerLogs.length > 0 ? customerLogs.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                                    >
                                        <div>
                                            <p className="text-sm text-gray-900">{activity.id}</p>
                                            <p className="text-xs text-gray-900">{activity.action}</p>
                                            <p className="text-xs text-gray-500">{activity.description}</p>
                                            <div className="block sm:block">
                                                <p className="text-xs text-gray-500">Status: {activity.status}</p>
                                                <p className="text-xs text-gray-500">Created At: {activity.createdAt}</p>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-start justify-start flex-col gap-1">
                                            <Badge variant="outline" className={`text-xs ${activity.status === "success" ? "text-green-600" : "text-red-600"}`}>
                                                {capitalizeFirstLetter(activity.status)}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs text-green-600">
                                                {timeAgo(activity.createdAt)}
                                            </Badge>
                                        </div>
                                    </div>
                                )) : <EmptyPage title="This customer has no logs yet!" description="This customer just register account, that's why no logs." />}
                            </div>
                        </CardContent>
                    </Card>
                </Card>
            </div>

            <div className="mt-4 text-right">
                <Button type="button" variant="outline" onClick={closeHandler} className="bg-dark-pink text-white hover:text-white">
                    <X className="w-4 h-4" />
                    Close
                </Button>
            </div>
        </Modal>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "customer",
        action: "view",
    });
    const customerId = params.id;
    if (!customerId) {
        throw new Response("Customer ID is required", { status: 400 });
    }
    try {

        const [customer, customerLogs] = await Promise.all([getCustomer(customerId), getAuditLogsByEntity({ customerId, limit: 20 })]);

        return json({
            customer,
            customerLogs,
            ENV: {
                GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
            },
        });
    } catch (error) {
        console.error("Failed to load customer data:", error);
        throw new Response("Failed to load customer data", { status: 500 });
    }
}
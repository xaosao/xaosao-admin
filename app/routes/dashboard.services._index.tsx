import React from "react";
import { toast } from "react-toastify";
import { json, Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
    Plus,
    Pencil,
    Trash2,
    Users,
} from "lucide-react";

import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { Card, CardContent } from "~/components/ui/card";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import {
    Table,
    TableRow,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
} from "~/components/ui/table";

import { useAuthStore } from "~/store/permissionStore";
import { getServices, getServicesStatus } from "~/services/service.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

export default function Services() {
    const navigate = useNavigate();
    const { services, success } = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);

    React.useEffect(() => {
        if (success) {
            toast.success(success);

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");

            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("service", "view");
    const canCreate = hasPermission("service", "create");
    const canEdit = hasPermission("service", "edit");
    const canDelete = hasPermission("service", "delete");

    if (!canAccess) {
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Services Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "services management", value: "/services" },
                        ]}
                    />
                </div>
                {canCreate && <Button className="bg-dark-pink hover:opacity-90 text-white">
                    <Link to="/dashboard/services/create" className="flex items-center justify-center">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Service
                    </Link>
                </Button>}
            </div>

            <div className="gap-6">
                <Card className="lg:col-span-2 border-0 shadow-md">
                    <CardContent className="p-0">
                        {/* Mobile Card View */}
                        <div className="block md:hidden p-4 space-y-4">
                            {services && services.length > 0 ? services.map((service, index: number) => (
                                <div key={service.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-900">#{index + 1} {service.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {service.description && service.description.length > 30
                                                    ? `${service.description.substring(0, 30)}...`
                                                    : service.description}
                                            </p>
                                        </div>
                                        <StatusBadge status={service.status} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                        <div>
                                            <span className="text-gray-400">Billing Type:</span>
                                            <p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    service.billingType === "per_hour" ? "bg-blue-100 text-blue-700" :
                                                    service.billingType === "per_session" ? "bg-purple-100 text-purple-700" :
                                                    "bg-green-100 text-green-700"
                                                }`}>
                                                    {service.billingType === "per_hour" ? "Per Hour" :
                                                     service.billingType === "per_session" ? "Per Session" :
                                                     "Per Day"}
                                                </span>
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Base Rate:</span>
                                            <p className="text-gray-700 font-medium">{service.baseRate.toLocaleString()} Kip</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Commission:</span>
                                            <p className="text-gray-700">{service.commission}%</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Models:</span>
                                            <p className="text-gray-700 flex items-center">
                                                <Users className="h-3 w-3 mr-1" />
                                                {service._count?.ModelService?.toLocaleString() || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Created:</span>
                                            <p className="text-gray-700">
                                                {new Date(service.createdAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                        {canEdit && (
                                            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                <Link to={`${service.id}`}>
                                                    <Pencil className="h-3 w-3 mr-1" />Edit
                                                </Link>
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button variant="outline" size="sm" className="h-8 px-2 text-red-500 border-red-200 hover:bg-red-50" asChild>
                                                <Link to={`delete/${service.id}`}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <EmptyPage
                                    title="No services found!"
                                    description="There is no service in the database yet!"
                                />
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-100">
                                        <TableHead className="font-semibold">NO</TableHead>
                                        <TableHead className="font-semibold">Service</TableHead>
                                        <TableHead className="font-semibold">Billing Type</TableHead>
                                        <TableHead className="font-semibold">Base Rate</TableHead>
                                        <TableHead className="font-semibold">Commission</TableHead>
                                        <TableHead className="font-semibold">Models</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Created At</TableHead>
                                        <TableHead className="font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services && services.length > 0 ? services.map((service, index: number) => (
                                        <TableRow key={service.id} className="border-gray-50 hover:bg-gray-50">
                                            <TableCell className="text-sm font-medium text-gray-900">{index + 1}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {service.description && service.description.length > 30
                                                            ? `${service.description.substring(0, 30)}...`
                                                            : service.description}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    service.billingType === "per_hour" ? "bg-blue-100 text-blue-700" :
                                                    service.billingType === "per_session" ? "bg-purple-100 text-purple-700" :
                                                    "bg-green-100 text-green-700"
                                                }`}>
                                                    {service.billingType === "per_hour" ? "Per Hour" :
                                                     service.billingType === "per_session" ? "Per Session" :
                                                     "Per Day"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-gray-900">{service.baseRate.toLocaleString()} Kip</TableCell>
                                            <TableCell>
                                                {service.commission}%
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center text-gray-700">
                                                    <Users className="h-4 w-4 mr-1 text-gray-400" />
                                                    {service._count?.ModelService?.toLocaleString() || 0}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={service.status} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-gray-500">
                                                    {new Date(service.createdAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </div>
                                            </TableCell>
                                            {canEdit && <TableCell>
                                                <div className="text-gray-500 flex items-center space-x-1">
                                                    {canEdit && <Link to={`${service.id}`}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        <span className="sr-only">Edit</span>
                                                    </Link>}
                                                    {canDelete && <Link to={`delete/${service.id}`}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        <span className="sr-only">Delete</span>
                                                    </Link>}
                                                </div>
                                            </TableCell>}
                                        </TableRow>
                                    )) : <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12">
                                            <EmptyPage
                                                title="No services found!"
                                                description="There is no service in the database yet!"
                                            />
                                        </TableCell>
                                    </TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "service",
        action: "view",
    });
    const url = new URL(request.url);
    const success = url.searchParams.get("success");
    try {
        const [services, servicesStatus] = await Promise.all([
            getServices(),
            getServicesStatus()
        ]);

        if (!services) throw new Error("Failed to fetch services");
        return json({ services, servicesStatus, success })

    } catch (error) {
        console.error("LOADER_SERVICES_FAILED", error);
        throw new Error("Failed to fetch services");
    }
}
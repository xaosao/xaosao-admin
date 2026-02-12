import { toast } from "react-toastify";
import React, { useCallback, useRef, useState } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    Heart,
    Star,
    Plus,
    ArrowUpRight,
    Trash2,
    EyeIcon,
    User,
    UserLock,
    UserCheck,
    UserX,
    Search,
    X,
    MoreVertical,
    UserPen,
    CheckSquare,
    Shield,
    MessageCircle,
} from "lucide-react";

import EmptyPage from "~/components/ui/empty";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";

// Utils and services
import { IStatusItem } from "~/interfaces";
import { IModels } from "~/interfaces/model";
import { useAuthStore } from "~/store/permissionStore";
import { IFilters, IPagination } from "~/interfaces/base";
import { calculateAgeFromDOB, formatDate1 } from "~/utils";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getModels, getModelStatus, getPendingModelCount } from "~/services/model.server";

interface LoaderData {
    models: IModels[];
    pagination: IPagination;
    filters: IFilters;
    modelStatus: IStatusItem[];
    count: number,
    success: string;
}

const iconMap = {
    Heart,
    UserCheck,
    UserLock,
    UserX
};

export default function Models() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { models, modelStatus, count, pagination, filters, success } = useLoaderData<LoaderData>();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Open WhatsApp chat with model
    const openWhatsAppChat = (whatsappNumber: number | string, modelName: string) => {
        if (!whatsappNumber) {
            toast.error("This model has no WhatsApp number");
            return;
        }
        const phoneNumber = String(whatsappNumber).replace(/\D/g, "");
        const message = encodeURIComponent(
            `ສະບາຍດີ ${modelName}! 👋\n\n` +
            `ນີ້ແມ່ນທີມງານ XaoSao Admin.\n\n` +
            `---\n` +
            `Hello ${modelName}! 👋\n` +
            `This is XaoSao Admin team.`
        );
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
    };

    const updateFilters = useCallback((updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        if (!updates.page && Object.keys(updates).length > 0) {
            params.set("page", "1");
        }

        navigate(`?${params.toString()}`, { replace: true });
    }, [searchParams, navigate]);

    const clearFilters = useCallback(() => {
        if (formRef.current) {
            formRef.current.reset();
        }
        navigate("", { replace: true });
    }, [navigate]);

    const handleSearchSubmit = useCallback((formData: FormData) => {
        const search = formData.get("search") as string;
        const status = formData.get("status") as string;
        const type = formData.get("type") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            status: status || "all",
            type: type || "all",
            from: from || "",
            to: to || "",
            showBy: showBy || "10",
        });
    }, [updateFilters]);

    React.useEffect(() => {
        if (success) {
            toast.success(success);

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");

            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("model", "view");
    const canCreate = hasPermission("model", "create");
    const canEdit = hasPermission("model", "edit");
    const canDelete = hasPermission("model", "delete");

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Models Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Models management", value: "/models" },
                        ]}
                    />
                </div>
                <div className="flex items-center justify-end">
                    {count > 0 && canEdit && <Button variant="ghost" size="sm" className="relative h-10 w-32 p-0 border rounded mr-5">
                        <Link to="approval">
                            <span className="flex items-center justify-start"> <CheckSquare />&nbsp; Approval</span>
                            <Badge className="animate-bounce absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 bg-pink-500 text-white text-xs">
                                {count}
                            </Badge>
                        </Link>
                    </Button>}

                    {canCreate && <Button className="bg-dark-pink hover:opacity-90 text-white">
                        <Link to="create" className="flex items-center justify-center">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Model
                        </Link>
                    </Button>}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {modelStatus.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card key={stat.title} className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                        <div className="flex items-center mt-1">
                                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                                        </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-gray-50">
                                        {IconComponent && (
                                            <IconComponent className={`h-4 w-4 ${stat.color}`} />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Card className="border-0 shadow-md rounded-md">
                <CardHeader className="pb-0">
                    <Form
                        ref={formRef}
                        method="get"
                        onChange={(e) => {
                            const formData = new FormData(e.currentTarget);
                            handleSearchSubmit(formData);
                        }}
                        className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2"
                    >
                        <div className="flex flex-1 items-center space-x-4 sm:space-x-2">
                            <div className="relative max-w-xs w-full hidden sm:block">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by name, email, or ID..."
                                    className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-36 hidden sm:block">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="deleted">Deleted</option>
                                </select>
                            </div>
                            <div className="w-32 hidden sm:block">
                                <select
                                    name="type"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.type || "all"}
                                >
                                    <option value="all">All Types</option>
                                    <option value="normal">Normal</option>
                                    <option value="special">Special</option>
                                    <option value="partner">Partner</option>
                                </select>
                            </div>
                            <div className="w-full flex items-center space-x-2">
                                <input
                                    type="date"
                                    name="from"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.fromDate}
                                    placeholder="start date"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    name="to"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.toDate}
                                    placeholder="end date"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="flex items-center space-x-1"
                            >
                                <X className="h-3 w-3" />
                                <span>Clear</span>
                            </Button>
                            <div className="block sm:hidden relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by name, email, or ID..."
                                    className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-36 block sm:hidden">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="deleted">Deleted</option>
                                </select>
                            </div>
                            <div className="w-32 block sm:hidden">
                                <select
                                    name="type"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.type || "all"}
                                >
                                    <option value="all">All Types</option>
                                    <option value="normal">Normal</option>
                                    <option value="special">Special</option>
                                    <option value="partner">Partner</option>
                                </select>
                            </div>
                            <div className="w-28">
                                <select
                                    name="showBy"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.showBy.toString()}
                                >
                                    <option value="10">10</option>
                                    <option value="30">30</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </Form>
                </CardHeader>
                <CardContent className="p-0 mt-4">
                    <div className="block md:hidden p-4 space-y-4">
                        {models && models.length > 0 ? models.map((model, index: number) => (
                            <div key={model.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                <div className="flex items-start space-x-3 mb-3">
                                    <div
                                        className="relative cursor-pointer"
                                        onClick={() => model.profile && setSelectedImage(model.profile)}
                                    >
                                        <Avatar className="h-14 w-14 hover:ring-2 hover:ring-pink-300 transition-all">
                                            <AvatarImage src={model.profile} alt={model.firstName} />
                                            <AvatarFallback className="text-sm">{model.firstName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-gray-900">#{index + 1} {model.firstName} {model.lastName}</p>
                                            <StatusBadge status={model.status} />
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {(model?.location as any)?.countryName} ({(model?.location as any)?.countryNameNative})
                                        </p>
                                        <p className="text-xs text-gray-500">Age: {calculateAgeFromDOB(model.dob)}</p>
                                    </div>
                                </div>

                                {model.bio && (
                                    <p className="text-xs text-gray-500 mb-3 italic">"{model.bio}"</p>
                                )}

                                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                    <div>
                                        <span className="text-gray-400">Address:</span>
                                        <p className="text-gray-700">{model.address || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Created:</span>
                                        <p className="text-gray-700">{formatDate1(model.createdAt)}</p>
                                    </div>
                                </div>

                                {model.ModelService && model.ModelService.length > 0 && (
                                    <div className="mb-3">
                                        <span className="text-xs text-gray-400">Services:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {model.ModelService.map((service: any) => (
                                                <Badge key={service.id} variant="outline" className="text-xs">
                                                    {service?.service?.name ?? ""}: ${service.customRate ? service.customRate : service.service.baseRate ?? 0}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-xs mb-3">
                                    <div className="flex items-center space-x-1">
                                        <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                        <span className="text-gray-700">Rating: {model.rating}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <User className="h-3 w-3 text-gray-500" />
                                        <span className="text-gray-700">Reviews: {model.total_review}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                    {canEdit && (
                                        <>
                                            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                <Link to={`view/${model.id}`}>
                                                    <EyeIcon className="h-3 w-3 mr-1" />View
                                                </Link>
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                <Link to={`${model.id}`}>
                                                    <UserPen className="h-3 w-3 mr-1" />Edit
                                                </Link>
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                <Link to={`status/${model.id}`}>
                                                    <Shield className="h-3 w-3 mr-1" />Status
                                                </Link>
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="h-8 px-2 bg-green-500 hover:bg-green-600 text-white"
                                                onClick={() => openWhatsAppChat(model.whatsapp, model.firstName)}
                                                title="Chat via WhatsApp"
                                            >
                                                <MessageCircle className="h-3 w-3 mr-1" />Chat
                                            </Button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <Button variant="outline" size="sm" className="h-8 px-2 text-red-500 border-red-200 hover:bg-red-50" asChild>
                                            <Link to={`delete/${model.id}`}>
                                                <Trash2 className="h-3 w-3" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <EmptyPage
                                title="No model found!"
                                description="There is no model data in the database yet!"
                            />
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-gray-100">
                                    <TableHead className="font-semibold">NO</TableHead>
                                    <TableHead className="font-semibold">Model info</TableHead>
                                    <TableHead className="font-semibold">Address</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">Rate price</TableHead>
                                    <TableHead className="font-semibold">Rating</TableHead>
                                    <TableHead className="font-semibold">Created at</TableHead>
                                    <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody >
                                {models && models.length > 0 ? models.map((model, index: number) => {
                                    return (
                                        <TableRow key={model.id} className="border-gray-50 hover:bg-gray-50 text-gray-500">
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <div
                                                        className="relative cursor-pointer"
                                                        onClick={() => model.profile && setSelectedImage(model.profile)}
                                                    >
                                                        <Avatar className="h-10 w-10 hover:ring-2 hover:ring-pink-300 transition-all">
                                                            <AvatarImage src={model.profile} alt={model.firstName} />
                                                            <AvatarFallback className="text-xs">{model.firstName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{model.firstName} &nbsp;{model.lastName}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {(model?.location as any)?.countryName} ({(model?.location as any)?.countryNameNative})
                                                            • Age: {calculateAgeFromDOB(model.dob)}</p>
                                                        <p className="text-xs text-gray-400">{model.bio}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {model.address}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={model.status} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-start justify-start flex-col text-gray-500 gap-2">
                                                    {model.ModelService.length > 0 && model?.ModelService?.map((service: any) => {
                                                        return (
                                                            <p key={service.id} className="text-sm flex items-center">{service?.service?.name ?? ""}:&nbsp;${service.customRate ? service.customRate : service.service.baseRate ?? 0}</p>
                                                        )
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-1">Rating:&nbsp;
                                                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                                    <span className="text-sm font-medium">{model.rating}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">Review:&nbsp;
                                                    <User className="h-3 w-3 text-yellow-500 fill-current" />
                                                    <span className="text-sm font-medium">{model.total_review}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatDate1(model.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    {canEdit && <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                                <MoreVertical className="h-3 w-3" />
                                                                <span className="sr-only">More</span>
                                                            </Button>
                                                        </Button>
                                                    </DropdownMenuTrigger>}
                                                    <DropdownMenuContent className="w-48" align="end" forceMount>
                                                        {canEdit && <DropdownMenuItem className="text-sm">
                                                            <Link to={`view/${model.id}`} className="flex space-x-2 w-full">
                                                                <EyeIcon className="mr-2 h-3 w-3" />
                                                                <span>View details</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        }
                                                        {canEdit && <DropdownMenuItem className="text-sm">
                                                            <Link to={`${model.id}`} className="flex space-x-2 w-full">
                                                                <UserPen className="mr-2 h-3 w-3" />
                                                                <span>Edit </span>
                                                            </Link>
                                                        </DropdownMenuItem>}
                                                        {canEdit && <DropdownMenuItem className="text-sm">
                                                            <Link to={`status/${model.id}`} className="flex space-x-2 w-full">
                                                                <Shield className="mr-2 h-3 w-3" />
                                                                <span>Update status</span>
                                                            </Link>
                                                        </DropdownMenuItem>}
                                                        {canEdit && <DropdownMenuItem className="text-sm cursor-pointer" onClick={() => openWhatsAppChat(model.whatsapp, model.firstName)}>
                                                            <MessageCircle className="mr-2 h-3 w-3 text-green-500" />
                                                            <span>Chat</span>
                                                        </DropdownMenuItem>}
                                                        {model.ModelService && model.ModelService.length > 0 && canEdit && <DropdownMenuItem className="text-sm">
                                                            <Link to={`edit/${model.id}`} className="flex space-x-2 w-full">
                                                                <Heart className="mr-2 h-3 w-3" />
                                                                <span>Update service rate</span>
                                                            </Link>
                                                        </DropdownMenuItem>}
                                                        {canDelete && <DropdownMenuItem className="text-sm">
                                                            <Link to={`delete/${model.id}`} className="flex space-x-2 w-full">
                                                                <Trash2 className="mr-2 h-3 w-3" />
                                                                <span>Delete</span>
                                                            </Link>
                                                        </DropdownMenuItem>}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) :
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <EmptyPage
                                                title="No model found!"
                                                description="There is no model data in the database yet!"
                                            />
                                        </TableCell>
                                    </TableRow>
                                }
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalCount={pagination.totalCount}
                        limit={pagination.limit}
                        hasNextPage={pagination.hasNextPage}
                        hasPreviousPage={pagination.hasPreviousPage}
                        baseUrl=""
                        searchParams={searchParams}
                    />
                </CardContent>
            </Card>

            {/* Full Screen Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="h-6 w-6 text-white" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Profile preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "model",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const type = searchParams.get("type") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);


    try {
        const [models, modelStatus, count] = await Promise.all([
            getModels({
                search,
                status,
                type,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
            getModelStatus(),
            getPendingModelCount()
        ])

        return json({
            models: models.models,
            pagination: models.pagination,
            modelStatus,
            count,
            success,
            filters: {
                search,
                status,
                type,
                fromDate,
                toDate,
                page,
                showBy,
            }
        });
    } catch (error) {
        console.log("LOAD_MODEL_DATA_FAILED", error)
        throw new Error("Failed to fetch model data");
    }
}
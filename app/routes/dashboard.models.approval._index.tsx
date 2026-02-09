import { toast } from "react-toastify";
import React, { useCallback, useRef, useState } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";

import EmptyPage from "~/components/ui/empty";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";
import {
    EyeIcon,
    Search,
    X,
    ArrowLeft,
    Check,
    MessageCircle,
} from "lucide-react";

// hooks
import { usePolling } from "~/hooks/usePolling";

// Utils and services
import { IStatusItem } from "~/interfaces";
import { IModels } from "~/interfaces/model";
import { useAuthStore } from "~/store/permissionStore";
import { IFilters, IPagination } from "~/interfaces/base";
import { getModelsApproval } from "~/services/model.server";
import { calculateAgeFromDOB, capitalizeFirstLetter, formatDate1 } from "~/utils";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

interface LoaderData {
    models: IModels[];
    pagination: IPagination;
    filters: IFilters;
    modelStatus: IStatusItem[];
    success: string;
}

export default function ModelsApprovalPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { models, pagination, filters, success } = useLoaderData<LoaderData>();
    usePolling(30_000); // Auto-refresh every 30 seconds
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Open WhatsApp chat with welcome message to verify model's number
    const openWhatsAppChat = (whatsappNumber: number | string, modelName: string) => {
        if (!whatsappNumber) {
            toast.error("This model has no WhatsApp number");
            return;
        }
        // Format phone number (remove any non-digit characters)
        const phoneNumber = String(whatsappNumber).replace(/\D/g, "");
        // Welcome message for verification
        const message = encodeURIComponent(
            `ສະບາຍດີ ${modelName}! 👋\n\n` +
            `ນີ້ແມ່ນທີມງານ XaoSao Admin.\n` +
            `ພວກເຮົາກຳລັງກວດສອບບັນຊີຂອງທ່ານ.\n\n` +
            `ກະລຸນາຕອບກັບຂໍ້ຄວາມນີ້ເພື່ອຢືນຢັນເບີ WhatsApp ຂອງທ່ານ.\n\n` +
            `---\n` +
            `Hello ${modelName}! 👋\n` +
            `This is XaoSao Admin team.\n` +
            `We are verifying your account.\n\n` +
            `Please reply to this message to confirm your WhatsApp number.`
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
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            from: from || "",
            to: to || "",
            showBy: showBy || "10",
        });
    }, [updateFilters]);

    const hasActiveFilters = filters.search || filters.fromDate || filters.toDate;

    function closeHandler() {
        navigate("..");
    }

    React.useEffect(() => {
        if (success) {
            toast.success(success);

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");

            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("model", "view");
    const canEdit = hasPermission("model", "edit");

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
                    <h1 className="text-md sm:text-xl font-semibold text-gray-900 mb-2">Models Approval</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Models management", value: "/models" },
                            { label: "Approval", value: "/models/approval" },
                        ]}
                    />
                </div>
                <div className="hidden sm:block">
                    <Button variant="ghost" size="sm" className="h-10 w-24 p-0 border rounded mr-5" onClick={closeHandler}>
                        <span className="flex items-center justify-start"> <ArrowLeft />&nbsp; Back</span>
                    </Button>
                </div>
            </div>
            <Card className="border-0 shadow-md">
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
                        <div className="flex flex-1 items-center space-x-4">
                            <div className="hidden sm:block relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by name, email, or ID..."
                                    className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-56 flex items-center space-x-2">
                                <input
                                    type="date"
                                    name="from"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.fromDate}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    name="to"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.toDate}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-2">
                            {hasActiveFilters && (
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
                            )}
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
                    {/* Mobile Card View */}
                    <div className="block md:hidden p-4 space-y-4">
                        {models.length > 0 ? models.map((model, index: number) => (
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
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${model.status === "active" ? "text-green-800 border-green-200" : "text-red-800 border-red-200"}`}
                                            >
                                                {capitalizeFirstLetter(model.status)}
                                            </Badge>
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

                                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                                    {canAccess && (
                                        <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                            <Link to={`/dashboard/models/view/${model.id}`}>
                                                <EyeIcon className="h-3 w-3" />
                                            </Link>
                                        </Button>
                                    )}
                                    {canEdit && (
                                        <>
                                            <Button
                                                size="sm"
                                                className="h-8 px-2 bg-green-500 hover:bg-green-600 text-white"
                                                onClick={() => openWhatsAppChat(model.whatsapp, model.firstName)}
                                                title="Verify WhatsApp number"
                                            >
                                                <MessageCircle className="h-3 w-3" />
                                            </Button>
                                            <Button size="sm" className="h-8 px-2 bg-white hover:bg-green-50 text-green-500 border border-green-500" asChild>
                                                <Link to={`${model.id}`}>
                                                    <Check className="h-3 w-3" />Approve
                                                </Link>
                                            </Button>
                                            <Button size="sm" className="h-8 px-2 bg-white hover:bg-red-50 text-red-500 border border-red-500" asChild>
                                                <Link to={`reject/${model.id}`}>
                                                    <X className="h-3 w-3" />Reject
                                                </Link>
                                            </Button>
                                        </>
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
                                    <TableHead className="font-semibold">Created at</TableHead>
                                    <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody >
                                {models.length > 0 ? models.map((model, index: number) => {
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
                                                <div className="flex items-center space-x-1">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${model.status === "active" ? "text-green-800 border-green-200" : "text-red-800 border-red-200"
                                                            }`}
                                                    >
                                                        {capitalizeFirstLetter(model.status)}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatDate1(model.createdAt)}
                                            </TableCell>
                                            <TableCell className="flex items-center justify-start gap-2">
                                                {canAccess && <Button className="bg-white hover:bg-white hover:text-gray-500 text-gray-500 border px-2">
                                                    <Link to={`/dashboard/models/view/${model.id}`} className="flex items-center justify-center">
                                                        <EyeIcon className="h-4 w-4 mr-1" />Review
                                                    </Link>
                                                </Button>}
                                                {canEdit && <Button
                                                    className="bg-green-500 hover:bg-green-600 text-white px-2"
                                                    onClick={() => openWhatsAppChat(model.whatsapp, model.firstName)}
                                                    title="Verify WhatsApp number before approval"
                                                >
                                                    <MessageCircle className="h-4 w-4 mr-1" />
                                                    Chat
                                                </Button>}
                                                {canEdit && <Button className="bg-white hover:bg-white hover:opacity-90 text-green-500 border border-green-500 px-2">
                                                    <Link to={`${model.id}`} className="flex items-center justify-center">
                                                        <Check className="h-4 w-4 mr-1" />
                                                        Approve
                                                    </Link>
                                                </Button>}
                                                {canEdit && <Button className="bg-white hover:bg-white hover:opacity-90 text-red-500 border border-red-500 px-2">
                                                    <Link to={`reject/${model.id}`} className="flex items-center justify-center">
                                                        <X className="h-3 w-3 mr-1" />
                                                        Reject
                                                    </Link>
                                                </Button>}
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
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);


    try {
        const [models] = await Promise.all([
            getModelsApproval({
                search,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
        ])
        if (!models) throw new Error("Failed to fetch models")

        return json({
            ...models,
            success,
            filters: {
                search,
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
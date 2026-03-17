import { toast } from "react-toastify";
import React, { useCallback, useRef, useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import {
    useLoaderData,
    useSearchParams,
    useNavigate,
    Form,
    useFetcher,
} from "@remix-run/react";
import {
    Search,
    EyeIcon,
    Trash2,
    MoreVertical,
    MessageCircle,
    CreditCard,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    BarChart3,
    X,
    CalendarRange,
    Users,
    DollarSign,
    Repeat,
    User,
} from "lucide-react";

// components
import EmptyPage from "~/components/ui/empty";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";

// utils and backend
import {
    requireUserPermission,
    requireUserSession,
} from "~/services/auth.server";
import { useAuthStore } from "~/store/permissionStore";
import {
    getSubscriptions,
    getSubscriptionStats,
    getSubscriptionPlans,
    getSubscriptionSummary,
    updateSubscriptionStatus,
    deleteSubscription,
    reactivateSubscription,
} from "~/services/subscription.server";
import { formatDate } from "~/utils";

const iconMap: Record<string, React.ElementType> = {
    CreditCard,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
};

function formatCurrency(amount: number) {
    if (amount === undefined || amount === null) return "0 Kip";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " Kip";
}

export default function SubscriptionsIndex() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const fetcher = useFetcher();
    const {
        subscriptions,
        subscriptionStats,
        plans,
        pagination,
        filters,
        success,
        summary,
    } = useLoaderData<typeof loader>();

    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(false);

    const updateFilters = useCallback(
        (updates: Record<string, string>) => {
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
        },
        [searchParams, navigate]
    );

    const handleSearchSubmit = useCallback(
        (formData: FormData) => {
            const search = formData.get("search") as string;
            const status = formData.get("status") as string;
            const packageFilter = formData.get("package") as string;
            const from = formData.get("from") as string;
            const to = formData.get("to") as string;
            const showBy = formData.get("showBy") as string;

            updateFilters({
                search: search || "",
                status: status || "all",
                package: packageFilter || "all",
                from: from || "",
                to: to || "",
                showBy: showBy || "10",
            });
        },
        [updateFilters]
    );

    React.useEffect(() => {
        if (success) {
            toast.success(success);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");
            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("subscription", "view");
    const canEdit = hasPermission("subscription", "edit");
    const canDelete = hasPermission("subscription", "delete");

    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        );
    }

    const handleUpdateStatus = (subscriptionId: string, newStatus: string) => {
        fetcher.submit(
            { actionType: "updateStatus", subscriptionId, newStatus },
            { method: "post" }
        );
    };

    const handleDelete = (subscriptionId: string) => {
        fetcher.submit(
            { actionType: "delete", subscriptionId },
            { method: "post" }
        );
        setDeleteConfirm(null);
    };

    const handleReactivate = (subscriptionId: string) => {
        fetcher.submit(
            { actionType: "reactivate", subscriptionId },
            { method: "post" }
        );
    };

    const selectClass = "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
    const inputClass = "pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">
                        Subscription Management
                    </h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Subscriptions", value: "/dashboard/subscriptions" },
                        ]}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {subscriptionStats.map((stat) => {
                    const IconComponent = iconMap[stat.icon];
                    return (
                        <Card
                            key={stat.title}
                            className="border-0 shadow-md hover:shadow-md transition-shadow cursor-pointer rounded-md"
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                            {stat.title}
                                        </p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">
                                            {stat.value}
                                        </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-gray-50">
                                        {IconComponent && (
                                            <IconComponent className={`h-4 w-4 ${stat.color}`} />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filters & Table */}
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
                            {/* Search - Desktop */}
                            <div className="hidden sm:block relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by name or whatsapp..."
                                    className={inputClass}
                                    defaultValue={filters.search}
                                />
                            </div>
                            {/* Status - Desktop */}
                            <div className="hidden sm:block w-40">
                                <select
                                    name="status"
                                    className={selectClass}
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="expired">Expired</option>
                                    <option value="canceled">Canceled</option>
                                    <option value="pending">Pending</option>
                                    <option value="pending_payment">Pending Payment</option>
                                </select>
                            </div>
                            {/* Package - Desktop */}
                            <div className="hidden sm:block w-44">
                                <select
                                    name="package"
                                    className={selectClass}
                                    defaultValue={filters.package}
                                >
                                    <option value="all">All Packages</option>
                                    {plans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Date Range */}
                            <div className="w-full sm:w-56 flex items-center space-x-2">
                                <input
                                    type="date"
                                    name="from"
                                    className={inputClass.replace("pl-9 ", "")}
                                    defaultValue={filters.fromDate}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    name="to"
                                    className={inputClass.replace("pl-9 ", "")}
                                    defaultValue={filters.toDate}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-2">
                            {/* Search - Mobile */}
                            <div className="block sm:hidden relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search..."
                                    className={inputClass}
                                    defaultValue={filters.search}
                                />
                            </div>
                            {/* Status - Mobile */}
                            <div className="block sm:hidden w-36">
                                <select
                                    name="status"
                                    className={selectClass}
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="expired">Expired</option>
                                    <option value="canceled">Canceled</option>
                                    <option value="pending">Pending</option>
                                    <option value="pending_payment">Pending Payment</option>
                                </select>
                            </div>
                            {/* Package - Mobile */}
                            <div className="block sm:hidden w-44">
                                <select
                                    name="package"
                                    className={selectClass}
                                    defaultValue={filters.package}
                                >
                                    <option value="all">All Packages</option>
                                    {plans.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {/* Show By */}
                            <div className="w-28">
                                <select
                                    name="showBy"
                                    className={selectClass}
                                    defaultValue={filters.showBy.toString()}
                                >
                                    <option value="10">10</option>
                                    <option value="30">30</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                            {/* Summary Button */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-10 px-3 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                onClick={() => setShowSummary(true)}
                            >
                                <BarChart3 className="h-4 w-4" />
                            </Button>
                        </div>
                    </Form>
                </CardHeader>
                <CardContent className="p-0 mt-6">
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3 p-3">
                        {subscriptions && subscriptions.length > 0 ? (
                            subscriptions.map((sub: any) => (
                                <div key={sub.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage
                                                    src={sub.customer?.profile ?? ""}
                                                    alt={`${sub.customer?.firstName} ${sub.customer?.lastName}`}
                                                />
                                                <AvatarFallback>
                                                    {sub.customer?.firstName?.charAt(0) || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {sub.customer?.firstName} {sub.customer?.lastName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {sub.customer?.whatsapp}
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge status={sub.status} />
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Package:</span>
                                            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                                                {sub.plan?.name}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Times subscribed:</span>
                                            <span className="text-gray-700 font-medium">
                                                {sub._planCount || 1}x
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Start Date:</span>
                                            <span className="text-gray-700">{formatDate(sub.startDate || "")}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Expired Date:</span>
                                            <span className="text-gray-700">{formatDate(sub.endDate || "")}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Amount:</span>
                                            <span className="text-gray-700 font-medium">{formatCurrency(sub.plan?.price || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Payment:</span>
                                            <span className="text-gray-700">{sub.paymentMethod || "N/A"}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
                                        {sub.customer?.whatsapp && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                                                title="Chat on WhatsApp"
                                                onClick={() => window.open(`https://wa.me/${sub.customer.whatsapp}`, "_blank")}
                                            >
                                                <MessageCircle className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {canEdit && (sub.status === "expired" || sub.status === "canceled") && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                title="Re-activate"
                                                onClick={() => handleReactivate(sub.id)}
                                            >
                                                <Repeat className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {canEdit && sub.status === "active" && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-orange-600 border-orange-200 hover:bg-orange-50"
                                                title="Cancel"
                                                onClick={() => handleUpdateStatus(sub.id, "canceled")}
                                            >
                                                <XCircle className="h-3 w-3" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                                                title="Delete"
                                                onClick={() => setDeleteConfirm(sub.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyPage
                                title="No subscriptions found!"
                                description="There are no subscriptions matching your filters."
                            />
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-gray-100">
                                    <TableHead className="font-semibold">#</TableHead>
                                    <TableHead className="font-semibold">Customer</TableHead>
                                    <TableHead className="font-semibold">Package</TableHead>
                                    <TableHead className="font-semibold">Times</TableHead>
                                    <TableHead className="font-semibold">Start Date</TableHead>
                                    <TableHead className="font-semibold">Expired Date</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">Amount</TableHead>
                                    <TableHead className="font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subscriptions && subscriptions.length > 0 ? (
                                    subscriptions.map((sub: any, index: number) => (
                                        <TableRow
                                            key={sub.id}
                                            className="border-gray-50 hover:bg-gray-50"
                                        >
                                            <TableCell className="text-gray-600">
                                                {(pagination.currentPage - 1) * pagination.limit + index + 1}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage
                                                            src={sub.customer?.profile ?? ""}
                                                            alt={`${sub.customer?.firstName} ${sub.customer?.lastName}`}
                                                        />
                                                        <AvatarFallback>
                                                            {sub.customer?.firstName?.charAt(0) || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {sub.customer?.firstName} {sub.customer?.lastName}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {sub.customer?.whatsapp}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                                                    {sub.plan?.name}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {sub._planCount || 1}x
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {formatDate(sub.startDate || "")}
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {formatDate(sub.endDate || "")}
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={sub.status} />
                                            </TableCell>
                                            <TableCell className="text-gray-600 font-medium">
                                                {formatCurrency(sub.plan?.price || 0)}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <MoreVertical className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-48" align="end" forceMount>
                                                        <DropdownMenuItem
                                                            className="text-sm cursor-pointer"
                                                            onClick={() => navigate(`/dashboard/customers/view/${sub.customerId}`)}
                                                        >
                                                            <EyeIcon className="mr-2 h-3 w-3" />
                                                            <span>View Customer</span>
                                                        </DropdownMenuItem>

                                                        {sub.customer?.whatsapp && (
                                                            <DropdownMenuItem
                                                                className="text-sm cursor-pointer"
                                                                onClick={() => window.open(`https://wa.me/${sub.customer.whatsapp}`, "_blank")}
                                                            >
                                                                <MessageCircle className="mr-2 h-3 w-3" />
                                                                <span>Chat on WhatsApp</span>
                                                            </DropdownMenuItem>
                                                        )}

                                                        {canEdit && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                {(sub.status === "expired" || sub.status === "canceled") && (
                                                                    <DropdownMenuItem
                                                                        className="text-sm cursor-pointer text-blue-600"
                                                                        onClick={() => handleReactivate(sub.id)}
                                                                    >
                                                                        <Repeat className="mr-2 h-3 w-3" />
                                                                        <span>Re-activate</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {sub.status !== "active" && sub.status !== "expired" && sub.status !== "canceled" && (
                                                                    <DropdownMenuItem
                                                                        className="text-sm cursor-pointer text-green-600"
                                                                        onClick={() => handleUpdateStatus(sub.id, "active")}
                                                                    >
                                                                        <CheckCircle className="mr-2 h-3 w-3" />
                                                                        <span>Set Active</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {sub.status !== "expired" && (
                                                                    <DropdownMenuItem
                                                                        className="text-sm cursor-pointer text-gray-600"
                                                                        onClick={() => handleUpdateStatus(sub.id, "expired")}
                                                                    >
                                                                        <Clock className="mr-2 h-3 w-3" />
                                                                        <span>Set Expired</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {sub.status !== "canceled" && (
                                                                    <DropdownMenuItem
                                                                        className="text-sm cursor-pointer text-orange-600"
                                                                        onClick={() => handleUpdateStatus(sub.id, "canceled")}
                                                                    >
                                                                        <XCircle className="mr-2 h-3 w-3" />
                                                                        <span>Set Canceled</span>
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </>
                                                        )}

                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-sm cursor-pointer text-red-600"
                                                                    onClick={() => setDeleteConfirm(sub.id)}
                                                                >
                                                                    <Trash2 className="mr-2 h-3 w-3" />
                                                                    <span>Delete</span>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12">
                                            <EmptyPage
                                                title="No subscriptions found!"
                                                description="There are no subscriptions matching your filters."
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
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

            {/* Summary Modal */}
            {showSummary && summary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowSummary(false)}
                    />
                    <div className="relative bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-purple-100">
                                    <BarChart3 className="h-5 w-5 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Subscription Summary
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSummary(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-4">
                            <CalendarRange className="h-5 w-5 text-gray-500 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Period</p>
                                <p className="text-sm font-medium text-gray-900">
                                    {summary.startDate ? formatDate(summary.startDate) : "N/A"}
                                    {" "}&rarr;{" "}
                                    Present
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <CreditCard className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-gray-900">{summary.totalSubscriptions}</p>
                                <p className="text-xs text-gray-500">Total Subs</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                                <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
                                <p className="text-xs text-gray-500">Total Revenue</p>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                                <Users className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-gray-900">{summary.totalUniqueCustomers}</p>
                                <p className="text-xs text-gray-500">Customers</p>
                            </div>
                        </div>

                        {/* Repeat Subscription Breakdown */}
                        <div className="border-t pt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Repeat className="h-4 w-4 text-gray-500" />
                                <h4 className="text-sm font-semibold text-gray-700">Repeat Subscriptions</h4>
                            </div>
                            <div className="space-y-2">
                                {[
                                    { label: "Subscribed 2 times", value: summary.repeatBreakdown.times2 },
                                    { label: "Subscribed 3 times", value: summary.repeatBreakdown.times3 },
                                    { label: "Subscribed 4 times", value: summary.repeatBreakdown.times4 },
                                    { label: "Subscribed 5 times", value: summary.repeatBreakdown.times5 },
                                    { label: "More than 5 times", value: summary.repeatBreakdown.timesMore },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">{item.label}</span>
                                        <span className="flex items-center gap-2 text-sm font-bold text-gray-900">
                                            {item.value} {item.value <= 1 ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setDeleteConfirm(null)}
                    />
                    <div className="relative bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Delete Subscription
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to delete this subscription? This action cannot be undone and will also remove related history records.
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "subscription",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = searchParams.get("success");

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const packageFilter = searchParams.get("package") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    const [subscriptionData, subscriptionStats, plans, summary] = await Promise.all([
        getSubscriptions({
            search,
            package: packageFilter,
            status,
            fromDate,
            toDate,
            page,
            limit: showBy,
        }),
        getSubscriptionStats(),
        getSubscriptionPlans(),
        getSubscriptionSummary(),
    ]);

    // Enrich subscriptions with plan count per customer
    const customerIds = [
        ...new Set(subscriptionData.subscriptions.map((s) => s.customerId)),
    ];

    // Get plan counts for all customers in this page
    const { prisma } = await import("~/services/database.server");
    const planCounts = await prisma.subscription.groupBy({
        by: ["customerId", "planId"],
        where: { customerId: { in: customerIds } },
        _count: { id: true },
    });

    const planCountMap = new Map<string, number>();
    for (const pc of planCounts) {
        const key = `${pc.customerId}:${pc.planId}`;
        planCountMap.set(key, pc._count.id);
    }

    const enrichedSubscriptions = subscriptionData.subscriptions.map((sub) => ({
        ...sub,
        _planCount: planCountMap.get(`${sub.customerId}:${sub.planId}`) || 1,
    }));

    return json({
        subscriptions: enrichedSubscriptions,
        pagination: subscriptionData.pagination,
        subscriptionStats,
        plans,
        summary,
        success,
        filters: {
            search,
            status,
            package: packageFilter,
            fromDate,
            toDate,
            page,
            showBy,
        },
    });
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    if (actionType === "updateStatus") {
        await requireUserPermission({
            userId,
            group: "subscription",
            action: "edit",
        });
        const subscriptionId = formData.get("subscriptionId") as string;
        const newStatus = formData.get("newStatus") as string;

        try {
            await updateSubscriptionStatus(subscriptionId, newStatus);
            return redirect(
                `/dashboard/subscriptions?success=${encodeURIComponent(`Subscription status updated to ${newStatus}`)}`
            );
        } catch (error: any) {
            return json({ error: error.message || "Failed to update status" }, { status: 400 });
        }
    }

    if (actionType === "reactivate") {
        await requireUserPermission({
            userId,
            group: "subscription",
            action: "edit",
        });
        const subscriptionId = formData.get("subscriptionId") as string;

        try {
            await reactivateSubscription(subscriptionId);
            return redirect(
                `/dashboard/subscriptions?success=${encodeURIComponent("Subscription re-activated successfully")}`
            );
        } catch (error: any) {
            return json({ error: error.message || "Failed to re-activate subscription" }, { status: 400 });
        }
    }

    if (actionType === "delete") {
        await requireUserPermission({
            userId,
            group: "subscription",
            action: "delete",
        });
        const subscriptionId = formData.get("subscriptionId") as string;

        try {
            await deleteSubscription(subscriptionId);
            return redirect(
                `/dashboard/subscriptions?success=${encodeURIComponent("Subscription deleted successfully")}`
            );
        } catch (error: any) {
            return json({ error: error.message || "Failed to delete subscription" }, { status: 400 });
        }
    }

    return json({ error: "Invalid action" }, { status: 400 });
}

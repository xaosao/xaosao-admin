import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    X,
    Eye,
    Search,
    Users,
    UserCheck,
    MoreVertical,
    CheckCircle,
    RotateCcw,
    Clock,
    AlertTriangle,
    XCircle,
    CalendarDays,
    Phone,
    EyeOff,
} from "lucide-react";

// components
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
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

// hooks
import { usePolling } from "~/hooks/usePolling";

// service and utils
import { useAuthStore } from "~/store/permissionStore";
import { formatDate1 } from "~/utils";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getBookings, getBookingStats, type BookingStats } from "~/services/booking.server";

interface LoaderData {
    bookings: any[];
    stats: BookingStats;
    pagination: any;
    filters: any;
    success: string | null;
    error: string | null;
}

// Status badge configuration
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
    confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
    completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800 border-gray-200", icon: XCircle },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
    disputed: { label: "Disputed", color: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertTriangle },
};

export default function Bookings() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { bookings, stats, pagination, filters, success, error } = useLoaderData<LoaderData>();
    usePolling(15_000); // Auto-refresh every 15 seconds

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

    const handleSearchSubmit = useCallback((formData: FormData) => {
        const search = formData.get("search") as string;
        const status = formData.get("status") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            status: status || "all",
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
        if (error) {
            toast.error(error);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("error");
            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, error, navigate]);

    const canEdit = hasPermission("booking", "edit");
    const canAccess = hasPermission("booking", "view");

    // For now, allow access if user has transaction permission (we'll add booking permission later)
    const hasAccess = canAccess || hasPermission("transaction", "view");
    const hasEditAccess = canEdit || hasPermission("transaction", "edit");

    if (!hasAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        )
    }

    // Get status badge for customer/model
    const getCheckInBadge = (checkedInAt: string | null, label: string) => {
        if (checkedInAt) {
            return (
                <span className="w-fit inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                    <CheckCircle className="h-3 w-3" />
                    {label} Checked In
                </span>
            );
        }
        return (
            <span className="w-fit inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                <Clock className="h-3 w-3" />
                {label} Pending
            </span>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Service Bookings</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Service Bookings", value: "/bookings" },
                        ]}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-50">
                                <CalendarDays className="h-4 w-4 text-gray-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">Pending</p>
                                <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-yellow-50">
                                <Clock className="h-4 w-4 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Confirmed</p>
                                <p className="text-xl font-bold text-blue-700">{stats.confirmed}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-blue-50">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Completed</p>
                                <p className="text-xl font-bold text-green-700">{stats.completed}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-50">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Cancelled</p>
                                <p className="text-xl font-bold text-gray-700">{stats.cancelled}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-50">
                                <XCircle className="h-4 w-4 text-gray-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Disputed</p>
                                <p className="text-xl font-bold text-orange-700">{stats.disputed}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-orange-50">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <div className="">
                <Card className="lg:col-span-3 border-0 shadow-md rounded-md">
                    <CardHeader className="p-1 sm:p-4">
                        <Form
                            ref={formRef}
                            method="get"
                            onChange={(e) => {
                                const formData = new FormData(e.currentTarget);
                                handleSearchSubmit(formData);
                            }}
                            className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2"
                        >
                            <div className="flex flex-1 items-center space-x-1 sm:space-x-4">
                                {/* Search */}
                                <div className="hidden sm:block relative max-w-xs w-full">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        name="search"
                                        placeholder="Search customer or model..."
                                        className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.search}
                                    />
                                </div>
                                {/* Status filter */}
                                <div className="hidden sm:block w-32">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.status}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="disputed">Disputed</option>
                                    </select>
                                </div>
                                {/* Date range */}
                                <div className="w-full sm:w-56 flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-0">
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
                            <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-0 sm:space-x-2">
                                {/* Mobile search */}
                                <div className="w-28 sm:auto block sm:hidden relative max-w-xs w-full">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        name="search"
                                        placeholder="Search..."
                                        className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.search}
                                    />
                                </div>
                                {/* Mobile status */}
                                <div className="block sm:hidden w-28">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.status}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="disputed">Disputed</option>
                                    </select>
                                </div>
                                {/* Show by */}
                                <div className="w-20">
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
                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-t border-gray-100 hover:bg-gray-100">
                                        <TableHead className="font-semibold">No</TableHead>
                                        <TableHead className="font-semibold">Customer</TableHead>
                                        <TableHead className="font-semibold">Model</TableHead>
                                        <TableHead className="font-semibold">Service</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bookings && bookings.length > 0 ? bookings.map((booking: any, index: number) => {
                                        const statusInfo = statusConfig[booking.status] || statusConfig.pending;
                                        const StatusIcon = statusInfo.icon;
                                        // Admin can refund/complete pending, confirmed, or disputed bookings (not completed/cancelled/rejected)
                                        const canRefund = ["pending", "confirmed", "disputed"].includes(booking.status);
                                        const canComplete = ["pending", "confirmed", "disputed"].includes(booking.status);

                                        // Show call buttons only for disputed or confirmed bookings
                                        const showCallButtons = ["disputed", "confirmed"].includes(booking.status);

                                        return (
                                            <TableRow key={booking.id} className="border-gray-50 hover:bg-gray-50">
                                                <TableCell>{(pagination.currentPage - 1) * pagination.limit + index + 1}</TableCell>
                                                {/* Customer */}
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={booking.customer?.profile ?? ""} />
                                                            <AvatarFallback>{booking.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {booking.customer?.firstName ?? "Unknown"} {booking.customer?.lastName ?? ""}
                                                            </p>
                                                            <p className="flex items-center text-xs text-gray-500">
                                                                <Users className="h-3 w-3 mr-1" />
                                                                {booking.customer?.age ? `${booking.customer.age} years` : "N/A"}
                                                            </p>
                                                            {/* Call Customer Button - Only for disputed/confirmed */}
                                                            {showCallButtons && booking.customer?.whatsapp && (
                                                                <a
                                                                    href={`tel:${booking.customer.whatsapp}`}
                                                                    className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                                >
                                                                    <Phone className="h-3 w-3" />
                                                                    Call
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                {/* Model */}
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={booking.model?.profile ?? ""} />
                                                            <AvatarFallback>{booking.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {booking.model?.firstName ?? "Unknown"} {booking.model?.lastName ?? ""}
                                                            </p>
                                                            <p className="flex items-center text-xs text-gray-500">
                                                                <UserCheck className="h-3 w-3 mr-1" />
                                                                {booking.model?.age ? `${booking.model.age} years` : "N/A"}
                                                            </p>
                                                            {/* Call Model Button - Only for disputed/confirmed */}
                                                            {showCallButtons && booking.model?.whatsapp && (
                                                                <a
                                                                    href={`tel:${booking.model.whatsapp}`}
                                                                    className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                                                >
                                                                    <Phone className="h-3 w-3" />
                                                                    Call
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                {/* Service */}
                                                <TableCell>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {booking.modelService?.service?.name ?? "Unknown Service"}
                                                        </p>
                                                        <p className="text-xs text-green-600 font-medium">
                                                            {booking.price?.toLocaleString()} LAK
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {formatDate1(booking.startDate)}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                {/* Status */}
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {/* Booking status */}
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusInfo.color}`}>
                                                            <StatusIcon className="h-3 w-3" />
                                                            {statusInfo.label}
                                                        </span>
                                                        {/* Customer/Model check-in badges */}
                                                        {/* <div className="flex flex-col items-start gap-1">
                                                            {getCheckInBadge(booking.customerCheckedInAt, "Customer")}
                                                            {getCheckInBadge(booking.modelCheckedInAt, "Model")}
                                                        </div> */}
                                                        {/* Hidden indicators */}
                                                        {(booking.customerHidden || booking.modelHidden) && (
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                {booking.customerHidden && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                                        <EyeOff className="h-2.5 w-2.5" />
                                                                        Customer hidden
                                                                    </span>
                                                                )}
                                                                {booking.modelHidden && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                                        <EyeOff className="h-2.5 w-2.5" />
                                                                        Model hidden
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                {/* Actions */}
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                                    <MoreVertical className="h-3 w-3" />
                                                                    <span className="sr-only">More</span>
                                                                </Button>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="w-48" align="end" forceMount>
                                                            <DropdownMenuItem className="text-sm">
                                                                <Link to={`view/${booking.id}`} className="flex space-x-2">
                                                                    <Eye className="mr-2 h-3 w-3" />
                                                                    <span>View Details</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            {/* Call buttons only for disputed/confirmed */}
                                                            {showCallButtons && booking.customer?.whatsapp && (
                                                                <DropdownMenuItem className="text-sm">
                                                                    <a href={`tel:${booking.customer.whatsapp}`} className="flex space-x-2 w-full">
                                                                        <Phone className="mr-2 h-3 w-3 text-blue-500" />
                                                                        <span>Call Customer</span>
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            )}
                                                            {showCallButtons && booking.model?.whatsapp && (
                                                                <DropdownMenuItem className="text-sm">
                                                                    <a href={`tel:${booking.model.whatsapp}`} className="flex space-x-2 w-full">
                                                                        <Phone className="mr-2 h-3 w-3 text-purple-500" />
                                                                        <span>Call Model</span>
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canRefund && hasEditAccess && (
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`refund/${booking.id}`} className="flex space-x-2">
                                                                        <RotateCcw className="mr-2 h-3 w-3 text-orange-500" />
                                                                        <span>Refund</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canComplete && hasEditAccess && (
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`complete/${booking.id}`} className="flex space-x-2">
                                                                        <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                                                                        <span>Complete</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }) : <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <EmptyPage
                                                title="No bookings found!"
                                                description="There are no bookings matching your filters."
                                            />
                                        </TableCell>
                                    </TableRow>}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="block md:hidden space-y-3 p-4">
                            {bookings && bookings.length > 0 ? bookings.map((booking: any, index: number) => {
                                const statusInfo = statusConfig[booking.status] || statusConfig.pending;
                                const StatusIcon = statusInfo.icon;
                                const canRefund = ["pending", "confirmed", "disputed"].includes(booking.status);
                                const canComplete = ["pending", "confirmed", "disputed"].includes(booking.status);
                                // Show call buttons only for disputed or confirmed bookings
                                const showCallButtons = ["disputed", "confirmed"].includes(booking.status);

                                return (
                                    <Card key={booking.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            {/* Header: Status & Actions */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${statusInfo.color}`}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {statusInfo.label}
                                                    </span>
                                                    {booking.customerHidden && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                            <EyeOff className="h-2.5 w-2.5" />
                                                            Customer hidden
                                                        </span>
                                                    )}
                                                    {booking.modelHidden && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                            <EyeOff className="h-2.5 w-2.5" />
                                                            Model hidden
                                                        </span>
                                                    )}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-48" align="end">
                                                        <DropdownMenuItem className="text-sm">
                                                            <Link to={`view/${booking.id}`} className="flex space-x-2">
                                                                <Eye className="mr-2 h-3 w-3" />
                                                                <span>View Details</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        {/* Call buttons only for disputed/confirmed */}
                                                        {showCallButtons && booking.customer?.whatsapp && (
                                                            <DropdownMenuItem className="text-sm">
                                                                <a href={`tel:${booking.customer.whatsapp}`} className="flex space-x-2 w-full">
                                                                    <Phone className="mr-2 h-3 w-3 text-blue-500" />
                                                                    <span>Call Customer</span>
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {showCallButtons && booking.model?.whatsapp && (
                                                            <DropdownMenuItem className="text-sm">
                                                                <a href={`tel:${booking.model.whatsapp}`} className="flex space-x-2 w-full">
                                                                    <Phone className="mr-2 h-3 w-3 text-purple-500" />
                                                                    <span>Call Model</span>
                                                                </a>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canRefund && hasEditAccess && (
                                                            <DropdownMenuItem className="text-sm">
                                                                <Link to={`refund/${booking.id}`} className="flex space-x-2">
                                                                    <RotateCcw className="mr-2 h-3 w-3 text-orange-500" />
                                                                    <span>Refund</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canComplete && hasEditAccess && (
                                                            <DropdownMenuItem className="text-sm">
                                                                <Link to={`complete/${booking.id}`} className="flex space-x-2">
                                                                    <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                                                                    <span>Complete</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            {/* Customer Info */}
                                            <div className="mb-3">
                                                <p className="text-xs text-gray-500 mb-1">Customer</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={booking.customer?.profile ?? ""} />
                                                            <AvatarFallback>{booking.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {booking.customer?.firstName ?? "Unknown"} {booking.customer?.lastName ?? ""}
                                                            </p>
                                                            <p className="flex items-center text-xs text-gray-500">
                                                                <Users className="h-3 w-3 mr-1" />
                                                                {booking.customer?.age ? `${booking.customer.age} years` : "N/A"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {/* Call Customer Button - Only for disputed/confirmed */}
                                                    {showCallButtons && booking.customer?.whatsapp && (
                                                        <a
                                                            href={`tel:${booking.customer.whatsapp}`}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                        >
                                                            <Phone className="h-3 w-3" />
                                                            Call
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Model Info */}
                                            <div className="mb-3">
                                                <p className="text-xs text-gray-500 mb-1">Model</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={booking.model?.profile ?? ""} />
                                                            <AvatarFallback>{booking.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {booking.model?.firstName ?? "Unknown"} {booking.model?.lastName ?? ""}
                                                            </p>
                                                            <p className="flex items-center text-xs text-gray-500">
                                                                <UserCheck className="h-3 w-3 mr-1" />
                                                                {booking.model?.age ? `${booking.model.age} years` : "N/A"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {/* Call Model Button - Only for disputed/confirmed */}
                                                    {showCallButtons && booking.model?.whatsapp && (
                                                        <a
                                                            href={`tel:${booking.model.whatsapp}`}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                                        >
                                                            <Phone className="h-3 w-3" />
                                                            Call
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Service & Booking Details */}
                                            <div className="space-y-2 pt-3 border-t border-gray-100">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs text-gray-500">Service</span>
                                                    <span className="text-sm font-medium text-gray-900 text-right">
                                                        {booking.modelService?.service?.name ?? "Unknown Service"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs text-gray-500">Price</span>
                                                    <span className="text-sm font-semibold text-green-600">
                                                        {booking.price?.toLocaleString()} LAK
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs text-gray-500">Date</span>
                                                    <span className="text-xs text-gray-600">
                                                        {formatDate1(booking.startDate)}
                                                    </span>
                                                </div>

                                                {/* Check-in badges */}
                                                {(booking.customerCheckedInAt || booking.modelCheckedInAt) && (
                                                    <div className="flex flex-wrap gap-1 pt-2">
                                                        {getCheckInBadge(booking.customerCheckedInAt, "Customer")}
                                                        {getCheckInBadge(booking.modelCheckedInAt, "Model")}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            }) : (
                                <div className="py-12">
                                    <EmptyPage
                                        title="No bookings found!"
                                        description="There are no bookings matching your filters."
                                    />
                                </div>
                            )}
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
            </div>
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "booking",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [bookingsData, stats] = await Promise.all([
            getBookings({
                search,
                status,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
            getBookingStats(),
        ]);

        return json({
            ...bookingsData,
            stats,
            success,
            error,
            filters: {
                search,
                status,
                fromDate,
                toDate,
                page,
                showBy,
            }
        });
    } catch (error: any) {
        console.error("LOAD_BOOKINGS_FAILED", error);
        throw new Error(error?.message || "Failed to fetch bookings");
    }
}

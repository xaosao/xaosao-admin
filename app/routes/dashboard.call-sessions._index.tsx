import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import {
    Form,
    json,
    Link,
    useLoaderData,
    useNavigate,
    useSearchParams,
} from "@remix-run/react";

// components
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
import {
    X,
    Search,
    EyeIcon,
    Activity,
    PhoneCall,
    MoreVertical,
    MoveHorizontal,
} from "lucide-react";

// services
import { formatDate } from "~/utils";
import StatusBadge from "~/components/ui/status-badge";
import { ISessionResponse } from "~/interfaces/session";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getCallSessions } from "~/services/call.session.server";
import { IPagination, ISessionFilters } from "~/interfaces/base";
import { useAuthStore } from "~/store/permissionStore";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

interface LoaderData {
    sessions: ISessionResponse[];
    pagination: IPagination;
    filters: ISessionFilters;
    success: string;
}

export default function Sessions() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { sessions, pagination, filters, success } =
        useLoaderData<LoaderData>();

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

    const clearFilters = useCallback(() => {
        if (formRef.current) {
            formRef.current.reset();
        }
        navigate("", { replace: true });
    }, [navigate]);

    const handleSearchSubmit = useCallback(
        (formData: FormData) => {
            const search = formData.get("search") as string;
            const sessionStatus = formData.get("sessionStatus") as string;
            const paymentStatus = formData.get("paymentStatus") as string;
            const from = formData.get("from") as string;
            const to = formData.get("to") as string;
            const showBy = formData.get("showBy") as string;

            updateFilters({
                search: search || "",
                sessionStatus: sessionStatus || "all",
                paymentStatus: paymentStatus || "all",
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

    const canAccess = hasPermission("session", "view");
    const canEdit = hasPermission("session", "edit");

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
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">
                        Session Management
                    </h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Call session", value: "/call-sessions" },
                        ]}
                    />
                </div>
                {canEdit && <div className="flex items-center space-x-2">
                    <Button variant="outline">
                        <Link to="report" className="flex items-center space-x-4">
                            <Activity className="h-4 w-4 mr-2" />
                            Reports
                        </Link>
                    </Button>
                </div>}
            </div>
            <Card className="border-0 shadow-md py-4">
                <CardHeader className="p-2">
                    <Form
                        ref={formRef}
                        method="get"
                        onChange={(e) => {
                            const formData = new FormData(e.currentTarget);
                            handleSearchSubmit(formData);
                        }}
                        className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2 p-0"
                    >
                        <div className="flex flex-1 items-center space-x-4">
                            <div className="relative max-w-xs w-56 hidden sm:block">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by first name...."
                                    className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-28 hidden sm:block">
                                <select
                                    name="sessionStatus"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.sessionStatus}
                                >
                                    <option value="all">All Status</option>
                                    <option value="completed">Compoleted</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="active">Active</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="no-show">No show</option>
                                </select>
                            </div>
                            <div className="w-28 hidden sm:block">
                                <select
                                    name="paymentStatus"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.paymentStatus}
                                >
                                    <option value="all">All Payments</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="refunded">Refunded</option>
                                    <option value="failed">Failed</option>
                                </select>
                            </div>
                            <div className="w-48 sm:w-52 flex items-center space-x-0 sm:space-x-2">
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

                            <div className="relative max-w-xs w-56 block sm:hidden">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by first name...."
                                    className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-28 block sm:hidden">
                                <select
                                    name="sessionStatus"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.sessionStatus}
                                >
                                    <option value="all">All Status</option>
                                    <option value="completed">Compoleted</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="active">Active</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="no-show">No show</option>
                                </select>
                            </div>
                            <div className="w-28 block sm:hidden">
                                <select
                                    name="paymentStatus"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.paymentStatus}
                                >
                                    <option value="all">All Payments</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="refunded">Refunded</option>
                                    <option value="failed">Failed</option>
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
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100 border-gray-100 border-t">
                                <TableHead className="font-semibold">Participants</TableHead>
                                <TableHead className="font-semibold">Service</TableHead>
                                <TableHead className="font-semibold">Session Start</TableHead>
                                <TableHead className="font-semibold">Duration</TableHead>
                                <TableHead className="font-semibold">Total Cost</TableHead>
                                <TableHead className="font-semibold">Session Status</TableHead>
                                <TableHead className="font-semibold">Payment Status</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions && sessions.length > 0 ? (
                                sessions?.map((session) => (
                                    <TableRow
                                        key={session.id}
                                        className="border-gray-50 hover:bg-gray-50 text-gray-500 text-sm"
                                    >
                                        <TableCell>
                                            <div className="flex items-center space-x-3">
                                                <div className="flex items-center justify-start gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={session?.customer?.profile ?? ""} />
                                                        <AvatarFallback>
                                                            {session.customer.firstName
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <PhoneCall
                                                        className={`h-3 w-3 ${session.sessionStatus === "completed"
                                                            ? "text-green-500"
                                                            : session.sessionStatus === "scheduled"
                                                                ? "text-blue-500"
                                                                : session.sessionStatus === "active"
                                                                    ? "text-yellow-500"
                                                                    : "text-red-500"
                                                            }`}
                                                    />
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={session?.model?.profile ?? ""} />
                                                        <AvatarFallback>
                                                            {session.model.firstName
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div>
                                                    <p className="flex text-sm items-center font-medium text-gray-900">
                                                        {session.customer.firstName}&nbsp;
                                                        {session.customer.lastName}
                                                        <MoveHorizontal className="h-3 w-3 mx-2" />
                                                        {session.model.firstName}&nbsp;
                                                        {session.model.lastName}
                                                    </p>
                                                    <div className="flex items-start justify-center flex-col gap-1 mt-1">
                                                        <p className="text-xs text-gray-500">
                                                            Started at: {formatDate(session.createdAt)}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            ID: {session.id}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p>{session.modelService.service.name}</p>
                                            <p className="text-xs mt-1">${session.modelService.customRate} / minute</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-start flex-col gap-1">
                                                <p className="text-gray-500 text-xs">
                                                    {formatDate(session.sessionStart)}
                                                </p>
                                                <p className="text-gray-500 text-xs">TO</p>
                                                <p className="text-gray-500 text-xs">
                                                    {formatDate(session.sessionEnd)}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {session.duration} mins
                                        </TableCell>
                                        <TableCell className="text-center">
                                            ${session.total_cost}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusBadge status={session.sessionStatus} />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <StatusBadge status={session.paymentStatus} />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        className="relative h-8 w-8 rounded-full p-0"
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <MoreVertical className="h-3 w-3" />
                                                            <span className="sr-only">More</span>
                                                        </Button>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    className="w-48"
                                                    align="end"
                                                    forceMount
                                                >
                                                    {canEdit && <DropdownMenuItem className="text-sm">
                                                        <Link
                                                            to={`${session.id}`}
                                                            className="flex space-x-2"
                                                        >
                                                            <EyeIcon className="mr-2 h-3 w-3" />
                                                            <span>View details</span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {/* <DropdownMenuItem className="text-sm">
                                                        <Link
                                                            to={`${session.id}`}
                                                            className="flex space-x-2"
                                                        >
                                                            <UserPen className="mr-2 h-3 w-3" />
                                                            <span>Edit </span>
                                                        </Link>
                                                    </DropdownMenuItem> */}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <EmptyPage
                                            title="No call session founded!"
                                            description="There is no call session data in the database yet!"
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

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
        </div >
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "session",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const sessionStatus = searchParams.get("sessionStatus") || "all";
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [sessions] = await Promise.all([
            getCallSessions({
                search,
                sessionStatus,
                paymentStatus,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
        ]);
        if (!sessions) throw new Error("Failed to fetch sessions");

        return json({
            sessions: sessions.call_sessions,
            pagination: sessions.pagination,
            success,
            filters: {
                search,
                sessionStatus,
                paymentStatus,
                fromDate,
                toDate,
                page,
                showBy,
            },
        });
    } catch (error) {
        console.log("LOAD_SESSION_DATA_FAILED", error);
        throw new Error("Failed to fetch model data");
    }
}

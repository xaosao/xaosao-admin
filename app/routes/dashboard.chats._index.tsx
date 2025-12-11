import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    X,
    Users,
    Search,
    Trash2,
    EyeIcon,
    Activity,
    UserCheck,
    ArrowRight,
    MessageCircle,
    MoreVertical,
    MessageCircleOff,
    MessageSquareLock,
    MessageCircleMore,
} from "lucide-react";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";

// components
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";

// services
import { useAuthStore } from "~/store/permissionStore";
import { calculateAgeFromDOB, formatDate } from "~/utils";
import { IConversationFilters, IPagination } from "~/interfaces/base";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { IConversationResponse, IConversationStats } from "~/interfaces/conversation";
import { getConversations, getConversationStats } from "~/services/conversaion.server";

interface LoaderData {
    success: string;
    pagination: IPagination;
    filters: IConversationFilters;
    conversations: IConversationResponse[];
    conversationStats: IConversationStats[],
}

const iconMap = {
    MessageCircle,
    MessageCircleOff,
    MessageCircleMore,
    MessageSquareLock,
};

export default function Chats() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { conversations, conversationStats, pagination, filters, success } =
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

    const canEdit = hasPermission("chat", "edit");
    const canAccess = hasPermission("chat", "view");
    const canDelete = hasPermission("chat", "delete");

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
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Conversation Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Conversation", value: "/chats" },
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {conversationStats.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
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
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">chats</p>
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


            <Card className="border-0 shadow-md rounded-md">
                <CardHeader className="p-2 sm:p-4">
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
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                    <option value="blocked">Blocked</option>
                                </select>
                            </div>
                            <div className="w-48 sm:w-52 flex items-center space-x-2">
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
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                    <option value="blocked">Blocked</option>
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
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-gray-100">
                                <TableHead className="font-semibold">No</TableHead>
                                <TableHead className="font-semibold">Participants</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Last Messages</TableHead>
                                <TableHead className="font-semibold">Created At</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {conversations.map((chat, index: number) => (
                                <TableRow key={chat.id} className="border-gray-50 hover:bg-gray-50 text-gray-500">
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-start space-y-2">
                                            <div className="flex items-start space-x-2">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={chat.customer.profile ?? ""} />
                                                    <AvatarFallback>{chat.customer.firstName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium text-gray-900">{chat.customer.firstName}&nbsp;{chat.customer.lastName}</p>
                                                    <div className="flex items-start gap-1">
                                                        <Users height={12} width={12} /> <span className="text-gray-500 text-xs">Customer</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 ml-10"><ArrowRight height={12} width={12} /></div>
                                            <div className="flex items-start space-x-2 pl-4">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={chat?.model?.profile ?? ""} />
                                                    <AvatarFallback>{chat.model.firstName.charAt(0)}&nbsp;{chat.model.lastName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="mt-2">
                                                    <p className="text-sm font-medium text-gray-900">{chat.model.firstName}&nbsp;{chat.model.firstName}</p>
                                                    <div className="flex items-start gap-1">
                                                        <UserCheck height={12} width={12} /> <span className="text-gray-500 text-xs">Model</span> *<span className="text-gray-500 text-xs">{calculateAgeFromDOB(chat.model.dob)} Years old</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={chat.status} />
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(chat.lastMessage)}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium"> {formatDate(chat.createdAt)}</TableCell>
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            {canEdit && <DropdownMenuTrigger asChild>
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
                                            </DropdownMenuTrigger>}
                                            <DropdownMenuContent
                                                className="w-48"
                                                align="end"
                                                forceMount
                                            >
                                                {canAccess && <DropdownMenuItem className="text-sm">
                                                    <Link
                                                        to={`view/${chat.id}`}
                                                        className="flex space-x-2"
                                                    >
                                                        <EyeIcon className="mr-2 h-3 w-3" />
                                                        <span>View details</span>
                                                    </Link>
                                                </DropdownMenuItem>}

                                                {canAccess && <DropdownMenuItem className="text-sm">
                                                    <Link
                                                        to={`${chat.id}`}
                                                        className="flex space-x-2"
                                                    >
                                                        <Activity className="mr-2 h-3 w-3" />
                                                        <span>Live monitor</span>
                                                    </Link>
                                                </DropdownMenuItem>}

                                                {canDelete && <DropdownMenuItem className="text-sm">
                                                    <Link
                                                        to={`delete/${chat.id}`}
                                                        className="flex space-x-2"
                                                    >
                                                        <Trash2 className="mr-2 h-3 w-3" />
                                                        <span>Delete </span>
                                                    </Link>
                                                </DropdownMenuItem>}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
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
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "chat",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [sessions, conversationStats] = await Promise.all([
            getConversations({
                search,
                status,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
            getConversationStats()
        ]);
        if (!sessions) throw new Error("Failed to fetch sessions");

        return json({
            conversations: sessions.conversations,
            pagination: sessions.pagination,
            conversationStats,
            success,
            filters: {
                search,
                status,
                fromDate,
                toDate,
                page,
                showBy,
            },
        });
    } catch (error) {
        console.log("LOAD_CONVERSATION_DATA_FAILED", error);
        throw new Error("Failed to fetch model data");
    }
}

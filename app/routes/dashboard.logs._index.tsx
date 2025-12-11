import { useCallback, useRef } from "react";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    X,
    Ban,
    Search,
    Activity,
    ShieldOff,
    BadgeCheck,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";

// components
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";


// Utils and services
import { formatDate1 } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { getAuditLogs, getAuditLogsStatus } from "~/services/log.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

const iconMap = {
    Activity,
    BadgeCheck,
    Ban,
    ShieldOff
};

export default function AuditLogs() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { logs, logStatus, pagination, filters } = useLoaderData<typeof loader>();

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

    const canAccess = hasPermission("log", "view");

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
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Audit Logs Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Logs management", value: "/logs" },
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {logStatus.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card key={stat.title} className="border-0 rounded-md shadow-md hover:shadow-md transition-shadow rounded-md">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 space-y-2">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                        <div className="flex items-center mt-1">
                                            {stat.trend === "up" ? (
                                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <ArrowDownRight className="h-3 w-3 text-red-500" />
                                            )}
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
                            <div className="hidden sm:block w-36">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="success">Success</option>
                                    <option value="failed">Failed</option>
                                </select>
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
                            <div className="block sm:hidden  w-36">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="success">Success</option>
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
                <CardContent className="p-0 mt-4 border-t border-gray-200">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-gray-100">
                                <TableHead className="font-semibold">NO</TableHead>
                                <TableHead className="font-semibold">Event</TableHead>
                                <TableHead className="font-semibold">Description</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Action BY</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log, index: number) => (
                                <TableRow key={log.id} className="border-gray-50 hover:bg-gray-50">
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-2">
                                                <p className="text-xs font-medium text-gray-900">{log.action.replace('_', ' ')}</p>
                                            </div>
                                            <p className="text-xs text-gray-400">{formatDate1(log.createdAt)}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-xs text-gray-600 line-clamp-2">{log.description}</p>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={log.status} />
                                    </TableCell>
                                    <TableCell>
                                        {log.user?.firstName} {log.user?.lastName}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

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

        </div>
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "log",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    // Performance optimization: Run both queries in parallel
    const [logs, logStatus] = await Promise.all([
        getAuditLogs({
            search,
            status,
            fromDate,
            toDate,
            page,
            limit: showBy,
        }),
        getAuditLogsStatus()
    ]);

    return json({
        ...logs,
        logStatus,
        filters: {
            search,
            status,
            fromDate,
            toDate,
            page,
            showBy,
        }
    });
}
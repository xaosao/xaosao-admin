import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import {
    useLoaderData,
    Link,
    useSearchParams,
    useNavigate,
    Form,
} from "@remix-run/react";
import {
    X,
    Users,
    Phone,
    UserX,
    Search,
    Trash2,
    MapPin,
    EyeIcon,
    UserPen,
    PlusIcon,
    UserLock,
    UserCheck,
    MoreVertical,
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
import { getCustomers, getCustomerStats } from "~/services/customer.server";
import { capitalizeFirstLetter, formatDate, openInGoogleMaps } from "~/utils";

const iconMap = {
    Users,
    UserCheck,
    UserX,
    UserLock,
};

export default function CustomersIndex() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { customers, customerStats, pagination, filters, success } =
        useLoaderData<typeof loader>();

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

    const canAccess = hasPermission("customer", "view");
    const canCreate = hasPermission("customer", "create");
    const canEdit = hasPermission("customer", "edit");
    const canDelete = hasPermission("customer", "delete");

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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">
                        Customers management
                    </h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Customer Management", value: "/customers" },
                        ]}
                    />
                </div>
                {canCreate && (
                    <div>
                        <Button
                            className="bg-dark-pink hover:opacity-90 text-white"
                            asChild
                        >
                            <Link to="create">
                                <PlusIcon />
                                Add <span className="hidden sm:block">customer</span>
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {customerStats.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card
                            key={stat.title}
                            className="border-0 shadow-md hover:shadow-md transition-shadow cursor-pointer"
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
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">
                                            people
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
                            <div className="hidden sm:block w-36">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="inactive">Inactive</option>
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
                            <div className="block sm:hidden w-36">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.status}
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="inactive">Inactive</option>
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
                <CardContent className="p-0 mt-6">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-gray-100">
                                <TableHead className="font-semibold">ID</TableHead>
                                <TableHead className="font-semibold">Customer</TableHead>
                                <TableHead className="font-semibold">
                                    Location details
                                </TableHead>
                                <TableHead className="font-semibold">Whatsapp</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Tier</TableHead>
                                <TableHead className="font-semibold">Created Date</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers && customers.length > 0 ? (
                                customers.map((customer, index: number) => (
                                    <TableRow
                                        key={customer.id}
                                        className="border-gray-50 hover:bg-gray-50"
                                    >
                                        <TableCell className=" text-gray-600">
                                            {(pagination.currentPage - 1) * pagination.limit +
                                                index +
                                                1}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage
                                                        src={customer.profile ?? ""}
                                                        alt={`${customer.firstName} ${customer.lastName}`}
                                                    />
                                                    <AvatarFallback className="">
                                                        {customer.firstName.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {customer.firstName} {customer.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        Number: {customer.number}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-start space-x-2">
                                                <span className="text-sm font-medium text-gray-500">
                                                    {(customer?.location as any)?.countryFlagEmoj}
                                                </span>
                                                <span className="text-sm font-medium text-gray-500">
                                                    {(customer?.location as any)?.countryName} (
                                                    {(customer?.location as any)?.countryNameNative})
                                                </span>
                                            </div>
                                            <div className=" flex items-center justify-start space-x-2">
                                                <span className="font-medium text-gray-500">
                                                    IP: {(customer?.location as any)?.ip}
                                                </span>
                                                <span className="font-medium text-gray-500">
                                                    City: {(customer?.location as any)?.city}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className=" text-gray-600 flex items-center justify-start">
                                            <Phone height={14} width={14} className="mr-2" />
                                            {customer.whatsapp}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={customer.status} />
                                        </TableCell>
                                        <TableCell className=" text-gray-600">
                                            <Badge
                                                variant={
                                                    customer.tier === "basic" ? "default" : "destructive"
                                                }
                                                className={
                                                    customer.tier === "vip"
                                                        ? "bg-green-100 text-green-800 hover:bg-green-100 hover:text-green-800 cursor-pointer"
                                                        : customer.tier === "basic"
                                                            ? "bg-gray-100 text-gray-800 hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
                                                            : ""
                                                }
                                            >
                                                {capitalizeFirstLetter(customer.tier ?? "")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className=" text-gray-600">
                                            {formatDate(customer.createdAt || "")}
                                        </TableCell>
                                        <TableCell>
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
                                                            to={`view/${customer.id}`}
                                                            className="flex space-x-2 w-full"
                                                        >
                                                            <EyeIcon className="mr-2 h-3 w-3" />
                                                            <span>View details</span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {canEdit && <DropdownMenuItem className="text-sm">
                                                        <Link
                                                            to={`${customer.id}`}
                                                            className="flex space-x-2 w-full"
                                                        >
                                                            <UserPen className="mr-2 h-3 w-3" />
                                                            <span>Edit </span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {canDelete && <DropdownMenuItem className="text-sm">
                                                        <Link
                                                            to={`delete/${customer.id}`}
                                                            className="flex space-x-2 w-full"
                                                        >
                                                            <Trash2 className="mr-2 h-3 w-3" />
                                                            <span>Delete</span>
                                                        </Link>
                                                    </DropdownMenuItem>}
                                                    {canAccess && <DropdownMenuItem
                                                        className="text-sm"
                                                        onClick={() =>
                                                            openInGoogleMaps(
                                                                customer.latitude ?? 0,
                                                                customer.longitude ?? 0
                                                            )
                                                        }
                                                    >
                                                        <MapPin className="mr-2 h-3 w-3" />
                                                        <span>Customer address</span>
                                                    </DropdownMenuItem>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <EmptyPage
                                            title="No customers found!"
                                            description="There is no customers in the database yet!"
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
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
        group: "customer",
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

    // Performance optimization: Run both queries in parallel
    const [customerData, customerStats] = await Promise.all([
        getCustomers({
            search,
            status,
            fromDate,
            toDate,
            page,
            limit: showBy,
        }),
        getCustomerStats(),
    ]);

    return json({
        ...customerData,
        success,
        customerStats,
        filters: {
            search,
            status,
            fromDate,
            toDate,
            page,
            showBy,
        },
    });
}

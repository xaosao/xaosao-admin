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
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import EmptyPage from "~/components/ui/empty";
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
    TableRow,
} from "~/components/ui/table";
import {
    Plus,
    UserX,
    Users,
    Trash2,
    Shield,
    Search,
    EyeIcon,
    UserPen,
    UserCheck,
    UserLock,
    MoreVertical,
    ShieldX,
    ShieldCheck,
} from "lucide-react";

// Backend and types
import { IPagination } from "~/interfaces/base";
import { useAuthStore } from "~/store/permissionStore";
import { IAdminResponse, IStatusItem } from "~/interfaces";
import { capitalizeFirstLetter, formatDate1 } from "~/utils";
import { getAdmins, getAdminStats } from "~/services/admin.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

const iconMap = {
    Users,
    UserCheck,
    UserLock,
    UserX,
};

interface LoaderData {
    admins: IAdminResponse[];
    adminStats: IStatusItem[];
    pagination: IPagination;
    success: string;
    filters: { search: string, limit: number, showBy: number };
}

export default function Admins() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { admins, adminStats, pagination, success, filters } = useLoaderData<LoaderData>();

    const formRef = useRef<HTMLFormElement>(null);
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

    const canAccess = hasPermission("admin", "view");
    const canCreate = hasPermission("admin", "create");
    const canEdit = hasPermission("admin", "edit");
    const canDelete = hasPermission("admin", "delete");
    const roleView = hasPermission("role", "view");

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
                    <h1 className="text-md sm:text-lg font-semibold text-gray-900 mb-2">
                        Admin Management
                    </h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Admin Accounts management", value: "/admins" },
                        ]}
                    />
                </div>
                <div className="flex items-center space-x-2">
                    {roleView && <Button variant="outline" size="sm">
                        <Link to="/dashboard/roles" className="flex items-center space-x-4">
                            <Shield className="h-4 w-4 mr-2" />
                            Manage Roles
                        </Link>
                    </Button>}
                    {canCreate && <Button className="bg-dark-pink hover:opacity-90 text-white">
                        <Link
                            to="/dashboard/admins/create"
                            className="flex items-center space-x-4"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create New
                        </Link>
                    </Button>
                    }
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {adminStats.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card
                            key={stat.title}
                            className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md bg-white"
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
                                        <p className="text-xs font-medium text-gray-500 mt-1">
                                            Users
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

            <div className="gap-6">
                <Card className="lg:col-span-3 border-0 shadow-md rounded-md">
                    <CardHeader className="p-2 sm:p-4">
                        <Form
                            ref={formRef}
                            method="get"
                            onChange={(e) => {
                                const formData = new FormData(e.currentTarget);
                                handleSearchSubmit(formData);
                            }}
                            className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            type="text"
                                            name="search"
                                            placeholder="Search by name..."
                                            className="pl-9 w-64 border-gray-200 focus:border-pink-300 focus:ring-pink-300"
                                            defaultValue={filters.search}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Form>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="uppercase">
                                <TableRow className="border-t border-gray-100 bg-gray-50">
                                    <TableHead className="text-xs font-semibold">No</TableHead>
                                    <TableHead className="text-xs font-semibold">Number</TableHead>
                                    <TableHead className="text-xs font-semibold">Admin</TableHead>
                                    <TableHead className="text-xs font-semibold">Role</TableHead>
                                    <TableHead className="text-xs font-semibold">Address</TableHead>
                                    <TableHead className="text-xs font-semibold">Status</TableHead>
                                    <TableHead className="text-xs font-semibold">Created at</TableHead>
                                    <TableHead className="text-xs font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {admins && admins.length > 0 ? admins?.map((admin, index: number) => (
                                    <TableRow
                                        key={admin.id}
                                        className="border-gray-50 hover:bg-gray-50 text-gray-500 text-sm"
                                    >
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{admin.number}</TableCell>
                                        <TableCell>
                                            <div className="flex items-start space-x-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage
                                                        src={admin.profile ?? ""}
                                                        alt={`${admin.firstName} ${admin.lastName}`}
                                                    />
                                                    <AvatarFallback className="text-xs">
                                                        {admin.firstName.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {admin.firstName}&nbsp;{admin.lastName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{admin.email}</p>
                                                    <div className="flex items-center space-x-2 mt-1">
                                                        {admin.is2FAEnabled ? (
                                                            <div className="flex items-center space-x-1 text-green-600">
                                                                <ShieldCheck className="h-3 w-3" />
                                                                <span className="text-xs">
                                                                    2FA
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center space-x-1 text-red-600">
                                                                <ShieldX className="h-3 w-3" />
                                                                <span className="text-xs">
                                                                    2FA
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${admin.role.name === "Super Admin"
                                                    ? "text-red-800 border-red-200"
                                                    : admin.role.name === "Content Creator"
                                                        ? "text-blue-800 border-blue-200"
                                                        : admin.role.name === "Finance Manager"
                                                            ? "text-green-800 border-green-200"
                                                            : admin.role.name === "Customer Support"
                                                                ? "text-yellow-800 border-yellow-200"
                                                                : "text-purple-800 border-purple-200"
                                                    }`}
                                            >
                                                {capitalizeFirstLetter(admin.role.name)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {admin.address}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-1">
                                                <StatusBadge status={admin.status} />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {formatDate1(admin.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                {canEdit && canDelete && <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                            <MoreVertical className="h-3 w-3" />
                                                            <span className="sr-only">More</span>
                                                        </Button>
                                                    </Button>
                                                </DropdownMenuTrigger>}
                                                <DropdownMenuContent className="w-48" align="end" forceMount>
                                                    {canEdit && <DropdownMenuItem className="text-sm">
                                                        <Link to={`view/${admin.id}`} className="flex space-x-2 text-gray-500 w-full">
                                                            <EyeIcon className="mr-2 h-3 w-3" />
                                                            <span>View details</span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {canEdit && <DropdownMenuItem className="text-sm">
                                                        <Link to={`${admin.id}`} className="flex space-x-2 text-gray-500 w-full">
                                                            <UserPen className="mr-2 h-3 w-3" />
                                                            <span>Edit </span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {canEdit && <DropdownMenuItem className="text-sm">
                                                        <Link to={`2fa/${admin.id}`} className="flex space-x-2 text-gray-500 w-full">
                                                            <Shield className="mr-2 h-3 w-3" />
                                                            <span> {admin.is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}</span>
                                                        </Link>
                                                    </DropdownMenuItem>}

                                                    {canDelete && <DropdownMenuItem className="text-sm">
                                                        <Link to={`delete/${admin.id}`} className="flex space-x-2 text-gray-500 w-full">
                                                            <Trash2 className="mr-2 h-3 w-3" />
                                                            <span>Delete</span>
                                                        </Link>
                                                    </DropdownMenuItem>}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12">
                                        <EmptyPage
                                            title="No admin user found!"
                                            description="There is no admin user data in the database yet!"
                                        />
                                    </TableCell>
                                </TableRow>}
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
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [admins, adminStats] = await Promise.all([
            getAdmins({
                search,
                page,
                limit: showBy,
            }),
            getAdminStats(),
        ]);

        return json({
            admins: admins.admins,
            pagination: admins.pagination,
            adminStats,
            success,
            filters: {
                search,
                page,
                showBy,
            },
        });
    } catch (error) {
        console.log("LOAD_ADMIN_DATA_FAILED", error);
        throw new Error("Failed to fetch data");
    }
}

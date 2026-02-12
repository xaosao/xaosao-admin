import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";

// conponents
import { Badge } from "~/components/ui/badge";
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";
import {
    Eye,
    Ban,
    Edit,
    Trash2,
    Wallet,
    Activity,
    DollarSign,
    TrendingUp,
    CheckCircle,
    MoreVertical,
    ArrowUpRight,
    ArrowDownLeft,
    DollarSignIcon,
    Calculator,
    Search,
    X,
} from "lucide-react";

// utils and service
import { formatDate, timeAgo } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { getRecentTransactions } from "~/services/transaction.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getTopEarningWallet, getWallets, getWalletStatus } from "~/services/wallet.server";

const iconMap = {
    Wallet,
    DollarSign
};

export default function Wallets() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { walletData, walletStatus, topEarning, recentTransaction, pagination, filters, success } = useLoaderData<typeof loader>();

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
        const type = formData.get("type") as string;
        const order = formData.get("order") as string;
        const status = formData.get("status") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            type: type || "all",
            order: order || "desc",
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
    }, [success, navigate]);

    const canAccess = hasPermission("wallet", "view");
    const canEdit = hasPermission("wallet", "edit");
    const canDelete = hasPermission("wallet", "delete");

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
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Wallet Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Wallets management", value: "/wallets" },
                        ]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {walletStatus.map((stat) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card key={stat.title} className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                                        <p className="text-sm sm:text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                <Card className="lg:col-span-3 border-0 shadow-md rounded-md">
                    <CardHeader className="px-2">
                        <Form
                            ref={formRef}
                            method="get"
                            onChange={(e) => {
                                const formData = new FormData(e.currentTarget);
                                handleSearchSubmit(formData);
                            }}
                            className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2"
                        >
                            <div className="flex flex-1 items-center space-x-1">
                                <div className="relative w-48 hidden sm:block">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        name="search"
                                        placeholder="Search by name..."
                                        className="pl-9 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.search}
                                    />
                                </div>
                                <div className="hidden sm:block w-28">
                                    <select
                                        name="type"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.type}
                                    >
                                        <option value="all">All types</option>
                                        <option value="model">Models</option>
                                        <option value="customer">Customers</option>
                                    </select>
                                </div>
                                <div className="hidden sm:block w-28">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.status}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div className="w-full sm:w-56 flex items-center space-x-1 mr-8 sm:mr-0">
                                    <input
                                        type="date"
                                        name="from"
                                        className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.fromDate}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="date"
                                        name="to"
                                        className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                <div className="block sm:hidden relative w-32">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        name="search"
                                        placeholder="Search..."
                                        className="pl-8 border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.search}
                                    />
                                </div>
                                <div className="block sm:hidden w-28">
                                    <select
                                        name="type"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.type}
                                    >
                                        <option value="all">All types</option>
                                        <option value="model">Models</option>
                                        <option value="customer">Customers</option>
                                    </select>
                                </div>
                                <div className="block sm:hidden w-28">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        name="order"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.order}
                                    >
                                        <option value="desc">Highest</option>
                                        <option value="asc">Lowest</option>
                                    </select>
                                </div>
                                <div className="w-22">
                                    <select
                                        name="showBy"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-1 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        {/* Mobile Card View */}
                        <div className="block md:hidden p-2 space-y-4">
                            {walletData && walletData.length > 0 ? walletData.map((wallet, index: number) => {
                                const owner = wallet.model ?? wallet.customer;
                                return (
                                    <div key={wallet.id} className="border rounded-lg p-4 bg-white shadow-sm">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={owner?.profile ?? ""} alt={`${owner?.firstName} ${owner?.lastName}`} />
                                                    <AvatarFallback className="text-sm">{owner?.firstName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="flex items-center text-sm font-semibold text-gray-900">
                                                        #{index + 1} {owner?.firstName}&nbsp;{owner?.lastName}
                                                        {owner?.status === "active" && (
                                                            <CheckCircle className="h-3 w-3 ml-1 text-green-600" />
                                                        )}
                                                    </p>
                                                    <Badge variant="outline" className="text-xs mt-1">{wallet.customerId === null ? "Model" : "Customer"}</Badge>
                                                </div>
                                            </div>
                                            <StatusBadge status={wallet.status} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                            <div>
                                                <span className="text-gray-400">Total Balance:</span>
                                                <p className="text-gray-700 font-medium">{wallet.totalBalance.toLocaleString()} Kip</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Recharge:</span>
                                                <p className="text-gray-700 font-medium">{wallet.totalRecharge.toLocaleString()} Kip</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Withdrawn:</span>
                                                <p className="text-gray-700 font-medium">{(wallet.totalWithdraw || 0).toLocaleString()} Kip</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Created:</span>
                                                <p className="text-gray-700">{formatDate(wallet.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-2 border-t flex-wrap">
                                            {canAccess && (
                                                <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                    <Link to={`view/${wallet.id}?type=${wallet.customerId === null ? "model" : "customer"}`}>
                                                        <Eye className="h-3 w-3" />View
                                                    </Link>
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button variant="outline" size="sm" className="h-8 px-2 text-purple-600 border-purple-200 hover:bg-purple-50" asChild>
                                                    <Link to={`summary/${wallet.id}`}>
                                                        <Calculator className="h-3 w-3" />Summary
                                                    </Link>
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                    <Link to={`${wallet.id}`}>
                                                        <Edit className="h-3 w-3" />Edit
                                                    </Link>
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                                                    <Link to={`adjust/${wallet.id}`}>
                                                        <DollarSignIcon className="h-3 w-3" />Adjust
                                                    </Link>
                                                </Button>
                                            )}
                                            {canEdit && (
                                                <Button variant="outline" size="sm" className="h-8 px-2 text-orange-500 border-orange-200 hover:bg-orange-50" asChild>
                                                    <Link to={`ban/${wallet.id}`}>
                                                        <Ban className="h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button variant="outline" size="sm" className="h-8 px-2 text-red-500 border-red-200 hover:bg-red-50" asChild>
                                                    <Link to={`delete/${wallet.id}`}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            }) : (
                                <EmptyPage
                                    title="No wallets found!"
                                    description="There is no wallets in the database yet!"
                                />
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-gray-100">
                                        <TableHead className="font-semibold">No</TableHead>
                                        <TableHead className="font-semibold">Owner</TableHead>
                                        <TableHead className="font-semibold">Type</TableHead>
                                        <TableHead className="font-semibold">Balance</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Created At</TableHead>
                                        <TableHead className="font-semibold text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {walletData && walletData.length > 0 ? walletData.map((wallet, index: number) => {
                                        const owner = wallet.model ?? wallet.customer;
                                        return (
                                            <TableRow key={wallet.id} className="border-gray-50 hover:bg-gray-50 text-gray-500 text-sm">
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={owner?.profile ?? ""} alt={`${owner?.firstName} ${owner?.lastName}`} />
                                                            <AvatarFallback className="text-xs">{owner?.firstName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="flex items-center text-sm font-medium text-gray-900">{owner?.firstName}&nbsp;{owner?.lastName}&nbsp; {owner?.status === "active" && (
                                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                                            )}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">{wallet.customerId === null ? "Model" : "Customer"}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-gray-500">
                                                            Total: {wallet.totalBalance.toLocaleString()} Kip
                                                        </p>
                                                        <p className="text-sm font-medium text-gray-500">
                                                            Recharge: {wallet.totalRecharge.toLocaleString()} Kip
                                                        </p>
                                                        <p className="text-sm font-medium text-gray-500">
                                                            Withdrawn: {(wallet.totalWithdraw || 0).toLocaleString()} Kip
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-1">
                                                        <StatusBadge status={wallet.status} />
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {formatDate(wallet.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-center">
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
                                                            {canAccess && <DropdownMenuItem className="text-sm">
                                                                <Link to={`view/${wallet.id}?type=${wallet.customerId === null ? "model" : "customer"}`} className="flex space-x-2">
                                                                    <Eye className="mr-2 h-3 w-3" />
                                                                    <span>View details</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            {canEdit && <DropdownMenuItem className="text-sm text-purple-600">
                                                                <Link to={`summary/${wallet.id}`} className="flex space-x-2">
                                                                    <Calculator className="mr-2 h-3 w-3" />
                                                                    <span>Summary</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            {canEdit && <DropdownMenuItem className="text-sm">
                                                                <Link to={`${wallet.id}`} className="flex space-x-2">
                                                                    <Edit className="mr-2 h-3 w-3" />
                                                                    <span>Edit wallet</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            {canEdit && <DropdownMenuItem className="text-sm">
                                                                <Link to={`adjust/${wallet.id}`} className="flex space-x-2">
                                                                    <DollarSignIcon className="mr-2 h-3 w-3" />
                                                                    <span>Adjust balance</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            <DropdownMenuSeparator />
                                                            {canEdit && <DropdownMenuItem className="text-sm text-orange-500">
                                                                <Link to={`ban/${wallet.id}`} className="flex space-x-2">
                                                                    <Ban className="mr-2 h-3 w-3" />
                                                                    <span>Suspend wallet</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            {canDelete && <DropdownMenuItem className="text-sm text-red-500">
                                                                <Link to={`delete/${wallet.id}`} className="flex space-x-2">
                                                                    <Trash2 className="mr-2 h-3 w-3" />
                                                                    <span>Delete wallet</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }) : <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12">
                                            <EmptyPage
                                                title="No wallets found!"
                                                description="There is no wallets in the database yet!"
                                            />
                                        </TableCell>
                                    </TableRow>}
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

                <div className="space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardHeader className="p-2">
                            <CardTitle className="text-md font-semibold flex items-center">
                                <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                                Top Earners
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 m-0">
                            <div className="space-y-0">
                                {topEarning.map((earner) => (
                                    <div key={earner.name} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center space-x-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={earner?.profile ?? ""} alt={`${earner?.name}`} />
                                                <AvatarFallback className="text-xs">{earner?.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{earner.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-green-600">{earner.earnings.toLocaleString()} Kip</p>
                                            {earner.earnings > earner.balance ? <div className="flex items-center text-green-600">
                                                <ArrowUpRight className="h-3 w-3" />
                                            </div> : <div className="flex items-center text-red-600">
                                                <ArrowDownLeft className="h-3 w-3" />
                                            </div>
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader className="p-2">
                            <CardTitle className="text-md font-semibold flex items-center">
                                <Activity className="h-5 w-5 mr-2 text-blue-600" />
                                Recent Tranctions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-0">
                                {recentTransaction.map((transaction) => {
                                    const owner = transaction.model || transaction.customer;
                                    return (
                                        <div key={transaction.id} className="flex items-start space-x-3 py-2 px-4 hover:bg-gray-50 transition-colors">
                                            <div className={`w-2 h-2 rounded-full mt-2 ${transaction.identifier === "deposit" ? "bg-green-500" :
                                                transaction.identifier === "withdraw" ? "bg-blue-500" :
                                                    transaction.identifier === "payment" ? "bg-purple-500" : "bg-yellow-500"
                                                }`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">{transaction.identifier}</p>
                                                <p className="text-xs text-gray-500 truncate">{owner?.firstName}&nbsp;{owner?.lastName}</p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className={`text-sm font-medium ${transaction.identifier === 'withdraw' || transaction.identifier === 'payment' ? 'text-red-600' :
                                                        transaction.identifier === 'deposit' ? 'text-green-600' : 'text-gray-900'
                                                        }`}>
                                                        {transaction.identifier === 'withdraw' || transaction.identifier === 'payment' ? '-' : '+'}
                                                        {transaction.amount.toLocaleString()} Kip
                                                    </span>
                                                    <span className="text-xs text-gray-400">• {timeAgo(transaction.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const order = searchParams.get("order") || "desc";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    const [walletData, walletStatus, topEarning, recentTransaction] = await Promise.all([
        getWallets({
            search,
            type,
            order,
            status,
            fromDate,
            toDate,
            page,
            limit: showBy,
        }),
        getWalletStatus(),
        getTopEarningWallet(),
        getRecentTransactions("", "", 5)
    ]);

    return json({
        walletData: walletData.wallets,
        pagination: walletData.pagination,
        success,
        walletStatus,
        topEarning,
        recentTransaction,
        filters: {
            search,
            type,
            order,
            status,
            fromDate,
            toDate,
            page,
            showBy,
        }
    });
}
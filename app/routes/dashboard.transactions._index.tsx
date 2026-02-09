import { toast } from "react-toastify";
import React, { useCallback, useRef } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    X,
    Eye,
    Mars,
    Venus,
    Users,
    Check,
    UserCheck,
    MoreVertical,
    ArrowUpRight,
    CircleDollarSign,
    ArrowDownLeft,
    RotateCcw,
    CheckCircle,
    EyeOff,
} from "lucide-react";

// components
import { Badge } from "~/components/ui/badge";
import EmptyPage from "~/components/ui/empty";
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

// hooks
import { usePolling } from "~/hooks/usePolling";

// service and utils
import { useAuthStore } from "~/store/permissionStore";
import { capitalizeFirstLetter, formatDate1 } from "~/utils";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getTransactions, getTransactionStatus } from "~/services/transaction.server";

interface LoaderData {
    transactionStatus: any;
    transactions: any;
    pagination: any;
    filters: any;
    success: string;
}

const iconMap = {
    CircleDollarSign
};

export default function Transactions() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { transactions, transactionStatus, pagination, filters, success } = useLoaderData<LoaderData>();
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
        const identifier = formData.get("identifier") as string;
        const status = formData.get("status") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            identifier: identifier || "all",
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

    const canEdit = hasPermission("transaction", "edit");
    const canAccess = hasPermission("transaction", "view");

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
                    <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Transaction Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Transaction management", value: "/transactions" },
                        ]}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {transactionStatus.map((stat: any) => {
                    const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                    return (
                        <Card key={stat.title} className="border-0 shadow-md hover:shadow-md transition-shadow rounded-md">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 space-y-2">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                                        <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                        <div className="flex items-center mt-1">
                                            {stat.value > 0 ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownLeft className="h-3 w-3 text-red-500" />}
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
                                <div className="hidden sm:block w-28">
                                    <select
                                        name="identifier"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.identifier}
                                    >
                                        <option value="all">All types</option>
                                        <option value="withdrawal">Withdrawal</option>
                                        <option value="recharge">Recharge</option>
                                        <option value="payment">Payment</option>
                                        <option value="booking_hold">Booking Hold</option>
                                        <option value="booking_refund">Booking Refund</option>
                                        <option value="booking_earning">Booking Earning</option>
                                        <option value="subscription">Subscription</option>
                                        <option value="referral">Referral</option>
                                    </select>
                                </div>
                                <div className="hidden sm:block w-28">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.status}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="pending">Pending</option>
                                        <option value="held">Held</option>
                                    </select>
                                </div>
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
                            <div className="flex items-center justify-between w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-0 sm:space-x-2">
                                <div className="block sm:hidden w-28">
                                    <select
                                        name="identifier"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.identifier}
                                    >
                                        <option value="all">All types</option>
                                        <option value="withdraw">Withdraw</option>
                                        <option value="recharge">Recharge</option>
                                        <option value="payment">Payment</option>
                                        <option value="booking_hold">Booking Hold</option>
                                    </select>
                                </div>
                                <div className="block sm:hidden w-28">
                                    <select
                                        name="status"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        defaultValue={filters.status}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="pending">Pending</option>
                                        <option value="held">Held</option>
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
                        {/* Mobile Card View */}
                        <div className="block md:hidden space-y-3 p-3">
                            {transactions && transactions.length > 0 ? transactions.map((transaction: any, index: number) => {
                                const owner = transaction.model || transaction.customer;
                                return (
                                    <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                        {/* Header: User Info & Status */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center space-x-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={owner?.profile ?? ""} />
                                                    <AvatarFallback className="text-sm">{owner?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {owner?.firstName ?? "Unknown"} {owner?.lastName ?? ""}
                                                    </p>
                                                    <p className="flex items-center text-xs text-gray-500">
                                                        {transaction.model ? <UserCheck className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                                                        {transaction.model ? "Model" : "Customer"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <StatusBadge status={transaction.status} />
                                                {transaction.customerHidden && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                        <EyeOff className="h-2.5 w-2.5" />
                                                        Customer hidden
                                                    </span>
                                                )}
                                                {transaction.modelHidden && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                        <EyeOff className="h-2.5 w-2.5" />
                                                        Model hidden
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Payment Flow (for payment type) */}
                                        {transaction.identifier === "payment" && transaction.model && (
                                            <div className="flex items-center justify-center py-2 mb-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={transaction.customer?.profile ?? ""} />
                                                        <AvatarFallback className="text-xs">{transaction.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-gray-600">{transaction.customer?.firstName ?? "Customer"}</span>
                                                </div>
                                                <span className="mx-2 text-gray-400">→</span>
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={transaction.model?.profile ?? ""} />
                                                        <AvatarFallback className="text-xs">{transaction.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-gray-600">{transaction.model?.firstName ?? "Model"}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Transaction Details */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Amount:</span>
                                                <span className={`font-bold ${
                                                    ['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? 'text-green-600' :
                                                    ['withdrawal', 'payment', 'subscription'].includes(transaction.identifier) ? 'text-red-600' :
                                                    transaction.identifier === 'booking_hold' ? 'text-orange-600' : 'text-gray-900'
                                                }`}>
                                                    {['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? '+' : '-'}
                                                    {Math.abs(transaction.amount).toLocaleString()} Kip
                                                </span>
                                            </div>
                                            {transaction.fee > 0 && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-500">Fee:</span>
                                                    <span className="text-gray-600">{transaction.fee.toLocaleString()} Kip</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Type:</span>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${
                                                        ['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? 'text-green-800 border-green-200' :
                                                        ['withdrawal', 'payment', 'subscription'].includes(transaction.identifier) ? 'text-red-800 border-red-200' :
                                                        transaction.identifier === 'booking_hold' ? 'text-orange-800 border-orange-200' : 'text-gray-800'
                                                    }`}
                                                >
                                                    {['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? '+' : '-'}
                                                    {capitalizeFirstLetter(transaction.identifier?.replace('_', ' '))}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Date:</span>
                                                <span className="text-gray-600">{formatDate1(transaction.createdAt)}</span>
                                            </div>
                                            {transaction.reason && (
                                                <div className="pt-2 border-t">
                                                    <span className="text-gray-500 text-xs">Reason:</span>
                                                    <p className="text-gray-700 text-xs mt-1">{transaction.reason}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
                                            {canAccess && (
                                                <Link to={`view/${transaction.id}`}>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                                        <Eye className="h-3 w-3 mr-1" /> View
                                                    </Button>
                                                </Link>
                                            )}
                                            {transaction.status === "pending" && canEdit && (
                                                <>
                                                    <Link to={`approve/${transaction.id}?type=${transaction.customerId === null ? "model" : "customer"}`}>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50">
                                                            <Check className="h-3 w-3 mr-1" /> Approve
                                                        </Button>
                                                    </Link>
                                                    <Link to={`reject/${transaction.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50">
                                                            <X className="h-3 w-3 mr-1" /> Reject
                                                        </Button>
                                                    </Link>
                                                </>
                                            )}
                                            {transaction.status === "held" && transaction.identifier === "booking_hold" && canEdit && (
                                                <>
                                                    <Link to={`refund/${transaction.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50">
                                                            <RotateCcw className="h-3 w-3 mr-1" /> Refund
                                                        </Button>
                                                    </Link>
                                                    <Link to={`complete/${transaction.id}`}>
                                                        <Button variant="outline" size="sm" className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50">
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Complete
                                                        </Button>
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            }) : (
                                <EmptyPage
                                    title="No transaction found!"
                                    description="There is no transaction in the database yet!"
                                />
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-t border-gray-100 hover:bg-gray-100">
                                        <TableHead className="font-semibold">No</TableHead>
                                        <TableHead className="font-semibold">Transaction</TableHead>
                                        <TableHead className="font-semibold">Amount</TableHead>
                                        <TableHead className="font-semibold">Type</TableHead>
                                        <TableHead className="font-semibold">Status</TableHead>
                                        <TableHead className="font-semibold">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions && transactions.length > 0 ? transactions.map((transaction: any, index: number) => {
                                        const owner = transaction.model || transaction.customer;
                                        return (
                                            <TableRow key={transaction.id} className="border-gray-50 hover:bg-gray-50">
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        {transaction.identifier === "payment" ? <div className="flex items-center justify-start">
                                                            <div className="flex items-center space-x-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={transaction.customer?.profile ?? ""} />
                                                                    <AvatarFallback>{transaction.customer?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-900">{transaction.customer?.firstName ?? "Unknown"} {transaction.customer?.lastName ?? ""}</p>
                                                                    <p className="flex items-center justify-start text-xs font-medium text-gray-900"><Users className="h-3 w-3" />&nbsp;{transaction.customer?.gender ?? "N/A"}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-2 pl-4">
                                                                <div className="text-xs text-gray-400">→</div>
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={transaction.model?.profile ?? ""} />
                                                                    <AvatarFallback>{transaction.model?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm text-gray-600">{transaction.model?.firstName ?? "Unknown"}&nbsp;{transaction.model?.lastName ?? ""}</p>
                                                                    <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                                        {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"},&nbsp;
                                                                        {transaction.model ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div> :
                                                            <div className="flex items-center space-x-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={owner?.profile ?? ""} />
                                                                    <AvatarFallback>{owner?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm text-gray-600">{owner?.firstName ?? "Unknown"}&nbsp;{owner?.lastName ?? ""}</p>
                                                                    <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                                                                        {transaction.model ? <UserCheck className="h-3 w-3" /> : <Users className="h-3 w-3" />}&nbsp;{transaction.model ? "Model" : "Customer"},&nbsp;
                                                                        {transaction.model ? <span className="flex items-center justify-start"><Mars className="h-3 w-3" />&nbsp;Male</span> : <span className="flex items-center justify-start"><Venus className="h-3 w-3" />&nbsp;Female</span>}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        }
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="flex items-center justify-start gap-2">
                                                            <p className={`text-sm font-medium ${
                                                                ['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? 'text-green-600' :
                                                                ['withdrawal', 'payment', 'subscription'].includes(transaction.identifier) ? 'text-red-600' :
                                                                transaction.identifier === 'booking_hold' ? 'text-orange-600' : 'text-gray-900'
                                                            }`}>
                                                                {['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? '+' : '-'}
                                                                {Math.abs(transaction.amount).toLocaleString()} Kip
                                                            </p>
                                                            {transaction.fee > 0 && (
                                                                <p className="text-xs text-gray-500">(Fee: {transaction.fee.toLocaleString()} Kip)</p>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400">{formatDate1(transaction.createdAt)}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${
                                                            ['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? 'text-green-800 border-green-200' :
                                                            ['withdrawal', 'payment', 'subscription'].includes(transaction.identifier) ? 'text-red-800 border-red-200' :
                                                            transaction.identifier === 'booking_hold' ? 'text-orange-800 border-orange-200' : 'text-gray-800'
                                                        }`}
                                                    >
                                                        {['recharge', 'booking_refund', 'booking_earning', 'referral'].includes(transaction.identifier) ? '+' : '-'}
                                                        {capitalizeFirstLetter(transaction.identifier?.replace('_', ' '))}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <StatusBadge status={transaction.status} />
                                                        {(transaction.customerHidden || transaction.modelHidden) && (
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                {transaction.customerHidden && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                                        <EyeOff className="h-2.5 w-2.5" />
                                                                        Customer hidden
                                                                    </span>
                                                                )}
                                                                {transaction.modelHidden && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-600 border border-orange-200">
                                                                        <EyeOff className="h-2.5 w-2.5" />
                                                                        Model hidden
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
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
                                                            {canAccess && <DropdownMenuItem className="text-sm">
                                                                <Link to={`view/${transaction.id}`} className="flex space-x-2">
                                                                    <Eye className="mr-2 h-3 w-3" />
                                                                    <span>View details</span>
                                                                </Link>
                                                            </DropdownMenuItem>}
                                                            {transaction.status === "pending" && canEdit &&
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`approve/${transaction.id}?type=${transaction.customerId === null ? "model" : "customer"}`} className="flex space-x-2">
                                                                        <Check className="mr-2 h-3 w-3 text-green-500" />
                                                                        <span>Approve</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            }
                                                            {transaction.status === "pending" && canEdit &&
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`reject/${transaction.id}`} className="flex space-x-2">
                                                                        <X className="mr-2 h-3 w-3 text-red-500" />
                                                                        <span>Reject</span>
                                                                    </Link>
                                                                </DropdownMenuItem>}
                                                            {transaction.status === "held" && transaction.identifier === "booking_hold" && canEdit &&
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`refund/${transaction.id}`} className="flex space-x-2">
                                                                        <RotateCcw className="mr-2 h-3 w-3 text-orange-500" />
                                                                        <span>Refund</span>
                                                                    </Link>
                                                                </DropdownMenuItem>}
                                                            {transaction.status === "held" && transaction.identifier === "booking_hold" && canEdit &&
                                                                <DropdownMenuItem className="text-sm">
                                                                    <Link to={`complete/${transaction.id}`} className="flex space-x-2">
                                                                        <CheckCircle className="mr-2 h-3 w-3 text-green-500" />
                                                                        <span>Complete</span>
                                                                    </Link>
                                                                </DropdownMenuItem>}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }) : <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <EmptyPage
                                                title="No transaction found!"
                                                description="There is no transaction in the database yet!"
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
            </div>
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "transaction",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");
    // Extract search parameters
    const search = searchParams.get("search") || "";
    const identifier = searchParams.get("identifier") || "all";
    const status = searchParams.get("status") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [transactionStatus, transactions] = await Promise.all([
            getTransactionStatus(),
            getTransactions({
                search,
                identifier,
                status,
                fromDate,
                toDate,
                page,
                limit: showBy,
            })
        ])
        if (!transactionStatus) throw new Error("Failed to fetch transaction status!");

        return json({
            ...transactions,
            pagination: transactions.pagination,
            transactionStatus,
            success,
            filters: {
                search,
                status,
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
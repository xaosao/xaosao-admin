import { useCallback } from "react";
import { json, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
    ArrowUpCircle,
    ShoppingCart,
    Users,
    Building,
    CreditCard,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    Download,
    UserCheck,
} from "lucide-react";

// components
import { Badge } from "~/components/ui/badge";
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";

// utils and services
import { useAuthStore } from "~/store/permissionStore";
import { capitalizeFirstLetter } from "~/utils";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import {
    getFinanceSummary,
    getFinanceBreakdown,
    getModelEarningsTable,
} from "~/services/finance.server";

// types
import type { IFinanceSummary, IFinanceBreakdownItem, IModelEarnings } from "~/interfaces/finance";
import type { IPagination } from "~/interfaces/base";

interface LoaderData {
    summary: IFinanceSummary[];
    breakdown: {
        income: IFinanceBreakdownItem[];
        expense: IFinanceBreakdownItem[];
        totalIncome: number;
        totalExpense: number;
    };
    modelEarnings: {
        models: IModelEarnings[];
        pagination: IPagination;
    };
    filters: {
        period: string;
        fromDate: string;
        toDate: string;
    };
}

const iconMap: Record<string, any> = {
    ArrowUpCircle,
    ShoppingCart,
    Users,
    Building,
    CreditCard,
    TrendingUp,
};

const bgColorMap: Record<string, string> = {
    "text-blue-600": "bg-blue-50",
    "text-orange-600": "bg-orange-50",
    "text-green-600": "bg-green-50",
    "text-purple-600": "bg-purple-50",
    "text-pink-600": "bg-pink-50",
    "text-emerald-600": "bg-emerald-50",
};

const formatKip = (amount: number) => `${amount.toLocaleString("en-US")} ₭`;

export default function FinancePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { summary, breakdown, modelEarnings, filters } =
        useLoaderData<LoaderData>();

    const canAccess = hasPermission("finance", "view");
    const canEdit = hasPermission("finance", "edit");

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

    const handlePeriodChange = (period: string) => {
        updateFilters({ period, from: "", to: "" });
    };

    const handleCSVExport = () => {
        window.open(`/dashboard/finance/export?${searchParams.toString()}`, "_blank");
    };

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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                            Finance Overview
                        </h1>
                        <Breadcrumb
                            items={[
                                { label: "Dashboard", value: "/dashboard" },
                                { label: "Finance", value: "/dashboard/finance" },
                            ]}
                        />
                    </div>
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex sm:hidden h-8 text-sm"
                            onClick={handleCSVExport}
                        >
                            <Download className="h-3 w-3 mr-1" />
                            Export CSV
                        </Button>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                    {/* Period Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 flex-wrap">
                        {[
                            { key: "all", label: "All Time" },
                            { key: "daily", label: "Daily" },
                            { key: "weekly", label: "Weekly" },
                            { key: "monthly", label: "Monthly" },
                            { key: "3month", label: "3 Months" },
                            { key: "6month", label: "6 Months" },
                        ].map((p) => (
                            <button
                                key={p.key}
                                onClick={() => handlePeriodChange(p.key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filters.period === p.key
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* CSV Export */}
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex h-8 text-sm"
                            onClick={handleCSVExport}
                        >
                            <Download className="h-3 w-3 mr-1" />
                            Export CSV
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {summary.map((stat: IFinanceSummary) => {
                    const IconComponent = iconMap[stat.icon];
                    return (
                        <Card key={stat.label} className="border-0 shadow-md hover:shadow-lg transition-shadow rounded-md">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                                            {stat.label}
                                        </p>
                                        <p className="text-sm sm:text-md font-bold text-gray-900 truncate">
                                            {stat.value}
                                        </p>
                                        <div className="flex items-center">
                                            {stat.rawValue > 0 ? (
                                                <ArrowUpRight className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <ArrowDownLeft className="h-3 w-3 text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-lg ${bgColorMap[stat.color] || "bg-gray-50"} flex-shrink-0`}>
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

            {/* Income / Expense Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Income Breakdown */}
                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center">
                            <ArrowUpCircle className="h-4 w-4 mr-2 text-blue-600" />
                            Income Breakdown
                            <span className="ml-auto text-xs font-normal text-gray-500">
                                Total: {formatKip(breakdown.totalIncome)}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {breakdown.income.length > 0 ? (
                            breakdown.income.map((item: IFinanceBreakdownItem) => (
                                <div key={item.category} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-700">{item.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900">
                                                {item.formattedAmount}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                ({item.count})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${item.color}`}
                                            style={{ width: `${Math.max(item.percentage, 2)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-right">{item.percentage}%</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-4">No income data</p>
                        )}
                    </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center">
                            <ShoppingCart className="h-4 w-4 mr-2 text-orange-600" />
                            Expense Breakdown (Paid to Models)
                            <span className="ml-auto text-xs font-normal text-gray-500">
                                Total: {formatKip(breakdown.totalExpense)}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {breakdown.expense.length > 0 ? (
                            breakdown.expense.map((item: IFinanceBreakdownItem) => (
                                <div key={item.category} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-700">{item.label}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-900">
                                                {item.formattedAmount}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                ({item.count})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${item.color}`}
                                            style={{ width: `${Math.max(item.percentage, 2)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 text-right">{item.percentage}%</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-4">No expense data</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Model Earnings Table */}
            <Card className="border-0 shadow-md rounded-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center">
                        <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                        Model Earnings Breakdown
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3 p-3">
                        {modelEarnings.models && modelEarnings.models.length > 0 ? (
                            modelEarnings.models.map((model: IModelEarnings) => (
                                <div key={model.modelId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                    <div className="flex items-center space-x-3 mb-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={model.profile} alt={model.firstName} />
                                            <AvatarFallback>{model.firstName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {model.firstName} {model.lastName}
                                            </p>
                                            <Badge variant="outline" className="text-[10px]">
                                                {model.type}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Booking:</span>
                                            <span className="font-medium text-green-600">{formatKip(model.bookingEarnings)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Referral:</span>
                                            <span className="font-medium text-yellow-600">{formatKip(model.referralBonuses)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Booking Commission:</span>
                                            <span className="font-medium text-teal-600">{formatKip(model.bookingCommission)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Subscription Commission:</span>
                                            <span className="font-medium text-cyan-600">{formatKip(model.subscriptionCommission)}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t">
                                            <span className="text-gray-700 font-semibold">Total:</span>
                                            <span className="font-bold text-gray-900">{formatKip(model.totalEarnings)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <EmptyPage title="No earnings data" description="No model earnings found for this period." />
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-gray-100">
                                    <TableHead className="font-semibold">NO</TableHead>
                                    <TableHead className="font-semibold">Model</TableHead>
                                    <TableHead className="font-semibold">Type</TableHead>
                                    <TableHead className="font-semibold text-right">Booking Earnings</TableHead>
                                    <TableHead className="font-semibold text-right">Referral Bonuses</TableHead>
                                    <TableHead className="font-semibold text-right">Booking Commission</TableHead>
                                    <TableHead className="font-semibold text-right">Subscription Commission</TableHead>
                                    <TableHead className="font-semibold text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modelEarnings.models && modelEarnings.models.length > 0 ? (
                                    modelEarnings.models.map((model: IModelEarnings, index: number) => (
                                        <TableRow key={model.modelId} className="border-gray-50 hover:bg-gray-50">
                                            <TableCell>{(modelEarnings.pagination.currentPage - 1) * modelEarnings.pagination.limit + index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={model.profile} />
                                                        <AvatarFallback className="text-xs">{model.firstName?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm font-medium">
                                                        {model.firstName} {model.lastName}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs ${model.type === "partner" ? "text-purple-700 border-purple-200" :
                                                    model.type === "special" ? "text-blue-700 border-blue-200" :
                                                        "text-gray-700 border-gray-200"
                                                    }`}>
                                                    {capitalizeFirstLetter(model.type)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium text-green-600">
                                                {formatKip(model.bookingEarnings)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium text-yellow-600">
                                                {formatKip(model.referralBonuses)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium text-teal-600">
                                                {formatKip(model.bookingCommission)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-medium text-cyan-600">
                                                {formatKip(model.subscriptionCommission)}
                                            </TableCell>
                                            <TableCell className="text-right text-sm font-bold text-gray-900">
                                                {formatKip(model.totalEarnings)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8">
                                            <EmptyPage title="No earnings data" description="No model earnings found for this period." />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <Pagination
                        currentPage={modelEarnings.pagination.currentPage}
                        totalPages={modelEarnings.pagination.totalPages}
                        totalCount={modelEarnings.pagination.totalCount}
                        limit={modelEarnings.pagination.limit}
                        hasNextPage={modelEarnings.pagination.hasNextPage}
                        hasPreviousPage={modelEarnings.pagination.hasPreviousPage}
                        baseUrl=""
                        searchParams={searchParams}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

// Loader
export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "finance",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const period = searchParams.get("period") || "all";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    try {
        const [summary, breakdown, modelEarnings] = await Promise.all([
            getFinanceSummary(period, fromDate || undefined, toDate || undefined),
            getFinanceBreakdown(period, fromDate || undefined, toDate || undefined),
            getModelEarningsTable({
                period,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
                page,
                limit,
            }),
        ]);

        return json({
            summary,
            breakdown,
            modelEarnings,
            filters: {
                period,
                fromDate,
                toDate,
            },
        });
    } catch (error) {
        console.error("LOAD_FINANCE_DATA_FAILED", error);
        throw new Error("Failed to load finance data");
    }
}

"use client"

import { useCallback, useRef } from "react"
import { json, LoaderFunctionArgs } from "@remix-run/node"
import { Form, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { DollarSign, TrendingUp, BarChart3, CreditCard, MapPin, UserRoundCheck, TrendingDown } from "lucide-react"

// components
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { ChartContainer, ChartTooltip } from "~/components/ui/chart"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select1"

// services
import { useAuthStore } from "~/store/permissionStore"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { getMonthlyExpenseData, getMonthlyRevenueData, getRevenueBreakdown, getRevenueStats, getTopEarning } from "~/services/revenue.server"

const RevenueTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="font-semibold text-gray-900 mb-1">{label}</p>
                <p className="text-sm text-green-600">Revenue: ${payload[0].value.toLocaleString()}</p>
            </div>
        )
    }
    return null
}

const ExpenseTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                <p className="font-semibold text-gray-900 mb-1">{label}</p>
                <p className="text-sm text-pink-600">Expense: ${payload[0].value.toLocaleString()}</p>
            </div>
        )
    }
    return null
}

interface LoaderData {
    filters: any;
    topEarning: any;
    revenueStats: any[];
    breakRevenue: any;
    monthlyRevenueData: any;
    monthlyExpenseData: any;
}

export default function RevenuePage() {
    const navigate = useNavigate();
    const formRef = useRef<HTMLFormElement>(null);
    const [searchParams] = useSearchParams();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { revenueStats, breakRevenue, topEarning, monthlyRevenueData, monthlyExpenseData, filters } = useLoaderData<LoaderData>();

    const updateFilters = useCallback((updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        navigate(`?${params.toString()}`, { replace: true });
    }, [searchParams, navigate]);

    const handleSearchSubmit = useCallback((formData: FormData) => {
        const year = formData.get("year") as string;
        updateFilters({ year: year || "" });
    }, [updateFilters]);

    const canAccess = hasPermission("revenue", "view");
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Revenue Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Track earnings and financial performance</p>
                </div>
                <Form
                    ref={formRef}
                    method="get"
                    onChange={(e) => {
                        const formData = new FormData(e.currentTarget);
                        handleSearchSubmit(formData);
                    }}
                    className="flex items-center gap-3"
                >
                    <Select name="year" defaultValue={filters.year}>
                        <SelectTrigger className="w-24">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025">2025</SelectItem>
                            <SelectItem value="2026">2026</SelectItem>
                            <SelectItem value="2027">2027</SelectItem>
                            <SelectItem value="2028">2028</SelectItem>
                            <SelectItem value="2029">2029</SelectItem>
                            <SelectItem value="2030">2030</SelectItem>
                        </SelectContent>
                    </Select>
                </Form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {revenueStats.map((stat, index) => (
                    <Card key={index} className="border-0 shadow-md rounded-md">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1 space-y-2">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{stat.label}</p>
                                    <p className="text-md sm:text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
                                    <div className="flex items-center mt-1">
                                        {stat.value ? <TrendingUp className="h-3 w-3 text-green-500 flex-shrink-0" /> : <TrendingDown className="h-3 w-3 text-red-500 flex-shrink-0" />}
                                    </div>
                                </div>
                                <div className="p-2 rounded-lg bg-green-50 flex-shrink-0">
                                    <DollarSign className="h-4 w-4 text-green-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <CardTitle className="text-sm sm:text-md font-semibold flex items-center">
                                <BarChart3 className="h-5 w-5 mr-2 text-green-700 flex-shrink-0" />
                                <span className="truncate">Monthly Revenue Report</span>
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ChartContainer
                            config={{
                                revenue: {
                                    label: "Revenue",
                                    color: "#16a34a",
                                },
                            }}
                            className="h-[300px] sm:h-[350px]"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyRevenueData} margin={{ top: 20, right: 30, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} interval={0} />
                                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                                    <ChartTooltip content={<RevenueTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#16a34a"
                                        strokeWidth={3}
                                        fill="url(#revenueGradient)"
                                        dot={{ fill: "#16a34a", strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6, stroke: "#16a34a", strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <CardTitle className="text-sm sm:text-md font-semibold flex items-center">
                                <CreditCard className="h-5 w-5 mr-2 text-pink-700 flex-shrink-0" />
                                <span className="truncate">Monthly Expense Report</span>
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ChartContainer
                            config={{
                                expense: {
                                    label: "Expense",
                                    color: "#be185d",
                                },
                            }}
                            className="h-[300px] sm:h-[350px]"
                        >
                            <ResponsiveContainer width="100%" height="100%" className="p-0">
                                <AreaChart data={monthlyExpenseData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#be185d" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#be185d" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} interval={0} />
                                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                                    <ChartTooltip content={<ExpenseTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="expense"
                                        stroke="#be185d"
                                        strokeWidth={3}
                                        fill="url(#expenseGradient)"
                                        dot={{ fill: "#be185d", strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6, stroke: "#be185d", strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Revenue Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {breakRevenue.map((item: any) => (
                                <div key={item.source} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900 truncate">{item.source}</span>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            <span className="text-sm font-semibold text-green-600">{item.amount}</span>
                                            <span className="text-xs text-gray-500 ml-2">{item.percentage}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md rounded-md">
                    <CardHeader>
                        <CardTitle className="text-sm sm:text-md font-semibold flex items-center">
                            <UserRoundCheck className="h-5 w-5 mr-1 flex-shrink-0" />
                            <span className="truncate">Top Earners</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {topEarning.map((earner: any) => (
                                <div key={earner.id} className="hover:bg-gray-50 rounded-md p-2 flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                        <div className="flex items-center space-x-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={earner.model.profile ?? ""} alt={`${earner.model.firstName} ${earner.model.lastName}`} />
                                                <AvatarFallback className="">{earner.model.firstName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">{earner.model.firstName}&nbsp;{earner.model.lastName}</p>
                                            <p className="flex items-center justify-start text-xs font-medium text-gray-500 gap-2"><MapPin height={12} width={12} />{earner.model.address}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-semibold text-green-600">${earner.totalBalance}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "revenue",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const year = searchParams.get("year") || "2025";
    const [revenueStats, breakRevenue, topEarning, monthlyRevenueData, monthlyExpenseData] = await Promise.all([
        getRevenueStats(),
        getRevenueBreakdown(),
        getTopEarning(),
        getMonthlyRevenueData(Number(year)),
        getMonthlyExpenseData(Number(year)),
    ]);

    return json({
        revenueStats,
        breakRevenue,
        topEarning,
        monthlyRevenueData,
        monthlyExpenseData,
        filters: {
            year,
        }
    });
}

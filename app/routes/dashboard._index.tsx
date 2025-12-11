"use client"

import { useState } from "react"
import { useLoaderData } from "@remix-run/react"
import { json, LoaderFunctionArgs } from "@remix-run/node"

import {
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  Legend,
  BarChart,
  LineChart,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import {
  Users,
  Phone,
  Clock,
  Filter,
  UserCheck,
  DollarSign,
  ArrowUpRight,
  MessageCircle,
} from "lucide-react"

// components
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { ChartContainer, ChartTooltip } from "~/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select1"

// service and utils
import { useAuthStore } from "~/store/permissionStore"
import { IDashboardReport, IDashboardStats } from "~/interfaces/dashboard"
import { getDashboardData, getDashboardStats } from "~/services/dashboard.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

const iconMap = {
  Users,
  UserCheck,
  MessageCircle,
  Phone,
};

type Mode = "daily" | "weekly" | "monthly";

interface LoaderData {
  dashboardStats: IDashboardStats[];
  dashboardData: IDashboardReport[];
  mode: Mode;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { dashboardStats, dashboardData, mode: initialMode } = useLoaderData<LoaderData>();
  const [timeFilter, setTimeFilter] = useState<Mode>(initialMode)

  const chartData = dashboardData

  const canView = hasPermission("dashboard", "view");
  if (!canView) {
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
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor your dating platform performance</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <form method="get">
              <Select
                value={timeFilter}
                onValueChange={(value: Mode) => {
                  setTimeFilter(value)
                  const url = new URL(window.location.href)
                  url.searchParams.set('mode', value)
                  window.location.href = url.toString()
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats.map((stat: any) => {
          const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
          return (
            <Card key={stat.title} className="border-0 shadow-md hover:shadow-lg transition-shadow rounded-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <div className="flex items-center mt-1">
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                      <span
                        className={`text-xs font-medium ml-1 ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}
                      >
                        {stat.change}
                      </span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md rounded-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2 text-pink-700" />
              Models & Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={{
                models: {
                  label: "Models",
                  color: "green",
                },
                customers: {
                  label: "Customers",
                  color: "#9d174d",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="models"
                    stroke="var(--color-models)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-models)", strokeWidth: 2, r: 4 }}
                    name="Models"
                  />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    stroke="var(--color-customers)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-customers)", strokeWidth: 2, r: 4 }}
                    name="Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              <DollarSign className="h-5 w-5 mr-2 text-pink-700" />
              Revenue and Expend Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={{
                revenue: {
                  label: "Revenue",
                  color: "#be185d",
                },
                expended: {
                  label: "Expended",
                  color: "green",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    fill="var(--color-revenue)"
                    fillOpacity={0.2}
                    strokeWidth={3}
                    name="Revenue ($)"
                  />

                  <Area
                    type="monotone"
                    dataKey="expended"
                    stroke="var(--color-expended)"
                    fill="var(--color-expended)"
                    fillOpacity={0.2}
                    strokeWidth={3}
                    name="Expended ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              <MessageCircle className="h-5 w-5 mr-2 text-pink-700" />
              Chat Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={{
                chats: {
                  label: "Chat Messages",
                  color: "gray",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="chats" fill="var(--color-chats)" radius={[4, 4, 0, 0]} name="Chat Messages" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Clock className="h-5 w-5 mr-2 text-pink-700" />
              Session Types
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ChartContainer
              config={{
                callSessions: {
                  label: "Call Sessions",
                  color: "#be185d",
                },
                videoSessions: {
                  label: "Video Sessions",
                  color: "#831843",
                },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="callSessions"
                    fill="var(--color-callSessions)"
                    radius={[4, 4, 0, 0]}
                    name="Call Sessions"
                  />
                  <Bar
                    dataKey="videoSessions"
                    fill="var(--color-videoSessions)"
                    radius={[4, 4, 0, 0]}
                    name="Video Sessions"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
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
    group: "dashboard",
    action: "view",
  });

  const url = new URL(request.url);
  const mode = (url.searchParams.get('mode') as Mode) || 'daily';

  const [dashboardStats, dashboardData] = await Promise.all([
    getDashboardStats(),
    getDashboardData(mode)
  ]);

  return json({
    dashboardStats,
    dashboardData,
    mode,
  });
}
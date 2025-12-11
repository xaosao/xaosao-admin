import { json, useLoaderData, useNavigate } from "@remix-run/react";
import {
    Clock,
    Users,
    Globe,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Monitor,
    Smartphone,
    Tablet,
    ArrowLeft,
} from "lucide-react";

// components
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// services
import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getDashboardMetrics, getSessionDurationStats, getTopCountriesPerModel } from "~/services/call.session.server";

const deviceStats = [
    { type: "Desktop", count: 1234, percentage: 52 },
    { type: "Mobile", count: 867, percentage: 37 },
    { type: "Tablet", count: 256, percentage: 11 },
];

const browserStats = [
    { name: "Chrome", count: 1567, percentage: 67 },
    { name: "Safari", count: 456, percentage: 19 },
    { name: "Firefox", count: 234, percentage: 10 },
    { name: "Edge", count: 100, percentage: 4 },
];

export default function Sessions() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { durationStats, topCountries, metrics } =
        useLoaderData<typeof loader>();

    console.log(topCountries[0]);
    const sessionStats = [
        {
            title: "Active Sessions",
            value: metrics.activeSessions,
            change: "+189",
            trend: "up",
            icon: Users,
            color: "text-blue-600",
        },
        {
            title: "Avg Duration",
            value: metrics.avgDurationMinutes,
            change: "+5m",
            trend: "up",
            icon: Clock,
            color: "text-green-600",
        },
        {
            title: "Bounce Rate",
            value: metrics.bounceRatePercent + "%",
            change: "-2.1%",
            trend: "down",
            icon: Activity,
            color: "text-purple-600",
        },
        {
            title: "Peak Concurrent",
            value: metrics.peakConcurrent,
            change: "+234",
            trend: "up",
            icon: TrendingUp,
            color: "text-orange-600",
        },
    ];

    const durations = [
        {
            range: "0-15m",
            label: "Quick visits",
            value: durationStats.quickVisits,
            color: "green",
        },
        {
            range: "15-60m",
            label: "Standard visits",
            value: durationStats.standardVisits,
            color: "blue",
        },
        {
            range: "1-3h",
            label: "Long visits",
            value: durationStats.longVisits,
            color: "purple",
        },
        {
            range: "3h+",
            label: "Extended visits",
            value: durationStats.extendedVisits,
            color: "orange",
        },
    ];

    function closeHandler() {
        navigate("..");
    }

    const canView = hasPermission("session", "view");

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
                    <h1 className="text-lg font-semibold text-gray-900">Session Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Monitor active user sessions and analytics</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" onClick={closeHandler}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {sessionStats.map((stat) => (
                    <Card key={stat.title} className="border-0 shadow-md hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.title}</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                                    <div className="flex items-center mt-1">
                                        {stat.trend === "up" ? (
                                            <ArrowUpRight className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <ArrowDownRight className="h-3 w-3 text-red-500" />
                                        )}
                                        <span
                                            className={`text-xs font-medium ml-1 ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}
                                        >
                                            {stat.change}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-2 rounded-lg bg-gray-50">
                                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 gap-6">
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Device Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {deviceStats.map((device) => (
                                    <div key={device.type} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            {device.type === "Desktop" && <Monitor className="h-5 w-5 text-blue-600" />}
                                            {device.type === "Mobile" && <Smartphone className="h-5 w-5 text-green-600" />}
                                            {device.type === "Tablet" && <Tablet className="h-5 w-5 text-purple-600" />}
                                            <span className="text-sm font-medium text-gray-900">{device.type}</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${device.type === "Desktop" ? "bg-blue-600" :
                                                        device.type === "Mobile" ? "bg-green-600" : "bg-purple-600"
                                                        }`}
                                                    style={{ width: `${device.percentage}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm text-gray-600 w-12 text-right">{device.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Browser Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {browserStats.map((browser) => (
                                    <div key={browser.name} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-xs font-medium">
                                                {browser.name[0]}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{browser.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="w-24 bg-gray-200 rounded-full h-2">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full"
                                                    style={{ width: `${browser.percentage}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm text-gray-600 w-12 text-right">{browser.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center">
                                <Globe className="h-5 w-5 mr-2 text-blue-600" />
                                Top Locations
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-0">
                                {topCountries?.map((location: any, index: number) => {
                                    console.log("LOcation::::", location);
                                    return (
                                        <div key={location.topCountries[0].country + index + 1} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{location.topCountries[0].country}</p>
                                                    <p className="text-xs text-gray-500">#{index + 1} location</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-gray-900">{location.topCountries[0].sessions}</p>
                                                <p className="text-xs text-gray-500">sessions</p>
                                            </div>
                                        </div>
                                    )
                                }
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Session Duration Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {durations.map((item, idx) => (
                            <div
                                key={idx}
                                className={`text-center p-4 bg-${item.color}-50 rounded-lg`}
                            >
                                <Clock className={`h-8 w-8 text-${item.color}-600 mx-auto mb-2`} />
                                <div className={`text-lg font-bold text-${item.color}-600`}>
                                    {item.range}
                                </div>
                                <div className="text-xs text-gray-500">{item.label}</div>
                                <div className="text-sm font-medium text-gray-900 mt-1">
                                    {item.value} sessions
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "session",
        action: "view",
    });
    const durationStats = await getSessionDurationStats()
    const topCountries = await getTopCountriesPerModel()
    const metrics = await getDashboardMetrics();
    return json({ durationStats, topCountries, metrics });
}
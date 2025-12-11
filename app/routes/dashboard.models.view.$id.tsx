import { json, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"

// components
import { Badge } from "~/components/ui/badge"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import Breadcrumb from "~/components/ui/bread-crumb"
import { Separator } from "~/components/ui/separator"
import { Card, CardContent } from "~/components/ui/card"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
    Star,
    Calendar,
    Eye,
    MessageCircle,
    Heart,
    TrendingUp,
    Users,
    Clock,
    User,
    Phone,
    Video,
    ArrowLeft,
} from "lucide-react"

// utils and service
import { getAvailableStatusColor } from "~/utils"
import { getModel } from "~/services/model.server"
import { useAuthStore } from "~/store/permissionStore"
import { IEntityLogs, IModels } from "~/interfaces/model"
import { getAuditLogsByEntity } from "~/services/log.server"
import { calculateAgeFromDOB, capitalizeFirstLetter, timeAgo } from "~/utils"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

interface LoaderData {
    model: IModels;
    modelLogs: IEntityLogs[];
}

export default function ModelDetailsModal() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { model, modelLogs } = useLoaderData<LoaderData>();

    const totalEarnings = "$12,450"
    const monthlyEarnings = "$3,200"
    const activeChats = 5
    const totalViews = "45.2k"

    const stats = [
        { label: "Total Views", value: totalViews, icon: Eye, color: "text-blue-600" },
        { label: "Active Chats", value: activeChats.toString(), icon: MessageCircle, color: "text-green-600" },
    ]

    const earnings = [
        { period: "Today", amount: "$245", change: "+12%" },
        { period: "This Week", amount: "$1,680", change: "+8%" },
        { period: "This Month", amount: monthlyEarnings, change: "+15%" },
        { period: "All Time", amount: totalEarnings, change: "+25%" },
    ]

    function closeHandler() {
        navigate("..");
    }

    const canView = hasPermission("model", "view");
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
        <div className="space-y-6 bg-white p-4 rounded-md">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-black text-md font-bold mb-2">Model Details</h3>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Models Management", value: "/dashboard/models" },
                            { label: "Model Details", value: "/models/view/id" },
                        ]}
                    />
                </div>
                <Button className="hidden sm:flex bg-white border hover:opacity-90 text-gray-500 hover:text-white" onClick={closeHandler}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
            </div>
            <div className="flex items-start space-x-4 space-y-2">
                <div className="relative">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={model.profile ?? ""} alt={"profile"} />
                        <AvatarFallback className="text-lg">{model.firstName.charAt(0)}{model?.lastName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div
                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getAvailableStatusColor(model.available_status)}`}
                    ></div>
                </div>
                <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                        <h2 className="text-md sm:text-lg font-semibold text-gray-900">{model.firstName}&nbsp;{model.lastName}</h2>
                        <Badge variant="default" className="text-xs">
                            {capitalizeFirstLetter(model.status)}
                        </Badge>
                        <Badge variant="default" className="text-xs">
                            {capitalizeFirstLetter(model.available_status)}
                        </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{model.gender}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{calculateAgeFromDOB(model.dob)} years old</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>
                            {model.rating}/5 &nbsp; ({model.total_review} reviews)
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                        Member since {model.createdAt ? new Date(model.createdAt).toLocaleDateString() : "Unknown"}
                    </p>
                </div>
            </div>
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="earnings">Earnings</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {stats.map((stat, index) => (
                            <Card key={index} className="border-0 shadow-md">
                                <CardContent className="p-4 text-center">
                                    <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                                    <p className="text-xs text-gray-500">{stat.label}</p>
                                </CardContent>
                            </Card>
                        ))}
                        <Card className="border-0 shadow-md">
                            <CardContent className="p-4 text-center">
                                <Star className={`h-6 w-6 mx-auto mb-2 text-yellow-600`} />
                                <p className="text-lg font-bold text-gray-900">{model.rating}</p>
                                <p className="text-xs text-gray-500">Rating</p>
                            </CardContent>
                        </Card>
                        <Card className="border-0 shadow-md">
                            <CardContent className="p-4 text-center">
                                <Users className={`h-6 w-6 mx-auto mb-2 text-purple-600`} />
                                <p className="text-lg font-bold text-gray-900">{model.total_review}</p>
                                <p className="text-xs text-gray-500">Total review</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border-0 shadow-md">
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Profile Information</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Full Name:</span>
                                        <span className="text-gray-900">{model.firstName}&nbsp;{model.lastName}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Username:</span>
                                        <span className="text-gray-900">{model.username}</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Gender:</span>
                                        <span className="text-gray-900 capitalize">{model.gender}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Age: </span>
                                        <span className="text-gray-900">{calculateAgeFromDOB(model.dob)} years</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Status:</span>
                                        <Badge variant="default" className={`text-xs ${model.status === "active" ? "bg-green-500" : model.status === "suspended" ? "bg-yellow-500" : ""}`}>
                                            {capitalizeFirstLetter(model.status)}
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-md">
                            <CardContent className="p-4">
                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Rates & Performance</h3>
                                <div className="space-y-2 text-sm">
                                    {model.ModelService && model.ModelService.map((service) => {
                                        return (
                                            <div key={service.id} className="flex justify-between">
                                                <span className="text-gray-500">{service.service?.name}:</span>
                                                <span className="text-green-600 font-semibold">${service.customRate ? service.customRate : service.service?.baseRate} / minute</span>
                                            </div>
                                        )
                                    })}
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Rating:</span>
                                        <span className="text-yellow-600 font-semibold">{model.rating}/5</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Total Reviews:</span>
                                        <span className="text-gray-900">{model.total_review}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Availability:</span>
                                        <Badge
                                            variant="default"
                                            className={`text-xs ${model.available_status === "online"
                                                ? "bg-green-500"
                                                : model.available_status === "busy"
                                                    ? "bg-yellow-500"
                                                    : model.available_status === "offline"
                                                        ? "bg-gray-500"
                                                        : ""
                                                }`}
                                        >
                                            {capitalizeFirstLetter(model.available_status)}
                                        </Badge>

                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>


                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4 space-y-4">
                            <div>
                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Address:</h3>
                                <p className="text-sm text-gray-700">{model.address}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Bio:</h3>
                                <p className="text-sm text-gray-700">{model.bio}</p>
                            </div>
                        </CardContent>
                    </Card>

                </TabsContent>

                <TabsContent value="earnings" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {earnings.map((earning, index) => (
                            <Card key={index} className="border-0 shadow-md">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500">{earning.period}</p>
                                            <p className="text-xl font-bold text-gray-900">{earning.amount}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="default" className="text-xs">
                                                {earning.change}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-sm text-gray-900 mb-3">Earnings Breakdown</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Video className="h-4 w-4 text-purple-600" />
                                        <span className="text-sm text-gray-600">Video Calls</span>
                                    </div>
                                    <span className="text-sm font-semibold text-green-600">$1,245 (45%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Phone className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm text-gray-600">Voice Calls</span>
                                    </div>
                                    <span className="text-sm font-semibold text-green-600">$890 (32%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <MessageCircle className="h-4 w-4 text-green-600" />
                                        <span className="text-sm text-gray-600">Chat Messages</span>
                                    </div>
                                    <span className="text-sm font-semibold text-green-600">$634 (23%)</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent Activity</h3>
                            <div className="space-y-3">
                                {modelLogs && modelLogs.length > 0 ? modelLogs.map((activity) => (
                                    <div
                                        key={activity.id}
                                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                                    >
                                        <div>
                                            <p className="text-sm text-gray-900">{activity.id}</p>
                                            <p className="text-xs text-gray-900">{activity.action}</p>
                                            <p className="text-xs text-gray-500">{activity.description}</p>
                                            <div className="block sm:block">
                                                <p className="text-xs text-gray-500">Status: {activity.status}</p>
                                                <p className="text-xs text-gray-500">Created At: {activity.createdAt}</p>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-start justify-start flex-col gap-1">
                                            <Badge variant="outline" className={`text-xs ${activity.status === "success" ? "text-green-600" : "text-red-600"}`}>
                                                {capitalizeFirstLetter(activity.status)}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs text-green-600">
                                                {timeAgo(activity.createdAt)}
                                            </Badge>
                                        </div>
                                    </div>
                                )) : <EmptyPage title="This model has no logs yet!" description="This model just register account, that's why no logs." />}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-sm text-gray-900 mb-3">Account Actions</h3>
                            <div className="space-y-3">
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Send Message
                                </Button>
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <Heart className="h-4 w-4 mr-2" />
                                    Feature Profile
                                </Button>
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <TrendingUp className="h-4 w-4 mr-2" />
                                    Boost Visibility
                                </Button>
                                <Separator />
                                <Button variant="outline" className="w-full justify-start text-yellow-600 bg-transparent">
                                    <Clock className="h-4 w-4 mr-2" />
                                    Suspend Account
                                </Button>
                                <Button variant="outline" className="w-full justify-start text-red-600 bg-transparent">
                                    <Users className="h-4 w-4 mr-2" />
                                    Delete Profile
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "model",
        action: "view",
    });
    const modelId = params.id;
    try {
        const [model, modelLogs] = await Promise.all([
            getModel(params.id!),
            getAuditLogsByEntity({ modelId, limit: 20 })
        ])
        return json({ model, modelLogs: modelLogs.logs });

    } catch (error) {
        console.log("LOAD_MODEL_DATA_OR_LOGS_FAILED", error)
        throw new Error("Failed to fetch model data or logs");
    }
}
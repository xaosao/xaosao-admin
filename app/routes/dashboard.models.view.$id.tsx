import { useCallback, useEffect, useState } from "react"
import { json, LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"

// components
import { Badge } from "~/components/ui/badge"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import Breadcrumb from "~/components/ui/bread-crumb"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import {
    Star,
    Calendar,
    User,
    Users,
    Phone,
    ArrowLeft,
    MapPin,
    Mail,
    Bell,
    MessageSquare,
    Globe,
    Palette,
    Shield,
    UserCheck,
    UserX,
    Clock,
    Briefcase,
    GraduationCap,
    Heart,
    Share2,
    Gift,
    Check,
    X,
    Activity,
} from "lucide-react"

// utils and service
import { formatDate, getAvailableStatusColor } from "~/utils"
import { getModel } from "~/services/model.server"
import { useAuthStore } from "~/store/permissionStore"
import { IEntityLogs, IModels } from "~/interfaces/model"
import { getAuditLogsByEntity } from "~/services/log.server"
import { calculateAgeFromDOB, capitalizeFirstLetter, timeAgo } from "~/utils"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

function getServicePrice(ms: any): string {
    const svc = ms.service;
    if (!svc) return "0";
    switch (svc.billingType) {
        case "per_hour":
            return `${(ms.customHourlyRate ?? ms.customRate ?? svc.hourlyRate ?? svc.baseRate ?? 0).toLocaleString()}/hr`;
        case "per_session":
            return `${(ms.customOneTimePrice ?? ms.customRate ?? svc.oneTimePrice ?? svc.baseRate ?? 0).toLocaleString()}`;
        case "per_minute":
            return `${(ms.customMinuteRate ?? ms.customRate ?? svc.minuteRate ?? svc.baseRate ?? 0).toLocaleString()}/min`;
        case "per_day":
        default:
            return `${(ms.customRate ?? svc.baseRate ?? 0).toLocaleString()}/day`;
    }
}

interface ReferredUser {
    id: string;
    profile: string | null;
    firstName: string;
    lastName: string | null;
    dob: string;
    address?: string | null;
    country?: string | null;
}

interface LoaderData {
    model: IModels & { referredModelsCount: number; referredCustomersCount: number };
    modelLogs: IEntityLogs[];
}

export default function ModelDetailsModal() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { model, modelLogs } = useLoaderData<LoaderData>();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Referral modal state
    const [referralModal, setReferralModal] = useState<{ open: boolean; type: "models" | "customers" }>({ open: false, type: "models" });
    const [referralUsers, setReferralUsers] = useState<ReferredUser[]>([]);
    const [referralLoading, setReferralLoading] = useState(false);

    const openReferralModal = useCallback(async (type: "models" | "customers") => {
        setReferralModal({ open: true, type });
        setReferralLoading(true);
        try {
            const res = await fetch(`/api/models/${model.id}/referrals?type=${type}`);
            const data = await res.json();
            setReferralUsers(type === "models" ? data.referredModels : data.referredCustomers);
        } catch {
            setReferralUsers([]);
        } finally {
            setReferralLoading(false);
        }
    }, [model.id]);

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

    // Get status badge style
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return "bg-orange-100 text-orange-700 border-orange-200";
            case "verified":
                return "bg-blue-100 text-blue-700 border-blue-200";
            case "active":
                return "bg-green-100 text-green-700 border-green-200";
            case "inactive":
                return "bg-red-100 text-red-700 border-red-200";
            case "suspended":
                return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "deleted":
                return "bg-gray-100 text-gray-700 border-gray-200";
            default:
                return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const getAvailabilityBadge = (status: string) => {
        switch (status) {
            case "online":
                return "bg-green-100 text-green-700 border-green-200";
            case "busy":
                return "bg-yellow-100 text-yellow-700 border-yellow-200";
            case "offline":
                return "bg-gray-100 text-gray-700 border-gray-200";
            default:
                return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    return (
        <div className="space-y-4 bg-white p-4 rounded-md">
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
          
            <Card className="border rounded-md">
                <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                        <div className="relative">
                            <div
                                className="cursor-pointer"
                                onClick={() => model.profile && setSelectedImage(model.profile)}
                            >
                                <Avatar className="h-20 w-20 hover:ring-2 hover:ring-pink-300 transition-all">
                                    <AvatarImage src={model.profile ?? ""} alt={"profile"} />
                                    <AvatarFallback className="text-lg">{model.firstName?.charAt(0)}{model?.lastName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </div>
                            <div
                                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getAvailableStatusColor(model.available_status)}`}
                            ></div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-2">
                                <h2 className="text-md sm:text-lg font-semibold text-gray-900">{model.firstName}&nbsp;{model.lastName}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getStatusBadge(model.status)}`}>
                                    {model.status}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getAvailabilityBadge(model.available_status)}`}>
                                    {model.available_status}
                                </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    <span className="capitalize">{model.gender}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>{calculateAgeFromDOB(model.dob)} years old</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-500" />
                                    <span>{model.rating}/5 ({model.total_review} reviews)</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                Member since {model.createdAt ? new Date(model.createdAt).toLocaleDateString() : "Unknown"}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border rounded-md lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Personal Information & Bio
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Full Name:</span>
                                    <span className="text-gray-900">{model.firstName} {model.lastName ?? ""}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Username:</span>
                                    <span className="text-gray-900">@{model.username}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Gender:</span>
                                    <span className="text-gray-900 capitalize">{model.gender}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Date of Birth:</span>
                                    <span className="text-gray-900">{formatDate(model.dob)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Age:</span>
                                    <span className="text-gray-900">{calculateAgeFromDOB(model.dob)} years</span>
                                </div>
                                {model.relationshipStatus && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 flex items-center gap-1"><Heart className="h-3 w-3" /> Relationship:</span>
                                        <span className="text-gray-900 capitalize">{model.relationshipStatus}</span>
                                    </div>
                                )}
                                {model.career && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 flex items-center gap-1"><Briefcase className="h-3 w-3" /> Career:</span>
                                        <span className="text-gray-900">{model.career}</span>
                                    </div>
                                )}
                                {model.education && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Education:</span>
                                        <span className="text-gray-900">{model.education}</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-500 block mb-1">Bio:</span>
                                    <p className="text-gray-900">{model.bio || "No bio provided"}</p>
                                </div>
                                {model.interests && Array.isArray(model.interests) && model.interests.length > 0 && (
                                    <div>
                                        <span className="text-gray-500 block mb-1">Interests:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {model.interests.map((interest: string, index: number) => (
                                                <Badge key={index} variant="outline" className="text-xs">
                                                    {interest}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact & Location */}
                <Card className="border rounded-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Contact & Location
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp:</span>
                            <span className="text-gray-900">{model.whatsapp ?? "Not provided"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Address:</span>
                            <span className="text-gray-900 text-right max-w-[200px]">{model.address ?? "Not provided"}</span>
                        </div>
                        {model.latitude && model.longitude && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Coordinates:</span>
                                <span className="text-gray-900 text-xs">{model.latitude?.toFixed(4)}, {model.longitude?.toFixed(4)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
               
                <Card className="border rounded-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Rates & Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {model.hourly_rate_talking && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Talking Rate:</span>
                                <span className="text-green-600 font-semibold">${model.hourly_rate_talking}/hr</span>
                            </div>
                        )}
                        {model.hourly_rate_video && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Video Rate:</span>
                                <span className="text-green-600 font-semibold">${model.hourly_rate_video}/hr</span>
                            </div>
                        )}
                        {model.ModelService && model.ModelService.length > 0 && (
                            <>
                                <div className="text-gray-500 text-xs mt-2">Services:</div>
                                {model.ModelService.map((service: any) => (
                                    <div key={service.id} className="flex justify-between">
                                        <span className="text-gray-500">{service.service?.name}:</span>
                                        <span className="text-green-600 font-semibold">
                                            {getServicePrice(service)}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                        <div className="flex justify-between pt-2 border-t">
                            <span className="text-gray-500">Rating:</span>
                            <span className="text-yellow-600 font-semibold flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current" />
                                {model.rating}/5
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Total Reviews:</span>
                            <span className="text-gray-900">{model.total_review}</span>
                        </div>
                    </CardContent>
                </Card>
               
                <Card className="border rounded-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Account Settings & Referral
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 flex items-center gap-1"><Globe className="h-3 w-3" /> Language:</span>
                            <span className="text-gray-900 uppercase">{model.defaultLanguage ?? "EN"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 flex items-center gap-1"><Palette className="h-3 w-3" /> Theme:</span>
                            <span className="text-gray-900 capitalize">{model.defaultTheme ?? "Light"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 flex items-center gap-1"><Shield className="h-3 w-3" /> 2FA Enabled:</span>
                            {model.twofactorEnabled ? (
                                <Check className="h-4 w-4 text-green-600" />
                            ) : (
                                <X className="h-4 w-4 text-gray-400" />
                            )}
                        </div>
                        <div className="pt-2 border-t">
                            <span className="text-gray-500 text-xs block mb-2">Notification Preferences:</span>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant={model.sendMailNoti ? "default" : "outline"} className="text-xs flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> Email {model.sendMailNoti ? "On" : "Off"}
                                </Badge>
                                <Badge variant={model.sendSMSNoti ? "default" : "outline"} className="text-xs flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" /> SMS {model.sendSMSNoti ? "On" : "Off"}
                                </Badge>
                                <Badge variant={model.sendPushNoti ? "default" : "outline"} className="text-xs flex items-center gap-1">
                                    <Bell className="h-3 w-3" /> Push {model.sendPushNoti ? "On" : "Off"}
                                </Badge>
                            </div>
                        </div>
                        <div className="pt-2 border-t space-y-2">
                            <span className="text-gray-500 text-xs block">Registration & Referral:</span>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> Registration:</span>
                                {model.referredBy ? (
                                    <Badge className="bg-purple-100 text-purple-700 text-xs">Via Referral</Badge>
                                ) : (
                                    <Badge className="bg-blue-100 text-blue-700 text-xs">Self-Registered</Badge>
                                )}
                            </div>
                            {model.referredBy && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1"><Gift className="h-3 w-3" /> Referred By:</span>
                                    <span className="text-purple-700 font-medium">
                                        {model.referredBy.firstName} {model.referredBy.lastName ?? ""}
                                        <span className="text-gray-400 text-xs ml-1">(@{model.referredBy.username})</span>
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500 flex items-center gap-1"><Share2 className="h-3 w-3" /> Referral Code:</span>
                                <span className="text-gray-900 font-mono">{model.referralCode ?? "Not generated"}</span>
                            </div>
                            {model.referredBy && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1"><Gift className="h-3 w-3" /> Reward Paid:</span>
                                    {model.referralRewardPaid ? (
                                        <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Pending</Badge>
                                    )}
                                </div>
                            )}
                            <div className="pt-2 border-t space-y-2">
                                <span className="text-gray-500 text-xs block">Referral Stats:</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" /> Referred Models:</span>
                                    {model.referredModelsCount > 0 ? (
                                        <button
                                            onClick={() => openReferralModal("models")}
                                            className="text-blue-600 font-semibold hover:underline cursor-pointer"
                                        >
                                            {model.referredModelsCount}
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 flex items-center gap-1"><Users className="h-3 w-3" /> Referred Customers:</span>
                                    {model.referredCustomersCount > 0 ? (
                                        <button
                                            onClick={() => openReferralModal("customers")}
                                            className="text-blue-600 font-semibold hover:underline cursor-pointer"
                                        >
                                            {model.referredCustomersCount}
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
               
                <Card className="border rounded-md">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Account Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Status:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getStatusBadge(model.status)}`}>
                                {model.status}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Availability:</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs border capitalize ${getAvailabilityBadge(model.available_status)}`}>
                                {model.available_status}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Created At:</span>
                            <span className="text-gray-900">{formatDate(model.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="text-gray-900">{model.updatedAt ? formatDate(model.updatedAt) : "N/A"}</span>
                        </div>
                        {model.createdBy && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> Created By:</span>
                                <span className="text-gray-900">{model.createdBy.firstName} {model.createdBy.lastName}</span>
                            </div>
                        )}
                        {model.approveBy && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 flex items-center gap-1"><UserCheck className="h-3 w-3" /> Approved By:</span>
                                <span className="text-green-600">{model.approveBy.firstName} {model.approveBy.lastName}</span>
                            </div>
                        )}
                        {model.rejectedBy && (
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 flex items-center gap-1"><UserX className="h-3 w-3" /> Rejected By:</span>
                                <span className="text-red-600">{model.rejectedBy.firstName} {model.rejectedBy.lastName}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
           
            <Card className="border rounded-md">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {modelLogs && modelLogs.length > 0 ? modelLogs.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                            >
                                <div>
                                    <p className="text-sm text-gray-900">{activity.action}</p>
                                    <p className="text-xs text-gray-500">{activity.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-xs ${activity.status === "success" ? "text-green-600" : "text-red-600"}`}>
                                        {capitalizeFirstLetter(activity.status)}
                                    </Badge>
                                    <span className="text-xs text-gray-400">{timeAgo(activity.createdAt)}</span>
                                </div>
                            </div>
                        )) : (
                            <EmptyPage title="No activity logs" description="This model has no activity logs yet." />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Referral Detail Modal */}
            {referralModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setReferralModal({ ...referralModal, open: false })}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-sm font-semibold">
                                {referralModal.type === "models" ? "Referred Models" : "Referred Customers"} ({referralUsers.length})
                            </h3>
                            <button onClick={() => setReferralModal({ ...referralModal, open: false })} className="p-1 hover:bg-gray-100 rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="overflow-auto max-h-[calc(80vh-60px)]">
                            {referralLoading ? (
                                <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                            ) : referralUsers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No referrals found</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Profile</TableHead>
                                            <TableHead className="text-xs">Full Name</TableHead>
                                            <TableHead className="text-xs">Age</TableHead>
                                            <TableHead className="text-xs">{referralModal.type === "models" ? "Address" : "Country"}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {referralUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={user.profile ?? ""} />
                                                        <AvatarFallback className="text-xs">{user.firstName?.charAt(0)}{user.lastName?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell className="text-sm">{user.firstName} {user.lastName ?? ""}</TableCell>
                                                <TableCell className="text-sm">{user.dob ? calculateAgeFromDOB(user.dob) : "-"}</TableCell>
                                                <TableCell className="text-sm">{referralModal.type === "models" ? (user.address ?? "-") : (user.country ?? "-")}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen Image Preview Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="h-6 w-6 text-white" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Profile preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
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

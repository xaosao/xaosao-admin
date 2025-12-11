import React from "react";
import { toast } from "react-toastify";
import { LoaderCircle, Save, ShieldCheck, UserCheck, X } from "lucide-react";
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigate, useNavigation, useParams } from "@remix-run/react";

// components
import Modal from "~/components/ui/modal";
import { Badge } from "~/components/ui/badge";
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import Password from "~/components/ui/password-textfield";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

// backend
import { IEntityLogs } from "~/interfaces/model";
import { getPermissions, getRoleWithPermissions } from "~/services/role.server";
import { capitalizeFirstLetter, formatDate1, getAvailableStatusColor, timeAgo } from "~/utils";

// service and interfaces
import { useAuthStore } from "~/store/permissionStore";
import { IAdminResponse, IPermission } from "~/interfaces";
import { getAuditLogsByEntity } from "~/services/log.server";
import { getAdmin, updateAdminPassword } from "~/services/admin.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

interface LoaderData {
    admin: IAdminResponse;
    permissions: IPermission[],
    rolePermissions: {
        id: string
        permissionId: string
        permission: IPermission[]
    }[],
    success: string;
    name: string;
    adminLogs: IEntityLogs[];
}

export default function AdminDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { admin, permissions, rolePermissions, success, name, adminLogs } = useLoaderData<LoaderData>();

    const assignedIds = new Set(rolePermissions.map(p => p.permissionId));
    const groupedPermissions = permissions.reduce((acc, permission) => {
        if (permission.status === "active") {
            if (!acc[permission.groupName]) acc[permission.groupName] = []
            acc[permission.groupName].push(permission)
        }
        return acc
    }, {} as Record<string, IPermission[]>)

    const groupNames = Object.keys(groupedPermissions)
    const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "PATCH"

    function closeHandler() {
        navigate("..");
    }

    React.useEffect(() => {
        if (success) {
            toast.success(success);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");
            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canView = hasPermission("admin", "view");
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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <div className="ml-4">
                <h1 className="text-lg font-bold">Administrator Details</h1>
                <p className="text-sm text-gray-500">Complete profile and activity information</p>
            </div>
            <div className="space-y-2 mt-4">
                <Card>
                    <CardContent className="space-y-4 flex flex-col md:flex-row items-start justify-between">
                        <div className="space-y-6 w-full">
                            <div className="flex items-start justify-start space-x-1 sm:space-x-4">
                                <div className="relative">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={admin?.profile ?? ""} alt={"profile"} />
                                        <AvatarFallback className="text-lg">{admin?.firstName}</AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getAvailableStatusColor(admin?.status ?? "active")}`}
                                    ></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <h2 className="text-xl font-semibold text-gray-900">{admin?.firstName}&nbsp;{admin?.lastName}</h2>
                                        <Badge variant="default" className="text-xs">
                                            {capitalizeFirstLetter(admin?.status ?? "active")}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                                        <div className="flex items-center space-x-1">
                                            <UserCheck className="h-4 w-4" />
                                            <span>{admin?.gender}</span>&nbsp; • Number: {admin?.number} - Member since: {admin?.createdAt ? new Date(admin?.createdAt).toLocaleDateString() : "Unknown"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="activity">Activity</TabsTrigger>
                                    <TabsTrigger value="security">Security</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="border-0 shadow-md">
                                            <CardContent className="p-4">
                                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Personal Information:</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Full Name:</span>
                                                        <span className="text-gray-900">
                                                            {admin?.firstName} {admin?.lastName}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Gender:</span>
                                                        <span className="text-gray-900 capitalize">{admin?.gender}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Phone:</span>
                                                        <span className="text-gray-900">{admin?.tel}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Address:</span>
                                                        <span className="text-gray-900 text-right max-w-[150px] truncate">{admin?.address}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-0 shadow-md">
                                            <CardContent className="p-4">
                                                <h3 className="font-semibold text-sm text-gray-900 mb-3">Account Information:</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Username:</span>
                                                        <span className="text-gray-900">@{admin?.username}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Role:</span>
                                                        <Badge variant={admin?.status === "active" ? "default" : "secondary"} className="text-xs">
                                                            {capitalizeFirstLetter(admin?.role.name)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Status:</span>
                                                        <Badge variant={admin?.status === "active" ? "default" : "secondary"} className="text-xs">
                                                            {capitalizeFirstLetter(admin?.status)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Created:</span>
                                                        <span className="text-gray-900">{formatDate1(admin?.createdAt ?? "")}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <div className="w-full grid grid-cols-1 gap-4 px-0 sm:px-4">
                                        <div className="w-full space-y-2 mt-2">
                                            <div className="flex items-center justify-start border-b pb-2 gap-4">
                                                <h3 className="text-sm font-semibold">Admin role:</h3>
                                                <Badge variant="default" className="text-xs">
                                                    {capitalizeFirstLetter(name)}
                                                </Badge>
                                            </div>
                                            {groupNames.length > 0 ? (
                                                <div className="grid grid-cols-2 md:grid-cols-4">
                                                    {groupNames.map(groupName => {
                                                        const groupPermissions = groupedPermissions[groupName]
                                                        return (
                                                            <Card key={groupName} className="text-gray-500 py-2 px-2">
                                                                <CardHeader className="p-1">
                                                                    <CardTitle className="text-sm text-black font-bold">
                                                                        {capitalizeFirstLetter(groupName)}
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className="p-2 flex flex-col gap-2.5 text-xs">
                                                                    {groupPermissions.map(permission => (
                                                                        <div
                                                                            key={permission.id}
                                                                            className="flex items-center justify-start space-x-2"
                                                                        >
                                                                            <Checkbox
                                                                                id={permission.id}
                                                                                name="permissions"
                                                                                value={permission.id}
                                                                                defaultChecked={assignedIds.has(permission.id)}
                                                                                disabled
                                                                            />
                                                                            <div className="flex-1 min-w-0 font-normal">
                                                                                <label htmlFor={permission.id} className="text-sm cursor-pointer">
                                                                                    {capitalizeFirstLetter(permission.name)}
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center text-gray-500 py-4">No permissions available</div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="activity" className="space-y-4">
                                    <Card className="border-0 shadow-md">
                                        <CardContent className="p-4">
                                            <h3 className="font-semibold text-sm text-gray-900 mb-3">Recent Activity</h3>
                                            <div className="space-y-3">
                                                {adminLogs && adminLogs.length > 0 ? adminLogs.map((activity, index: number) => (
                                                    <div
                                                        key={activity.id}
                                                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                                                    >
                                                        <div>
                                                            <p className="text-sm text-gray-900">{index + 1}.&nbsp;{activity.id}</p>
                                                            <p className="text-xs text-gray-900">{activity.action}</p>
                                                            <p className="text-xs text-gray-500">{activity.description}</p>
                                                        </div>
                                                        <div className="flex items-start justify-start flex-col gap-1">
                                                            <Badge variant="outline" className={`text-xs ${activity.status === "success" ? "text-green-600" : "text-red-600"}`}>
                                                                {capitalizeFirstLetter(activity.status)}
                                                            </Badge>
                                                            <Badge variant="outline" className="text-xs text-green-600">
                                                                {timeAgo(activity.createdAt)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )) : <EmptyPage title="This admin has no action yet!" description="This admin just register account, that's why no logs!" />}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="security" className="space-y-4">
                                    <Form method="patch" encType="multipart/form-data">
                                        <Card className="border-0 shadow-md">
                                            <CardContent className="p-4 flex flex-col gap-3">
                                                <h3 className="text-gray-500 text-md font-bold">Reset admin password:</h3>
                                                <Password
                                                    required
                                                    id="password"
                                                    name="password"
                                                    title="New Password"
                                                    color="text-gray-500"
                                                    placeholder="Enter new password..."
                                                />
                                                <div>
                                                    <p className="text-xs text-orange-500">Password must contain at least one uppercase letter, one number, and one special character.</p>
                                                </div>
                                                <div className="w-32">
                                                    <Button type="submit" variant="outline" className="bg-gray-100 text-black hover:text-black">
                                                        {isSubmitting ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        {isSubmitting ? "Saving..." : "Save Change"}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Form>
                                    <Card className="border-0 shadow-md">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-center gap-2 flex-col">
                                                <h3 className="text-gray-500 text-md font-bold">Two-stap verfication:</h3>
                                                <p className="text-gray-500 text-sm ml-2">Two-factor authentication is not enabled yet</p>
                                                <p className="text-gray-500 text-sm ml-2">Two-factor authentication adds a layer of security to your account by requiring more than just a password to log in</p>
                                            </div>
                                            <div className="mt-4">
                                                <Button type="button" variant="outline" className={`${admin.is2FAEnabled ? "bg-dark-pink text-white hover:text-white" : "bg-gray-200 text-black hover:text-black"} `}>
                                                    <Link to={`/dashboard/admins/2fa/${id}`} className="flex items-center justify-start gap-2">
                                                        <ShieldCheck className="w-4 h-4" />
                                                        {admin.is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="mt-4 text-right">
                <Button type="button" variant="outline" onClick={closeHandler} className="border rounded bg-white text-gray-800 hover:bg-white hover:text-gray-800">
                    <X className="w-4 h-4" />
                    Close
                </Button>
            </div>
        </Modal>
    );
}

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "view",
    });
    const adminId = params.id;
    const url = new URL(request.url);
    const success = url.searchParams.get("success");

    if (!adminId) {
        throw new Response("Admin ID is required", { status: 400 });
    }
    try {
        const admin = await getAdmin(adminId);
        const permissions = await getPermissions();
        const role = await getRoleWithPermissions(admin?.role.id as string);
        const adminLogs = await getAuditLogsByEntity({ userId: adminId, limit: 20 });

        return json({
            admin,
            permissions,
            rolePermissions: role?.permissionRoles,
            success,
            name: role?.name,
            adminLogs: adminLogs.logs
        });
    } catch (error) {
        console.error("Failed to fetch data:", error);
        throw new Response("Failed to fetch data", { status: 500 });
    }
}

export async function action({ params, request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "admin",
        action: "view",
    });

    const adminId = params.id || "";
    if (!adminId) {
        return json({ error: "Invalid customer ID" });
    }
    const formData = await request.formData();
    const adminData = Object.fromEntries(formData);
    const password = adminData.password;

    if (request.method === "PATCH") {
        try {
            const res = await updateAdminPassword(adminId, password as string, userId);
            if (res.id) {
                return redirect(`/dashboard/admins/view/${adminId}?success=Update+admin+password+successfully`);
            }
        } catch (error: any) {
            console.error("CREATE_ADMIN_FAILED", error);

            if (error.fieldErrors) {
                return error.fieldErrors
            } else {
                return error;
            }
        }
    }

    return json({ error: "Invalid request method!" });
}
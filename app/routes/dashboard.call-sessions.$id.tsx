import { json } from "react-router"
import { LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useNavigate } from "@remix-run/react"
import { User, UserSearch, Calendar, Users, UserCheck, Star } from "lucide-react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

// utils and service
import { getAvailableStatusColor } from "~/utils"
import { Separator } from "~/components/ui/separator"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"
import { getCallSession } from "~/services/call.session.server"
import { calculateAgeFromDOB, capitalizeFirstLetter, formatDate } from "~/utils"
import StatusBadge from "~/components/ui/status-badge"
import { useAuthStore } from "~/store/permissionStore"
import { ForbiddenCard } from "~/components/ui/forbidden-card"

export default function CallSessionDetails() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const session = useLoaderData<typeof loader>();

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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5 p-4">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold">Transaction Details</h3>
                    <p className="text-gray-500 text-sm ml-2">Complete transaction information and processing history</p>
                </div>
                <div className="p-0">
                    <Card className="py-0 border rounded">
                        <CardHeader className="py-2">
                            <CardTitle className="text-md flex items-center">
                                <User className="h-5 w-5 mr-2" />
                                Customer and Model Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row items-center justify-between">
                                    <div className="flex items-start space-x-2">
                                        <div className="relative">
                                            <Avatar className="h-20 w-20">
                                                <AvatarImage src={session.customer.profile ?? ""} alt={"profile"} />
                                                <AvatarFallback className="text-lg">{session.customer.firstName} {session.model.lastName}</AvatarFallback>
                                            </Avatar>
                                            <div
                                                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getAvailableStatusColor(session.model.available_status)}`}
                                            ></div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-start gap-2 my-1">
                                                <Users className="h-4 w-4 text-gray-500" />
                                                <p className="text-md sm:text-xl font-semibold text-gray-900 -ml-1">{session.customer.firstName} {session.customer.lastName}</p>
                                                <StatusBadge status={session.customer.status} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 sm:mt-0 flex items-start justify-start space-x-4">
                                        <div className="relative">
                                            <Avatar className="h-20 w-20">
                                                <AvatarImage src={session.model.profile ?? ""} alt={"profile"} />
                                                <AvatarFallback className="text-lg">{session.model.firstName.charAt(0)} {session.model.lastName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div
                                                className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getAvailableStatusColor(session.model.available_status)}`}
                                            ></div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <h2 className="text-md sm:text-xl font-semibold text-gray-900">{session.model.firstName}&nbsp;{session.model.lastName}</h2>
                                                <StatusBadge status={session.model.status} />
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-x-4 text-sm text-gray-600">
                                                <div className="flex items-center space-x-1">
                                                    <UserCheck className="h-4 w-4" />
                                                    <span>{session.model.gender}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>{calculateAgeFromDOB(session.model.dob)} years old</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <Star className="h-4 w-4 text-yellow-500" />
                                                    <span>
                                                        {session.model.rating}/5 &nbsp; ({session.model.total_review} reviews)
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-2">
                                                {session.model.username && `${session.model.username} • `}
                                                Member since {session.model.createdAt ? new Date(session.model.createdAt).toLocaleDateString() : "Unknown"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md flex items-center">
                                <UserSearch className="h-5 w-5 mr-2" />
                                Session Information Overview:
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Session ID:</label>
                                        <p className="text-sm">{session.id}</p>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Session Start:</label>
                                        <p className="text-sm">{formatDate(session.sessionStart)}</p>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Session End:</label>
                                        <p className="text-sm">{formatDate(session.sessionEnd)}</p>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Duration:</label>
                                        <p className="text-sm font-medium text-green-600">{session.duration} minutes</p>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Rate / minute:</label>
                                        <strong className="text-sm">${session.rate_per_minute}</strong>
                                    </div>
                                    <Separator />
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Total Cost:</label>
                                        <strong className="text-sm">${session.total_cost}</strong>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Service:</label>
                                        <strong className="text-sm">{session.modelService.service.name}</strong>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Session Status:</label>
                                        <strong className="text-sm">{capitalizeFirstLetter(session.sessionStatus)}</strong>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Payment Status:</label>
                                        <strong className="text-sm">{capitalizeFirstLetter(session.paymentStatus)}</strong>
                                    </div>
                                    <Separator />
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Model Earning:</label>
                                        <strong className="text-sm">${session.total_cost - ((session.total_cost * session.modelService.service.commission) / 100)}</strong>
                                    </div>
                                    <div className="flex items-start justify-start gap-2">
                                        <label className="text-sm font-medium text-gray-500">Platform Fee ({session.modelService.service.commission}%):</label>
                                        <strong className="text-sm">${(session.total_cost * session.modelService.service.commission) / 100}</strong>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={closeHandler}>
                        Close
                    </Button>
                </div>
            </div >
        </Modal >

    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "session",
        action: "view",
    });
    const session = await getCallSession(params.id!);
    if (!session) {
        throw new Response("Session not found", { status: 404 });
    }
    return json(session);
}
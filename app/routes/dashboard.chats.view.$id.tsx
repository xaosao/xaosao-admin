import { Link, useLoaderData } from "@remix-run/react";
import { json, LoaderFunctionArgs } from "@remix-run/node";

// components
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Calendar, Clock, DollarSign, EyeIcon, MessageCircle, Star, UserCheck, Users } from "lucide-react";

// backend
import { formatDate } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { getConversation } from "~/services/conversaion.server";
import { IChatSessionResponse } from "~/interfaces/conversation";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

interface LoaderData {
    chat_sessions: IChatSessionResponse[];
}

export default function ConversationDetails() {
    const { chat_sessions } = useLoaderData<LoaderData>();
    const hasPermission = useAuthStore((state) => state.hasPermission);

    const canView = hasPermission("chat", "view");
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
        <>
            <h1 className="text-lg font-semibold text-gray-900 -mb-2">Chat Session Management</h1>
            <Breadcrumb
                items={[
                    { label: "Dashboard", value: "/dashboard" },
                    { label: "Conversation", value: "/chats" },
                    { label: "Chat Sessions", value: "/chats/view/id" },
                ]}
            />
            <div className="space-y-2 bg-white rounded-md shadow-md p-4">
                <div>
                    <h2>Chat sessions (5)</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                    <div className="lg:col-span-1 space-y-2 order-first lg:order-last">
                        <Card className="border rounded">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center">
                                    <Users className="h-4 w-4 mr-2" />
                                    Participants
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="flex items-center space-x-3 mb-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage
                                                src={chat_sessions[0]?.customer?.profile || ""}
                                                alt={chat_sessions[0]?.customer?.firstName || ""}
                                            />
                                            <AvatarFallback>{chat_sessions[0]?.customer?.firstName?.charAt(0)}{chat_sessions[0]?.customer?.lastName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-medium text-sm">{chat_sessions[0]?.customer?.firstName}&nbsp;{chat_sessions[0]?.customer?.lastName}</h3>
                                            <p className="flex items-start justify-start text-xs text-gray-500"><Users height={14} width={14} />&nbsp;Customer</p>
                                            <StatusBadge status={chat_sessions[0]?.customer?.status} />
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-xs pl-13">
                                        <p>
                                            <span className="text-gray-500">Whatsapp:</span> {chat_sessions[0]?.customer?.whatsapp}
                                        </p>
                                        <p>
                                            <span className="text-gray-500">Total Spent:</span>{" "}
                                            <span className="text-green-600 font-medium">$30</span>
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center space-x-3 mb-2">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={chat_sessions[0]?.model?.profile || ""} alt={chat_sessions[0]?.model?.firstName || ""} />
                                            <AvatarFallback>{chat_sessions[0]?.model?.firstName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-medium text-sm">{chat_sessions[0]?.model?.firstName}&nbsp;{chat_sessions[0]?.model?.lastName}</h3>
                                            <p className="flex items-start justify-start text-xs text-gray-500"><UserCheck height={14} width={14} />&nbsp;Model</p>
                                            <div className="flex items-center space-x-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-3 w-3 ${i < (chat_sessions[0]?.model?.rating || 0) ? "text-yellow-500 fill-current" : "text-gray-300"
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-xs pl-13">
                                        <p>
                                            <span className="text-gray-500">Whatsapp:</span> {chat_sessions[0]?.model?.whatsapp}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border rounded">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">Conversation Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            Started
                                        </span>
                                        <span>{formatDate(chat_sessions[0]?.conversation?.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <Clock className="h-3 w-3 mr-1" />
                                            Total Duration
                                        </span>
                                        <span>1 hours</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <MessageCircle className="h-3 w-3 mr-1" />
                                            Total Messages
                                        </span>
                                        <span>500</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Chat Sessions</span>
                                        <span>100</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            Total Revenue
                                        </span>
                                        <span className="font-medium text-green-600">$1000</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-3">
                        {chat_sessions && chat_sessions.length > 0 ? chat_sessions.map((chat: any) => (
                            <Card key={chat.id} className="overflow-y-auto border-0 shadow-md rounded-md border mb-2">
                                <CardContent className="space-y-4 flex-col md:flex-row items-start justify-between text-gray-500 text-sm p-4">
                                    <div className="w-full flex items-center justify-between">
                                        <div className="flex items-center justify-start gap-2">
                                            <MessageCircle />
                                            <p className="hidden sm:block">{chat.id}</p>
                                            <StatusBadge status="Completed" />
                                        </div>
                                        <div>
                                            <Button className="bg-white hover:bg-white text-dark-pink hover:text-dark-pink">
                                                <Link to={`/dashboard/chats/message/${chat.id}`} className="flex items-center justify-center gap-1 border rounded-md p-2">
                                                    <EyeIcon />
                                                    <span className="hidden sm:block">View Messages</span>
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="w-full flex flex-col md:flex-row gap-2 sm:gap-6">
                                        <div className="flex flex-row md:flex-col">
                                            <strong>Start Time:</strong>
                                            <p>{formatDate(chat.sessionStart)}</p>
                                        </div>
                                        <div className="flex flex-row md:flex-col">
                                            <strong>Duration:</strong>
                                            <p>{chat.duration}</p>
                                        </div>
                                        <div className="flex flex-row md:flex-col">
                                            <strong>Messages:</strong>
                                            <p>{chat._count?.messages || 0}</p>
                                        </div>
                                        <div className="flex flex-row md:flex-col">
                                            <strong>Revenue:</strong>
                                            <p>30$</p>
                                        </div>
                                    </div>
                                    <p className="text-sm">Last message: "{chat?.messages?.[0]?.messageText ?? ""}"</p>
                                </CardContent>
                            </Card>
                        )) : (
                            <EmptyPage
                                title="Nothing found!"
                                description="There is no chat sessions on database yet!"
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "chat",
        action: "view",
    });
    const conversaionId = params.id;
    if (!conversaionId) {
        throw new Response("Customer ID is required", { status: 400 });
    }
    try {
        const chat_sessions = await getConversation(conversaionId);
        return json({
            chat_sessions
        });

    } catch (error) {
        console.error("Failed to load conversation data:", error);
        throw new Response("Failed to load conversation data", { status: 500 });
    }
}
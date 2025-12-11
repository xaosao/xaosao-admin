import { useEffect, useRef, useState } from "react";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { ArrowLeft, CheckCheck, Clock, DollarSign, Phone, Star, UserCheck, Users } from "lucide-react";

import Modal from "~/components/ui/modal";
import EmptyPage from "~/components/ui/empty";
import StatusBadge from "~/components/ui/status-badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

import { formatDate } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { IChatMessageResponse, IMessageResponse } from "~/interfaces/conversation";
import { getChatSessionDetail, getChatSessionMessages } from "~/services/conversaion.server";

interface LoaderData {
    chat_session: IChatMessageResponse;
    messages: IMessageResponse[];
    totalCount: number;
}

export default function ChatDetails() {
    const navigate = useNavigate();
    const { chat_session, messages: initialMessages, totalCount } = useLoaderData<LoaderData>();

    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState(initialMessages || []);
    const [hasMore, setHasMore] = useState(initialMessages.length < totalCount);
    const hasPermission = useAuthStore((state) => state.hasPermission);

    const fetcher = useFetcher();
    const loaderRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (initialMessages) {
            setMessages(initialMessages);
            setHasMore(initialMessages.length < totalCount);
            setPage(1);
        }
    }, [initialMessages, totalCount]);

    useEffect(() => {
        const fetcherData = fetcher.data as { messages?: any[]; totalCount?: number };
        if (fetcherData?.messages && fetcher.state === "idle") {
            const newMessages = fetcherData.messages;

            if (newMessages.length > 0) {
                setMessages((prev) => {
                    const existingIds = new Set(prev.map(msg => msg.id));
                    const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
                    return [...prev, ...uniqueNewMessages];
                });
            }

            const requestedLimit = 10;
            setHasMore(newMessages.length === requestedLimit && (messages.length + newMessages.length) < totalCount);
            setIsLoading(false);
        }
    }, [fetcher.data, fetcher.state, messages.length, totalCount]);

    useEffect(() => {
        if (!loaderRef.current || !hasMore) return;

        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (
                    entry.isIntersecting &&
                    !isLoading &&
                    hasMore &&
                    fetcher.state === "idle"
                ) {
                    setIsLoading(true);
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetcher.load(`/dashboard/chats/message/${chat_session.id}?page=${nextPage}&showBy=10`);
                }
            },
            {
                root: null,
                rootMargin: "100px",
                threshold: 0.1
            }
        );

        observerRef.current.observe(loaderRef.current);

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [fetcher, page, totalCount, messages.length, hasMore, isLoading, chat_session.id]);

    function closeHandler() {
        navigate("..");
    }

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
        <Modal onClose={closeHandler} className="w-full h-full sm:w-11/12">
            <div className="space-y-2">
                <div className="flex items-center space-x-3 mb-4">
                    <ArrowLeft className="h-5 w-5 text-pink-600 cursor-pointer" onClick={() => navigate("/dashboard/chats/view/688dc0ba82f8df1bf5e28ef7")} />
                    <span>Chat Messages</span>
                    <div className="hidden sm:flex items-center justify-start space-x-2">
                        <p className="text-sm text-gray-500">Chat Status:</p>
                        <StatusBadge status={chat_session.sessionStatus} />
                    </div>
                    <div className="hidden sm:flex items-center justify-start space-x-2">
                        <p className="text-sm text-gray-500">Payment Status:</p>
                        <StatusBadge status={chat_session.paymentStatus} />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(90vh-120px)]">
                    <div className="lg:col-span-2">
                        <Card className="h-full rounded-md shadow-md">
                            <CardHeader className="border-b text-gray-500 p-0">
                                <CardTitle className="text-sm flex items-center justify-between p-2">
                                    <div className="flex items-center justify-start gap-4">
                                        Total messages: {chat_session._count.messages || 0} (Loaded: {messages.length})
                                    </div>
                                    <div className="flex items-center space-x-4 text-xs text-white">
                                        <span className="flex items-center">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {chat_session.duration}
                                        </span>
                                        <span className="flex items-center">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            {chat_session.totalCost}
                                        </span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 mt-2">
                                <ScrollArea className="h-[600px] px-4">
                                    <div className="space-y-4">
                                        {messages && messages.length > 0 ? messages.map((message: any, index) => (
                                            <div
                                                key={`${message.id}-${index}`}
                                                className={`flex ${message.senderType === "customer" ? "justify-start" : "justify-end"}`}
                                            >
                                                <div
                                                    className={`flex items-start space-x-2 max-w-[70%] ${message.senderType === "model" ? "flex-row-reverse space-x-reverse" : ""}`}
                                                >
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={message.senderInfo?.profile} />
                                                        <AvatarFallback className="text-xs">
                                                            {message.senderInfo?.firstName?.charAt(0) || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div
                                                        className={`rounded-lg p-3 ${message.senderType === "customer" ? "bg-gray-100" : "bg-pink-100"}`}
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            {message.messageType !== "text" && (
                                                                <span className="text-sm">{message.fileName}</span>
                                                            )}
                                                            <p className="text-sm">{message.messageText}</p>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-1">
                                                            <CheckCheck className={`${message.isRead ? "text-blue-500" : "text-gray-500"}`} height={14} width={14} />
                                                            <p className="text-xs text-gray-500">{formatDate(message.sendAt)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <EmptyPage
                                                title="No chat message was founded!"
                                                description="There is no chat message on database yet!"
                                            />
                                        )}

                                        {isLoading && (
                                            <div className="flex justify-center py-4">
                                                <div className="text-sm text-gray-500">Loading more messages...</div>
                                            </div>
                                        )}

                                        {hasMore && (
                                            <div ref={loaderRef} className="h-6 flex justify-center">
                                                <div className="text-xs text-gray-400">Scroll for more messages</div>
                                            </div>
                                        )}

                                        {!hasMore && messages.length > 0 && (
                                            <div className="flex justify-center py-4">
                                                <div className="text-xs text-gray-400">No more messages</div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4 hidden sm:block">
                        <Card className="border-t rounded shadow-md">
                            <CardHeader>
                                <CardTitle className="text-sm">Chat Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Conversation ID</span>
                                        <span className="font-mono">{chat_session.conversation?.id}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Chat ID</span>
                                        <span className="font-mono">{chat_session.id}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Started</span>
                                        <span>{formatDate(chat_session.sessionStart)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Ended</span>
                                        <span>{formatDate(chat_session.sessionEnd)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Duration</span>
                                        <span>{chat_session.duration}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Messages</span>
                                        <span>{chat_session._count?.messages || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Revenue</span>
                                        <span className="font-medium text-green-600">${chat_session.totalCost}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-t rounded shadow-md">
                            <CardContent className="space-y-3 mt-4">
                                <div className="flex items-center space-x-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={chat_session.customer?.profile ?? ""} alt={chat_session.customer?.firstName} />
                                        <AvatarFallback>{chat_session.customer?.firstName?.charAt(0) || "C"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-medium text-sm">{chat_session.customer?.firstName}&nbsp;{chat_session.customer?.lastName}</h3>
                                        <p className="flex items-start justify-start text-xs text-gray-500"><Users height={14} width={14} />&nbsp;Customer</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <Phone className="h-3 w-3 mr-1" />
                                            Whatsapp
                                        </span>
                                        <span>{chat_session.customer?.whatsapp}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            Status
                                        </span>
                                        <StatusBadge status={chat_session.customer?.status} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            Total Spent
                                        </span>
                                        <span className="font-medium text-red-600">- ${chat_session.totalCost}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-t rounded shadow-md">
                            <CardContent className="space-y-3 mt-4">
                                <div className="flex items-center space-x-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={chat_session?.model?.profile ?? ""} alt={chat_session.model?.firstName} />
                                        <AvatarFallback>{chat_session.model?.firstName?.charAt(0)}{chat_session.model?.lastName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-medium text-sm">{chat_session.model?.firstName}&nbsp; {chat_session.model?.lastName}</h3>
                                        <p className="flex items-start justify-start text-xs text-gray-500"><UserCheck height={14} width={14} />&nbsp;Model</p>
                                        <div className="flex items-center space-x-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`h-3 w-3 ${i < (chat_session?.model?.rating || 0) ? "text-yellow-500 fill-current" : "text-gray-300"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <Phone className="h-3 w-3 mr-1" />
                                            Whatsapp
                                        </span>
                                        <span>{chat_session.model?.whatsapp}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Response Time</span>
                                        <span>{chat_session.duration} mins</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500 flex items-center">
                                            <DollarSign className="h-3 w-3 mr-1" />
                                            Total Earnings
                                        </span>
                                        <span className="font-medium text-green-600">+ ${chat_session.totalCost}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "chat",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const chatSessionId = params.id;
    if (!chatSessionId) {
        throw new Response("Chat session ID is required", { status: 400 });
    }
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);
    try {
        const [chat_session, messagesResult] = await Promise.all([
            getChatSessionDetail(chatSessionId),
            getChatSessionMessages({ id: chatSessionId, page, limit: showBy })
        ])

        return json({
            chat_session,
            messages: messagesResult.messages || [],
            totalCount: messagesResult.totalCount || chat_session?._count?.messages || 0
        });

    } catch (error) {
        console.error("Failed to load chat session data:", error);
        throw new Response("Failed to load chat session data", { status: 500 });
    }
}
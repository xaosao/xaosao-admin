import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { Bot, MessageCircle, Search, UserCheck } from "lucide-react";

import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { useAuthStore } from "~/store/permissionStore";
import { getAssistantConversations } from "~/services/assistant.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { formatDate1 } from "~/utils";

export default function AssistantConversations() {
    const { conversations, pagination, filters } = useLoaderData<typeof loader>();
    const [, setSearchParams] = useSearchParams();
    const hasPermission = useAuthStore((s) => s.hasPermission);

    if (!hasPermission("chat", "view")) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This area requires additional permissions."
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900">AI assistant chats</h2>
                <p className="text-sm text-gray-500">
                    What customers asked the assistant for, and what it showed them.
                    Open one to send a model you picked yourself.
                </p>
            </div>

            <Form method="get" className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Search by customer name"
                        className="pl-9 text-sm"
                    />
                </div>
                <Button type="submit" variant="outline">Search</Button>
            </Form>

            {conversations.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-sm text-gray-500">
                        No assistant conversations yet. They appear here as soon as a
                        customer asks the assistant for someone.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {conversations.map((c) => (
                        <Link key={c.id} to={c.id}>
                            <Card className="transition-colors hover:border-rose-300">
                                <CardContent className="flex items-center gap-3 p-3">
                                    {c.customer?.profile ? (
                                        <img
                                            src={c.customer.profile}
                                            alt=""
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                                            <Bot className="h-4 w-4 text-gray-400" />
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {`${c.customer?.firstName ?? ""} ${c.customer?.lastName ?? ""}`.trim() || "Customer"}
                                        </p>
                                        <p className="truncate text-xs text-gray-500">
                                            {c.lastMessageText || "—"}
                                        </p>
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-[11px] text-gray-400">
                                            {formatDate1(c.lastMessageAt as unknown as string)}
                                        </p>
                                        <div className="mt-1 flex items-center justify-end gap-1">
                                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                                <MessageCircle className="h-3 w-3" />
                                                {c.messageCount}
                                            </span>
                                            {c.hasAdminReply && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                                    <UserCheck className="h-3 w-3" />
                                                    replied
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <Button
                        variant="outline"
                        disabled={pagination.page <= 1}
                        onClick={() =>
                            setSearchParams((p) => {
                                p.set("page", String(pagination.page - 1));
                                return p;
                            })
                        }
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-gray-500">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={!pagination.hasMore}
                        onClick={() =>
                            setSearchParams((p) => {
                                p.set("page", String(pagination.page + 1));
                                return p;
                            })
                        }
                    >
                        Next
                    </Button>
                </div>
            )}

            <Outlet />
        </div>
    );
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "chat", action: "view" });

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    const { conversations, pagination } = await getAssistantConversations({
        search,
        page,
    });

    return json({ conversations, pagination, filters: { search } });
}

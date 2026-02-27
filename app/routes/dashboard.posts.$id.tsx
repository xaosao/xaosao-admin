import React from "react";
import { json, Link, redirect, useLoaderData, useNavigate } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

// components
import { Button } from "~/components/ui/button";
import Breadcrumb from "~/components/ui/bread-crumb";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    ArrowLeft,
    Calendar,
    Clock,
    MapPin,
    Users,
    Heart,
    Trash,
    User,
    MessageCircle,
    Coins,
} from "lucide-react";

// utils and service
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { capitalizeFirstLetter, formatDate } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "post",
        action: "view",
    });

    const postId = params.id;
    if (!postId) {
        throw new Response("Post ID is required", { status: 400 });
    }

    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            customer: {
                select: { id: true, firstName: true, lastName: true, profile: true, gender: true, status: true, whatsapp: true },
            },
            model: {
                select: { id: true, firstName: true, lastName: true, profile: true, gender: true, status: true, whatsapp: true },
            },
            service: {
                select: { id: true, name: true },
            },
            interests: {
                include: {
                    customer: {
                        select: { id: true, firstName: true, lastName: true, profile: true },
                    },
                    model: {
                        select: { id: true, firstName: true, lastName: true, profile: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!post) {
        throw new Response("Post not found", { status: 404 });
    }

    return json({ post });
}

export async function action({ request, params }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "post",
        action: "delete",
    });

    const postId = params.id;
    if (!postId) {
        return redirect("/dashboard/posts?error=Post ID is required");
    }

    const formData = await request.formData();
    const actionType = formData.get("actionType") as string;

    if (actionType === "delete") {
        await prisma.post.update({
            where: { id: postId },
            data: { status: "deleted" },
        });
        return redirect("/dashboard/posts?success=Post deleted successfully");
    }

    return redirect(`/dashboard/posts/${postId}`);
}

export default function PostDetail() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { post } = useLoaderData<{ post: any }>();

    const canAccess = hasPermission("post", "view");
    const canDelete = hasPermission("post", "delete");

    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions."
                />
            </div>
        );
    }

    const author = post.authorType === "customer" ? post.customer : post.model;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Post Detail</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Posts", value: "/dashboard/posts" },
                            { label: "Detail", value: "#" },
                        ]}
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/dashboard/posts")}
                    className="flex items-center gap-1"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Post Info */}
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Post Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={author?.profile ?? ""} />
                                <AvatarFallback>{author?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-sm font-medium text-gray-900">
                                    {author?.firstName ?? "Unknown"} {author?.lastName ?? ""}
                                </p>
                                <span className={`text-xs rounded px-2 py-0.5 ${post.authorType === "customer" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                                    {capitalizeFirstLetter(post.authorType)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-800">{post.content}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-gray-500">Status:</span>
                                <span className={`ml-2 text-xs rounded px-2 py-0.5 ${
                                    post.status === "active" ? "bg-green-50 text-green-600" :
                                    post.status === "fulfilled" ? "bg-purple-50 text-purple-600" :
                                    post.status === "expired" ? "bg-orange-50 text-orange-600" :
                                    "bg-red-50 text-red-600"
                                }`}>
                                    {capitalizeFirstLetter(post.status)}
                                </span>
                            </div>
                            {post.service && (
                                <div>
                                    <span className="text-gray-500">Service:</span>
                                    <span className="ml-2 text-xs bg-rose-50 text-rose-600 rounded px-2 py-0.5">
                                        {post.service.name}
                                    </span>
                                </div>
                            )}
                            {post.hasTip && (
                                <div>
                                    <span className="text-gray-500">Tip:</span>
                                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 inline-flex items-center gap-1">
                                        <Coins className="h-3 w-3" />
                                        Has Tip
                                    </span>
                                </div>
                            )}
                            {post.preferredDate && (
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-gray-400" />
                                    <span className="text-gray-500">Date:</span>
                                    <span className="ml-1">{new Date(post.preferredDate).toLocaleDateString()}</span>
                                </div>
                            )}
                            {post.preferredTime && (
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-gray-400" />
                                    <span className="text-gray-500">Time:</span>
                                    <span className="ml-1">{post.preferredTime}</span>
                                </div>
                            )}
                            {post.location && (
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-gray-400" />
                                    <span className="text-gray-500">Location:</span>
                                    <span className="ml-1">{post.location}</span>
                                </div>
                            )}
                            {post.targetGender && (
                                <div>
                                    <span className="text-gray-500">Target Gender:</span>
                                    <span className="ml-2">{capitalizeFirstLetter(post.targetGender)}</span>
                                </div>
                            )}
                            {post.targetCount && (
                                <div>
                                    <span className="text-gray-500">Target Count:</span>
                                    <span className="ml-2">{post.targetCount}</span>
                                </div>
                            )}
                            {(post.targetAgeMin || post.targetAgeMax) && (
                                <div>
                                    <span className="text-gray-500">Age Range:</span>
                                    <span className="ml-2">{post.targetAgeMin || "?"} - {post.targetAgeMax || "?"}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
                            <div>
                                <span className="text-gray-500">Created:</span>
                                <span className="ml-2">{formatDate(post.createdAt)}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">Expires:</span>
                                <span className="ml-2">{formatDate(post.expiresAt)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3 text-rose-500" />
                                <span className="text-gray-500">Interested:</span>
                                <span className="ml-1 font-medium">{post.interestedCount}</span>
                            </div>
                        </div>

                        <div className="border-t pt-3 flex items-center gap-2">
                            {author?.whatsapp && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    asChild
                                >
                                    <a href={`https://wa.me/${author.whatsapp}`} target="_blank" rel="noopener noreferrer">
                                        <MessageCircle className="h-4 w-4 mr-1" />
                                        Chat WhatsApp
                                    </a>
                                </Button>
                            )}
                            {canDelete && post.status !== "deleted" && (
                                <form method="post">
                                    <input type="hidden" name="actionType" value="delete" />
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="sm"
                                        className="text-red-500 border-red-200 hover:bg-red-50"
                                    >
                                        <Trash className="h-4 w-4 mr-1" />
                                        Delete Post
                                    </Button>
                                </form>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Interested Users */}
                <Card className="border-0 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Interested Users ({post.interests.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {post.interests.length > 0 ? (
                            <div className="space-y-3">
                                {post.interests.map((interest: any) => {
                                    const user = interest.userType === "customer" ? interest.customer : interest.model;
                                    return (
                                        <div key={interest.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user?.profile ?? ""} />
                                                    <AvatarFallback>{user?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {user?.firstName ?? "Unknown"} {user?.lastName ?? ""}
                                                    </p>
                                                    <span className={`text-xs rounded px-1 py-0.5 ${interest.userType === "customer" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                                                        {capitalizeFirstLetter(interest.userType)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-400">{formatDate(interest.createdAt)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No one has shown interest yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

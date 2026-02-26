import { json, redirect, useLoaderData, useNavigate } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

// components
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ArrowLeft, Trash } from "lucide-react";

// utils and service
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { prisma } from "~/services/database.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "post",
        action: "delete",
    });

    const postId = params.id;
    if (!postId) {
        throw new Response("Post ID is required", { status: 400 });
    }

    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
            id: true,
            content: true,
            authorType: true,
            status: true,
            customer: { select: { firstName: true, lastName: true } },
            model: { select: { firstName: true, lastName: true } },
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

    await prisma.post.update({
        where: { id: postId },
        data: { status: "deleted" },
    });

    return redirect("/dashboard/posts?success=Post deleted successfully");
}

export default function DeletePost() {
    const navigate = useNavigate();
    const { post } = useLoaderData<{ post: any }>();
    const author = post.authorType === "customer" ? post.customer : post.model;

    return (
        <div className="h-full flex items-center justify-center">
            <Card className="w-full max-w-md border-0 shadow-md">
                <CardHeader>
                    <CardTitle className="text-md text-red-600">Delete Post</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Are you sure you want to delete this post by{" "}
                        <strong>{author?.firstName ?? "Unknown"} {author?.lastName ?? ""}</strong>?
                    </p>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-800 line-clamp-3">{post.content}</p>
                    </div>
                    <p className="text-xs text-gray-500">This action will mark the post as deleted. It will no longer appear in feeds.</p>
                    <div className="flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/dashboard/posts")}
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Cancel
                        </Button>
                        <form method="post">
                            <Button
                                type="submit"
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white"
                            >
                                <Trash className="h-4 w-4 mr-1" />
                                Delete
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

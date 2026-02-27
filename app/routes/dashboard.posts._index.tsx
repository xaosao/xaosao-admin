import React, { useCallback, useRef } from "react";
import { Form, json, Link, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";

// components
import EmptyPage from "~/components/ui/empty";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "~/components/ui/table";
import {
    X,
    Eye,
    Trash,
    Megaphone,
    Users,
    CheckCircle,
    Clock,
    AlertCircle,
    MessageCircle,
    Coins,
} from "lucide-react";

// utils and service
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { capitalizeFirstLetter, formatDate, truncateText } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { prisma } from "~/services/database.server";

interface LoaderData {
    posts: any[];
    stats: { total: number; active: number; expired: number; fulfilled: number };
    pagination: any;
    filters: any;
    success: string | null;
}

export default function PostsIndex() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { posts, stats, pagination, filters, success } = useLoaderData<LoaderData>();

    const updateFilters = useCallback((updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        if (!updates.page && Object.keys(updates).length > 0) {
            params.set("page", "1");
        }
        navigate(`?${params.toString()}`, { replace: true });
    }, [searchParams, navigate]);

    const clearFilters = useCallback(() => {
        if (formRef.current) {
            formRef.current.reset();
        }
        navigate("", { replace: true });
    }, [navigate]);

    const handleSearchSubmit = useCallback((formData: FormData) => {
        const search = formData.get("search") as string;
        const authorType = formData.get("authorType") as string;
        const status = formData.get("status") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            search: search || "",
            authorType: authorType || "",
            status: status || "",
            from: from || "",
            to: to || "",
            showBy: showBy || "10",
        });
    }, [updateFilters]);

    React.useEffect(() => {
        if (success) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");
            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("post", "view");
    const canDelete = hasPermission("post", "delete");

    if (!canAccess) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions. Please request access or go back."
                />
            </div>
        );
    }

    const statCards = [
        { label: "Total Posts", value: stats.total, icon: Megaphone, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Active", value: stats.active, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
        { label: "Expired", value: stats.expired, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
        { label: "Fulfilled", value: stats.fulfilled, icon: AlertCircle, color: "text-purple-600", bg: "bg-purple-50" },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Post Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Post management", value: "/posts" },
                        ]}
                    />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.label} className="border-0 shadow-md">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{stat.label}</p>
                                <p className="text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="lg:col-span-3 border-0 shadow-md">
                <CardHeader className="pb-0">
                    <Form
                        ref={formRef}
                        method="get"
                        onChange={(e) => {
                            const formData = new FormData(e.currentTarget);
                            handleSearchSubmit(formData);
                        }}
                        className="flex flex-col md:flex-row md:items-center md:space-y-0 space-y-2"
                    >
                        <div className="flex flex-1 items-center space-x-4">
                            <div className="w-48">
                                <input
                                    type="text"
                                    name="search"
                                    placeholder="Search by name or content..."
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    defaultValue={filters.search}
                                />
                            </div>
                            <div className="w-36">
                                <select
                                    name="authorType"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    defaultValue={filters.authorType}
                                >
                                    <option value="">All authors</option>
                                    <option value="customer">Customer</option>
                                    <option value="model">Model</option>
                                </select>
                            </div>
                            <div className="hidden sm:block w-36">
                                <select
                                    name="status"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    defaultValue={filters.status}
                                >
                                    <option value="">All status</option>
                                    <option value="active">Active</option>
                                    <option value="expired">Expired</option>
                                    <option value="fulfilled">Fulfilled</option>
                                    <option value="deleted">Deleted</option>
                                </select>
                            </div>
                            <div className="hidden sm:flex w-56 items-center space-x-2">
                                <input
                                    type="date"
                                    name="from"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={filters.fromDate}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    name="to"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    defaultValue={filters.toDate}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end w-full md:w-auto mt-2 md:mt-0 md:ml-4 space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="flex items-center space-x-1"
                            >
                                <X className="h-3 w-3" />
                                <span>Clear</span>
                            </Button>
                            <div className="w-28">
                                <select
                                    name="showBy"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    defaultValue={filters.showBy.toString()}
                                >
                                    <option value="10">10</option>
                                    <option value="30">30</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>
                    </Form>
                </CardHeader>
                <CardContent className="p-0 mt-4">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-gray-100">
                                <TableHead className="font-semibold">No</TableHead>
                                <TableHead className="font-semibold">Author</TableHead>
                                <TableHead className="font-semibold">Content</TableHead>
                                <TableHead className="font-semibold">Service</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Interested</TableHead>
                                <TableHead className="font-semibold">Created</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {posts && posts.length > 0 ? posts.map((post: any, index: number) => {
                                const author = post.authorType === "customer" ? post.customer : post.model;
                                return (
                                    <TableRow key={post.id} className="border-gray-50 hover:bg-gray-50 text-gray-500">
                                        <TableCell>{(pagination.currentPage - 1) * pagination.limit + index + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={author?.profile ?? ""} />
                                                    <AvatarFallback>{author?.firstName?.charAt(0) ?? "?"}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {author?.firstName ?? "Unknown"} {author?.lastName ?? ""}
                                                    </p>
                                                    <span className={`text-xs rounded px-1 py-0.5 ${post.authorType === "customer" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                                                        {capitalizeFirstLetter(post.authorType)}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm text-gray-600 max-w-[200px] truncate">{truncateText(post.content, 60)}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {post.service ? (
                                                    <span className="text-xs bg-rose-50 text-rose-600 rounded px-2 py-0.5">
                                                        {post.service.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                                {post.hasTip && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-0.5">
                                                        <Coins className="h-3 w-3" />
                                                        Tip
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-xs rounded px-2 py-0.5 ${
                                                post.status === "active" ? "bg-green-50 text-green-600" :
                                                post.status === "fulfilled" ? "bg-purple-50 text-purple-600" :
                                                post.status === "expired" ? "bg-orange-50 text-orange-600" :
                                                "bg-red-50 text-red-600"
                                            }`}>
                                                {capitalizeFirstLetter(post.status)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3 text-gray-400" />
                                                <span className="text-sm">{post.interestedCount}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">{formatDate(post.createdAt)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-1">
                                                {canAccess && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                        <Link to={`${post.id}`} className="flex space-x-2">
                                                            <Eye className="h-3 w-3" />
                                                            <span className="sr-only">View</span>
                                                        </Link>
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                        <Link to={`delete/${post.id}`} className="flex space-x-2">
                                                            <Trash className="h-3 w-3 text-red-500" />
                                                            <span className="sr-only">Delete</span>
                                                        </Link>
                                                    </Button>
                                                )}
                                                {author?.whatsapp && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                                        <a href={`https://wa.me/${author.whatsapp}`} target="_blank" rel="noopener noreferrer">
                                                            <MessageCircle className="h-3 w-3 text-green-500" />
                                                            <span className="sr-only">Chat</span>
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12">
                                        <EmptyPage
                                            title="No posts found!"
                                            description="There are no posts in the database yet."
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalCount={pagination.totalCount}
                        limit={pagination.limit}
                        hasNextPage={pagination.hasNextPage}
                        hasPreviousPage={pagination.hasPreviousPage}
                        baseUrl=""
                        searchParams={searchParams}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export async function loader({ request }: { request: Request }) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "post",
        action: "view",
    });

    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract filters
    const search = searchParams.get("search") || "";
    const authorType = searchParams.get("authorType") || "";
    const status = searchParams.get("status") || "";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    // Build where clause
    const where: any = {};

    if (search) {
        const nameFilter = { contains: search, mode: "insensitive" as const };
        where.OR = [
            { content: { contains: search, mode: "insensitive" } },
            { customer: { firstName: nameFilter } },
            { customer: { lastName: nameFilter } },
            { model: { firstName: nameFilter } },
            { model: { lastName: nameFilter } },
        ];
    }
    if (authorType) {
        where.authorType = authorType;
    }
    if (status) {
        where.status = status;
    }
    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            where.createdAt.lte = endDate;
        }
    }

    try {
        const [posts, totalCount, activeCount, expiredCount, fulfilledCount] = await Promise.all([
            prisma.post.findMany({
                where,
                include: {
                    customer: {
                        select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
                    },
                    model: {
                        select: { id: true, firstName: true, lastName: true, profile: true, whatsapp: true },
                    },
                    service: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * showBy,
                take: showBy,
            }),
            prisma.post.count({ where }),
            prisma.post.count({ where: { status: "active" } }),
            prisma.post.count({ where: { status: "expired" } }),
            prisma.post.count({ where: { status: "fulfilled" } }),
        ]);

        const totalPages = Math.ceil(totalCount / showBy);

        return json({
            posts,
            stats: {
                total: activeCount + expiredCount + fulfilledCount,
                active: activeCount,
                expired: expiredCount,
                fulfilled: fulfilledCount,
            },
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit: showBy,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
            filters: {
                search,
                authorType,
                status,
                fromDate,
                toDate,
                page,
                showBy,
            },
            success,
        });
    } catch (error) {
        console.log("LOAD_POSTS_DATA_FAILED", error);
        throw new Error("Failed to fetch posts data");
    }
}

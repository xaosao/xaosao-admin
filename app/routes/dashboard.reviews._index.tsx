import { toast } from "react-toastify"
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
    Star,
    Trash,
} from "lucide-react";

// utils and service
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { capitalizeFirstLetter, formatDate, truncateText } from "~/utils";
import { getModelsWithReviews, getRatingDistribution, getReviews } from "~/services/review.server";
import { useAuthStore } from "~/store/permissionStore";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

interface LoaderData {
    ratingDistribution: any;
    reviews: any;
    modelWithReview: any;
    pagination: any;
    filters: any;
    success: string;
}

export default function Reviews() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { reviews, ratingDistribution, modelWithReview, pagination, filters, success } = useLoaderData<LoaderData>();

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
        const model = formData.get("model") as string;
        const from = formData.get("from") as string;
        const to = formData.get("to") as string;
        const showBy = formData.get("showBy") as string;

        updateFilters({
            model: model || "",
            from: from || "",
            to: to || "",
            showBy: showBy || "10",
        });
    }, [updateFilters]);

    React.useEffect(() => {
        if (success) {
            toast.success(success);

            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("success");

            navigate(newUrl.pathname + newUrl.search, { replace: true });
        }
    }, [success, navigate]);

    const canAccess = hasPermission("review", "view");
    const canDelete = hasPermission("review", "delete");

    if (!canAccess) {
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 mb-2">Review Management</h1>
                    <Breadcrumb
                        items={[
                            { label: "Dashboard", value: "/dashboard" },
                            { label: "Review management", value: "/reviews" },
                        ]}
                    />
                </div>
            </div>

            <Card className="border-0 shadow-md rounded">
                <CardContent className="p-4">
                    <div className="space-y-3">
                        {ratingDistribution.map((rating: any) => (
                            <div key={rating.stars} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1">
                                        {[...Array(rating.stars)].map((_, i) => (
                                            <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                                        ))}
                                        {[...Array(5 - rating.stars)].map((_, i) => (
                                            <Star key={i} className="h-4 w-4 text-gray-300" />
                                        ))}
                                    </div>
                                    <span className="hidden sm:flex text-sm font-medium text-gray-900">{rating.stars} stars</span>
                                </div>
                                <div className="flex items-center space-x-0 sm:space-x-3">
                                    <div className="w-32 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-yellow-500 h-2 rounded-full"
                                            style={{ width: `${rating.percentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-sm text-gray-600 w-16 text-right">{rating.count.toLocaleString()}</span>
                                    <span className="text-sm text-gray-500 w-12 text-right">{rating.percentage}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

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
                            <div className="hidden sm:block w-56">
                                <select
                                    name="model"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.model}
                                >
                                    <option value="all">All models</option>
                                    {modelWithReview?.map((model: any) => (
                                        <option key={model.id} value={model.id}>{model.firstName}&nbsp;{model.lastName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-56 flex items-center space-x-2">
                                <input
                                    type="date"
                                    name="from"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.fromDate}
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="date"
                                    name="to"
                                    className="border-gray-200 focus:border-pink-300 focus:ring-pink-300 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                            <div className="block sm:hidden w-56">
                                <select
                                    name="model"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    defaultValue={filters.model}
                                >
                                    <option value="all">All models</option>
                                    {modelWithReview?.map((model: any) => (
                                        <option key={model.id} value={model.id}>{model.firstName}&nbsp;{model.lastName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-28">
                                <select
                                    name="showBy"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                                <TableHead className="font-semibold">Reviewer</TableHead>
                                <TableHead className="font-semibold">Rating</TableHead>
                                <TableHead className="font-semibold">Model</TableHead>
                                <TableHead className="font-semibold">Review date</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reviews && reviews.length > 0 ? reviews.map((review: any, index: number) => (
                                <TableRow key={review.id} className="border-gray-50 hover:bg-gray-50 text-gray-500">
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <div className="">
                                            <div className="flex items-start space-x-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={review.customer?.profile ?? ""} />
                                                    <AvatarFallback>{review.customer.firstName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {review.customer.firstName}&nbsp;{review.customer.lastName}&nbsp;
                                                        <span className={`rounded text-xs ${review.customer.status === "active" ? "text-green-500" : review.customer.status === "inactive" ? "text-red-500" : "text-yellow-500"}`}>({capitalizeFirstLetter(review.customer.status)})</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="pl-8">
                                                <h4 className="text-sm font-medium text-gray-900">{review.title}</h4>
                                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">{truncateText(review.reviewText, 80)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`h-3 w-3 ${i < review.rating ? "text-yellow-500 fill-current" : "text-gray-300"
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-start space-x-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={review.model?.profile ?? ""} />
                                                <AvatarFallback>{review.model?.firstName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{review.model?.firstName}&nbsp;{review.model?.lastName}</p>
                                                <p className={`rounded text-xs ${review.model?.status === "active" ? "text-green-500" : review.model?.status === "inactive" ? "text-red-500" : "text-yellow-500"}`}>{capitalizeFirstLetter(review.model?.status)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(review?.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-1">
                                            {canAccess && <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                <Link to={`${review.id}`} className="flex space-x-2">
                                                    <Eye className="h-3 w-3" />
                                                    <span className="sr-only">View</span>
                                                </Link>
                                            </Button>}
                                            {canDelete && <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                <Link to={`delete/${review.id}`} className="flex space-x-2">
                                                    <Trash className="h-3 w-3 text-red-500" />
                                                    <span className="sr-only">Delete</span>
                                                </Link>
                                            </Button>}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow>
                                <TableCell colSpan={6} className="text-center py-12">
                                    <EmptyPage
                                        title="No reviews found!"
                                        description="There is no reviews in the database yet!"
                                    />
                                </TableCell>
                            </TableRow>}
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
        group: "review",
        action: "view",
    });
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const success = url.searchParams.get("success");

    // Extract search parameters
    const model = searchParams.get("model") || "";
    const fromDate = searchParams.get("from") || "";
    const toDate = searchParams.get("to") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const showBy = parseInt(searchParams.get("showBy") || "10", 10);

    try {
        const [ratingDistribution, reviews, modelWithReview] = await Promise.all([
            getRatingDistribution(),
            getReviews({
                model,
                fromDate,
                toDate,
                page,
                limit: showBy,
            }),
            getModelsWithReviews()
        ])

        return json({
            ...reviews,
            pagination: reviews.pagination,
            ratingDistribution,
            modelWithReview,
            success,
            filters: {
                model,
                fromDate,
                toDate,
                page,
                showBy,
            }
        });
    } catch (error) {
        console.log("LOAD_REVIEW_DATA_FAILED", error)
        throw new Error("Failed to fetch review data");
    }
}
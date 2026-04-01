import React, { useEffect, useState } from "react";
import { Form, json, useLoaderData, useSearchParams, useFetcher, useNavigation } from "@remix-run/react";
import {
    Search,
    X,
    Eye,
    EyeOff,
    Image,
    User,
    AlertTriangle,
    Loader2,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import Breadcrumb from "~/components/ui/bread-crumb";
import { ForbiddenCard } from "~/components/ui/forbidden-card";

import { useAuthStore } from "~/store/permissionStore";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getImages, checkBrokenImages, hideGalleryImage, unhideGalleryImage, hideProfileImage, unhideProfileImage } from "~/services/image.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

interface ImageItem {
    id: string;
    url: string;
    type: "gallery" | "profile";
    ownerType: "model" | "customer";
    ownerId: string;
    ownerName: string;
    ownerProfile: string | null;
    status: string;
    createdAt: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "admin", action: "view" });

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const userType = (url.searchParams.get("userType") || "all") as "all" | "model" | "customer";
    const page = Number(url.searchParams.get("page") || 1);
    const checkLost = url.searchParams.get("checkLost") === "true";

    const result = await getImages({ search, userType, page, limit: 200 });

    let brokenUrls: string[] = [];
    if (checkLost) {
        const urls = result.images.map((img) => img.url);
        const brokenSet = await checkBrokenImages(urls);
        brokenUrls = Array.from(brokenSet);

        // Filter to only show broken images
        result.images = result.images.filter((img) => brokenSet.has(img.url));
        result.pagination.totalCount = result.images.length;
    }

    return json({
        images: result.images,
        pagination: result.pagination,
        filters: { search, userType, checkLost },
        brokenUrls,
    });
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "admin", action: "edit" });

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const imageId = formData.get("imageId") as string;
    const imageType = formData.get("imageType") as "gallery" | "profile";
    const ownerType = formData.get("ownerType") as "model" | "customer";
    const ownerId = formData.get("ownerId") as string;

    try {
        if (intent === "hide") {
            if (imageType === "gallery") {
                await hideGalleryImage(imageId, userId);
            } else {
                await hideProfileImage(ownerType, ownerId, userId);
            }
            return json({ success: true, action: "hide" });
        }

        if (intent === "unhide") {
            if (imageType === "gallery") {
                await unhideGalleryImage(imageId, userId);
            } else {
                await unhideProfileImage(ownerType, ownerId, userId);
            }
            return json({ success: true, action: "unhide" });
        }

        return json({ error: "Invalid intent" });
    } catch (error: any) {
        return json({ error: error.message || "Action failed" });
    }
}

export default function ImagesPage() {
    const { images, pagination, filters, brokenUrls } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigation = useNavigation();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const actionFetcher = useFetcher();
    const loadMoreFetcher = useFetcher<typeof loader>();
    const isLoading = navigation.state === "loading";
    const [allImages, setAllImages] = useState<ImageItem[]>(images as ImageItem[]);
    const [hasMore, setHasMore] = useState(pagination.hasMore);
    const [currentPage, setCurrentPage] = useState(pagination.page);
    const [checkingLost, setCheckingLost] = useState(filters.checkLost);

    const canView = hasPermission("admin", "view");
    const canEdit = hasPermission("admin", "edit");

    // Reset when filters change
    useEffect(() => {
        setAllImages(images as ImageItem[]);
        setHasMore(pagination.hasMore);
        setCurrentPage(pagination.page);
        setLastLoadedPage(pagination.page);
    }, [images, pagination]);

    const [lastLoadedPage, setLastLoadedPage] = useState(pagination.page);

    const handleLoadMore = () => {
        if (!hasMore || loadMoreFetcher.state !== "idle") return;
        const nextPage = currentPage + 1;
        const params = new URLSearchParams(searchParams);
        params.set("page", String(nextPage));
        loadMoreFetcher.load(`/dashboard/images?index&${params.toString()}`);
    };

    // Append loaded images
    useEffect(() => {
        if (loadMoreFetcher.data && loadMoreFetcher.state === "idle") {
            const newData = loadMoreFetcher.data as any;
            const newPage = newData.pagination?.page;
            if (newPage && newPage !== lastLoadedPage && newData.images?.length > 0) {
                setAllImages((prev) => [...prev, ...newData.images]);
                setHasMore(newData.pagination.hasMore);
                setCurrentPage(newPage);
                setLastLoadedPage(newPage);
            } else if (newData.images?.length === 0) {
                setHasMore(false);
            }
        }
    }, [loadMoreFetcher.data, loadMoreFetcher.state]);

    const handleToggleHide = (image: ImageItem) => {
        const isHidden = image.status === "hidden" || image.status === "inactive";
        actionFetcher.submit(
            {
                intent: isHidden ? "unhide" : "hide",
                imageId: image.id,
                imageType: image.type,
                ownerType: image.ownerType,
                ownerId: image.ownerId,
            },
            { method: "post" }
        );
    };

    // Update local state after action
    useEffect(() => {
        if (actionFetcher.state === "idle" && actionFetcher.data) {
            const data = actionFetcher.data as any;
            if (data.success) {
                // Reload to get fresh data
                setSearchParams((prev) => {
                    prev.set("_t", String(Date.now()));
                    return prev;
                }, { replace: true });
            }
        }
    }, [actionFetcher.state, actionFetcher.data]);

    if (!canView) {
        return (
            <div className="h-full flex items-center justify-center">
                <ForbiddenCard
                    title="Unallowed for your role"
                    subtitle="This admin area requires additional permissions."
                />
            </div>
        );
    }

    const brokenSet = new Set(brokenUrls);

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <Breadcrumb items={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Images" },
            ]} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-gray-800">Images</h1>
                    <p className="text-sm text-gray-500">Manage all user images ({pagination.totalCount} total)</p>
                </div>
            </div>

            {/* Filters */}
            <Form method="get" className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        name="search"
                        placeholder="Search by name..."
                        defaultValue={filters.search}
                        className="pl-9 w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                </div>

                <select
                    name="userType"
                    defaultValue={filters.userType}
                    className="h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                    <option value="all">All Users</option>
                    <option value="model">Models Only</option>
                    <option value="customer">Customers Only</option>
                </select>

                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                        type="checkbox"
                        name="checkLost"
                        value="true"
                        defaultChecked={filters.checkLost}
                        className="rounded border-gray-300 text-rose-500 focus:ring-rose-500"
                    />
                    Lost images only
                </label>

                <Button type="submit" size="sm" className="bg-rose-500 hover:bg-rose-600 text-white">
                    <Search className="w-4 h-4 mr-1" /> Filter
                </Button>

                {(filters.search || filters.userType !== "all" || filters.checkLost) && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchParams({});
                            setCheckingLost(false);
                        }}
                    >
                        <X className="w-4 h-4 mr-1" /> Clear
                    </Button>
                )}
            </Form>

            {filters.checkLost && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Showing only images with broken/lost CDN URLs. This check may take a moment.
                </div>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                        <p className="text-sm text-gray-500">
                            {filters.checkLost ? "Checking image URLs... This may take a moment." : "Loading images..."}
                        </p>
                    </div>
                </div>
            )}

            {/* Image Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 ${isLoading ? "hidden" : ""}`}>
                {allImages.map((image) => {
                    const isHidden = image.status === "hidden" || image.status === "inactive";
                    const isBroken = brokenSet.has(image.url);

                    return (
                        <div key={image.id} className={`relative group rounded-xl overflow-hidden border ${isHidden ? "border-red-300 opacity-60" : "border-gray-200"}`}>
                            {/* Image */}
                            <div className="aspect-square bg-gray-100 relative">
                                <img
                                    src={image.url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                    }}
                                />
                                <div className="hidden absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                                    <AlertTriangle className="w-8 h-8 mb-1" />
                                    <span className="text-xs">Lost</span>
                                </div>

                                {/* Type badge */}
                                <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${image.type === "profile" ? "bg-blue-500 text-white" : "bg-gray-800 text-white"}`}>
                                    {image.type === "profile" ? "Profile" : "Gallery"}
                                </div>

                                {/* Hidden badge */}
                                {isHidden && (
                                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500 text-white">
                                        Hidden
                                    </div>
                                )}

                                {/* Hover overlay with actions */}
                                {canEdit && (
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => handleToggleHide(image)}
                                            disabled={actionFetcher.state !== "idle"}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isHidden
                                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                                    : "bg-red-500 hover:bg-red-600 text-white"
                                                }`}
                                        >
                                            {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            {isHidden ? "Show" : "Hide"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Owner info */}
                            <div className="p-2">
                                <div className="flex items-center gap-1.5">
                                    {image.ownerProfile && !isHidden ? (
                                        <img src={image.ownerProfile} alt="" className="w-5 h-5 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                            <User className="w-3 h-3 text-gray-400" />
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-700 truncate flex-1">{image.ownerName}</span>
                                </div>
                                <span className={`text-[10px] ${image.ownerType === "model" ? "text-rose-500" : "text-blue-500"}`}>
                                    {image.ownerType === "model" ? "Model" : "Customer"}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty state */}
            {allImages.length === 0 && !isLoading && (
                <div className="text-center py-16">
                    <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No images found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                </div>
            )}

            {/* Load more button */}
            {hasMore && (
                <div className="flex items-center justify-center py-6">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadMoreFetcher.state !== "idle"}
                        className="flex items-center gap-2 px-6 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {loadMoreFetcher.state === "loading" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>Load More ({allImages.length} / {pagination.totalCount})</>
                        )}
                    </button>
                </div>
            )}

            {!hasMore && allImages.length > 0 && (
                <p className="text-center text-sm text-gray-400 py-4">
                    All {pagination.totalCount} images loaded
                </p>
            )}
        </div>
    );
}

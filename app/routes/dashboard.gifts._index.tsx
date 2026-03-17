import { toast } from "react-toastify";
import React, { useCallback, useRef, useState } from "react";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
    useLoaderData,
    useSearchParams,
    Form,
    useFetcher,
} from "@remix-run/react";
import {
    Search,
    Trash2,
    MoreVertical,
    Gift,
    Plus,
    Pencil,
    X,
    Package,
    DollarSign,
    Send,
    ImageIcon,
    LoaderCircle,
} from "lucide-react";

// components
import EmptyPage from "~/components/ui/empty";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Pagination from "~/components/ui/pagination";
import Breadcrumb from "~/components/ui/bread-crumb";
import StatusBadge from "~/components/ui/status-badge";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Card, CardContent } from "~/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";

// services
import { requireUserPermission, requireUserSession } from "~/services/auth.server";
import { getGifts, getGift, createGift, updateGift, deleteGift, getGiftStats } from "~/services/gift.server";
import { useAuthStore } from "~/store/permissionStore";

export async function loader({ request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({ userId, group: "gift", action: "view" });

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("show") || "20");

    const [giftsData, stats] = await Promise.all([
        getGifts({ search, status, page, limit }),
        getGiftStats(),
    ]);

    return json({ ...giftsData, stats });
}

export async function action({ request }: ActionFunctionArgs) {
    const userId = await requireUserSession(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
        await requireUserPermission({ userId, group: "gift", action: "create" });
        const name = formData.get("name") as string;
        const price = parseFloat(formData.get("price") as string);
        const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
        const status = formData.get("status") as string || "active";
        const imageFile = formData.get("image") as File;

        if (!name || !price) {
            return json({ error: "Name and price are required!" }, { status: 400 });
        }

        await createGift({ name, price, sortOrder, status, imageFile });
        return json({ success: true, message: "Gift created successfully!" });
    }

    if (intent === "update") {
        await requireUserPermission({ userId, group: "gift", action: "edit" });
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const price = parseFloat(formData.get("price") as string);
        const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
        const status = formData.get("status") as string || "active";
        const imageFile = formData.get("image") as File;

        if (!id || !name || !price) {
            return json({ error: "ID, name, and price are required!" }, { status: 400 });
        }

        await updateGift(id, { name, price, sortOrder, status, imageFile });
        return json({ success: true, message: "Gift updated successfully!" });
    }

    if (intent === "delete") {
        await requireUserPermission({ userId, group: "gift", action: "delete" });
        const id = formData.get("id") as string;
        if (!id) return json({ error: "Gift ID is required!" }, { status: 400 });

        await deleteGift(id);
        return json({ success: true, message: "Gift deleted successfully!" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
}

export default function GiftsPage() {
    const { gifts, pagination, stats } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const fetcher = useFetcher();
    const hasPermission = useAuthStore((state) => state.hasPermission);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editGift, setEditGift] = useState<any>(null);
    const [deleteGift, setDeleteGift] = useState<any>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const isSubmitting = fetcher.state !== "idle";

    // Handle fetcher response
    React.useEffect(() => {
        if (fetcher.data && (fetcher.data as any).success) {
            toast.success((fetcher.data as any).message);
            setShowCreateModal(false);
            setEditGift(null);
            setDeleteGift(null);
            setImagePreview(null);
        } else if (fetcher.data && (fetcher.data as any).error) {
            toast.error((fetcher.data as any).error);
        }
    }, [fetcher.data]);

    const canView = hasPermission("gift", "view");
    const canCreate = hasPermission("gift", "create");
    const canEdit = hasPermission("gift", "edit");
    const canDelete = hasPermission("gift", "delete");

    const updateFilter = useCallback(
        (key: string, value: string) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                if (value && value !== "all" && value !== "") {
                    next.set(key, value);
                } else {
                    next.delete(key);
                }
                next.delete("page");
                return next;
            });
        },
        [setSearchParams]
    );

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const statCards = [
        { title: "Total Gifts", value: stats.total, icon: Package, color: "text-blue-500" },
        { title: "Active", value: stats.active, icon: Gift, color: "text-green-500" },
        { title: "Inactive", value: stats.inactive, icon: Gift, color: "text-gray-500" },
        { title: "Gifts Sent", value: stats.totalGiftsSent, icon: Send, color: "text-pink-500" },
        { title: "Revenue", value: `${stats.totalRevenue.toLocaleString()} ₭`, icon: DollarSign, color: "text-amber-500" },
    ];

    return (
        <div className="space-y-4 p-2 sm:p-4">
            <Breadcrumb items={[{ label: "Dashboard", value: "/dashboard" }, { label: "Gifts", value: "" }]} />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {statCards.map((stat) => (
                    <Card key={stat.title} className="py-3">
                        <CardContent className="px-4 py-0">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">{stat.title}</p>
                                    <p className="text-lg font-bold">{stat.value}</p>
                                </div>
                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="py-3">
                <CardContent className="px-4 py-0">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search gifts..."
                                defaultValue={searchParams.get("search") || ""}
                                onChange={(e) => updateFilter("search", e.target.value)}
                                className="w-full pl-10 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                        <select
                            defaultValue={searchParams.get("status") || "all"}
                            onChange={(e) => updateFilter("status", e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        {canCreate && (
                            <Button
                                className="w-full sm:w-auto bg-dark-pink hover:opacity-90 text-white"
                                onClick={() => {
                                    setShowCreateModal(true);
                                    setImagePreview(null);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Gift
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            {gifts.length === 0 ? (
                <EmptyPage title="No gifts found" description="Create your first gift to get started." />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">#</TableHead>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Price (₭)</TableHead>
                                        <TableHead>Order</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gifts.map((gift: any, index: number) => (
                                        <TableRow key={gift.id}>
                                            <TableCell className="text-gray-500 text-sm">
                                                {(pagination.currentPage - 1) * pagination.limit + index + 1}
                                            </TableCell>
                                            <TableCell>
                                                {gift.image ? (
                                                    <img
                                                        src={gift.image}
                                                        alt={gift.name}
                                                        className="w-10 h-10 rounded-md object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center">
                                                        <ImageIcon className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{gift.name}</TableCell>
                                            <TableCell>{gift.price.toLocaleString()}</TableCell>
                                            <TableCell>{gift.sortOrder}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={gift.status} />
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {new Date(gift.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {canEdit && (
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setEditGift(gift);
                                                                    setImagePreview(gift.image || null);
                                                                }}
                                                            >
                                                                <Pencil className="h-4 w-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        {canDelete && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-red-600"
                                                                    onClick={() => setDeleteGift(gift)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {gifts.map((gift: any) => (
                            <Card key={gift.id} className="py-3">
                                <CardContent className="px-4 py-0">
                                    <div className="flex items-center gap-3">
                                        {gift.image ? (
                                            <img
                                                src={gift.image}
                                                alt={gift.name}
                                                className="w-14 h-14 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                <ImageIcon className="h-6 w-6 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium truncate">{gift.name}</span>
                                                <StatusBadge status={gift.status} />
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-sm text-gray-500">
                                                    {gift.price.toLocaleString()} ₭
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    Order: {gift.sortOrder}
                                                </span>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {canEdit && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditGift(gift);
                                                            setImagePreview(gift.image || null);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                )}
                                                {canDelete && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => setDeleteGift(gift)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <Pagination
                            currentPage={pagination.currentPage}
                            totalPages={pagination.totalPages}
                            onPageChange={(page: number) => {
                                setSearchParams((prev) => {
                                    const next = new URLSearchParams(prev);
                                    next.set("page", page.toString());
                                    return next;
                                });
                            }}
                        />
                    )}
                </>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <GiftFormModal
                    title="Create New Gift"
                    onClose={() => {
                        setShowCreateModal(false);
                        setImagePreview(null);
                    }}
                    fetcher={fetcher}
                    isSubmitting={isSubmitting}
                    intent="create"
                    imagePreview={imagePreview}
                    onImageChange={handleImageChange}
                />
            )}

            {/* Edit Modal */}
            {editGift && (
                <GiftFormModal
                    title="Edit Gift"
                    gift={editGift}
                    onClose={() => {
                        setEditGift(null);
                        setImagePreview(null);
                    }}
                    fetcher={fetcher}
                    isSubmitting={isSubmitting}
                    intent="update"
                    imagePreview={imagePreview}
                    onImageChange={handleImageChange}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteGift && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <h3 className="text-lg font-semibold mb-2">Delete Gift</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Are you sure you want to delete <strong>{deleteGift.name}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDeleteGift(null)}>
                                Cancel
                            </Button>
                            <fetcher.Form method="post">
                                <input type="hidden" name="intent" value="delete" />
                                <input type="hidden" name="id" value={deleteGift.id} />
                                <Button type="submit" variant="destructive" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <LoaderCircle className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 mr-1" />
                                    )}
                                    Delete
                                </Button>
                            </fetcher.Form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function GiftFormModal({
    title,
    gift,
    onClose,
    fetcher,
    isSubmitting,
    intent,
    imagePreview,
    onImageChange,
}: {
    title: string;
    gift?: any;
    onClose: () => void;
    fetcher: any;
    isSubmitting: boolean;
    intent: string;
    imagePreview: string | null;
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <fetcher.Form method="post" encType="multipart/form-data" className="space-y-4">
                    <input type="hidden" name="intent" value={intent} />
                    {gift && <input type="hidden" name="id" value={gift.id} />}

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gift Image</label>
                        <div className="flex items-center gap-4">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-md object-cover" />
                            ) : (
                                <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center">
                                    <ImageIcon className="h-6 w-6 text-gray-400" />
                                </div>
                            )}
                            <input
                                type="file"
                                name="image"
                                accept="image/*"
                                onChange={onImageChange}
                                className="text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                            />
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            type="text"
                            name="name"
                            required
                            defaultValue={gift?.name || ""}
                            placeholder="e.g., Rose"
                            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (₭) *</label>
                        <input
                            type="number"
                            name="price"
                            required
                            min="0"
                            step="1000"
                            defaultValue={gift?.price || ""}
                            placeholder="e.g., 10000"
                            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                    </div>

                    {/* Sort Order */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                        <input
                            type="number"
                            name="sortOrder"
                            min="0"
                            defaultValue={gift?.sortOrder ?? 0}
                            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            name="status"
                            defaultValue={gift?.status || "active"}
                            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-dark-pink hover:opacity-90 text-white" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <LoaderCircle className="h-4 w-4 animate-spin mr-1" />
                            ) : intent === "create" ? (
                                <Plus className="h-4 w-4 mr-1" />
                            ) : (
                                <Pencil className="h-4 w-4 mr-1" />
                            )}
                            {isSubmitting ? "Saving..." : intent === "create" ? "Create" : "Update"}
                        </Button>
                    </div>
                </fetcher.Form>
            </div>
        </div>
    );
}

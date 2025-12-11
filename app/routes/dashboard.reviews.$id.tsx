import { Star, DollarSign, Users, UserCheck } from "lucide-react"
import { json, useLoaderData, useNavigate } from "@remix-run/react"

// components
import Modal from "~/components/ui/modal"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

// utils
import { formatDate } from "~/utils"
import { getReview } from "~/services/review.server"
import { LoaderFunctionArgs } from "@remix-run/node"
import { useAuthStore } from "~/store/permissionStore"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

export default function ReviewDetailsModal() {
    const navigate = useNavigate();
    const review = useLoaderData<typeof loader>();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const renderStars = (rating: number) => {
        return Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        ))
    }

    function closeHandler() {
        navigate("..");
    }

    const canView = hasPermission("review", "view");

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
        <Modal onClose={closeHandler} className="w-11/12 sm:w-3/5">
            <div className="space-y-4">
                <div>
                    <h3 className="flex items-center text-black text-md font-bold">Review Details</h3>
                    <p className="text-gray-500 text-sm ml-2 mt-2">Complete information about this customer review</p>
                </div>
            </div >
            <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="flex items-center space-x-2">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={review.customer?.profile ?? ""} />
                        <AvatarFallback>{"transaction.customer.firstName"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm font-medium text-gray-900">{review.customer?.firstName.charAt(0)}&nbsp; {review.customer?.lastName?.charAt(0)}</p>
                        <p className="flex items-center justify-start text-xs font-medium text-gray-500"><Users className="h-3 w-3" />&nbsp;Customer</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 pl-0 sm:pl-4">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={review.model?.profile ?? ""} />
                        <AvatarFallback>{review.model?.firstName.charAt(0)}{review.model?.lastName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-sm text-gray-600">{review.model?.firstName}&nbsp;{review.model?.lastName}</p>
                        <p className="flex items-center justify-start text-xs font-medium text-gray-500">
                            <UserCheck className="h-3 w-3" />&nbsp;Model&nbsp;&nbsp;
                        </p>
                    </div>
                </div>
                <Card className="mt-4">
                    <CardHeader className="py-0 my-0">
                        <CardTitle className="text-md flex items-center space-x-2">
                            <Star className="h-5 w-5" />
                            <span>Rating & Review</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                            {renderStars(review.rating)}
                            <span className="text-2xl font-bold">{review.rating}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Review ID:</span>
                            <span className="text-sm text-muted-foreground">{review.id}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Session ID:</span>
                            <span className="text-sm text-muted-foreground">{review.sessionId}</span>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Review Title:&nbsp; {review.title}</p>
                            <span className="text-sm font-medium">Review Text:</span>
                            <div className="p-3 bg-gray-50 rounded-md">
                                <p className="text-sm">{review.reviewText}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Separator className="block sm:hidden" />
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md flex items-center space-x-2">
                            <DollarSign className="h-5 w-5" />
                            <span>Session Financial</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Session Duration:</span>
                                <span className="text-sm">{5} minutes</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Total Cost:</span>
                                <span className="text-sm font-bold">${1234}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Rate per Minute:</span>
                                <span className="text-sm">${(2343 / 33).toFixed(2)}</span>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Review Date:</span>
                            <span className="text-sm text-muted-foreground">{formatDate(review.createdAt)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={closeHandler}>
                    Close
                </Button>
            </div>
        </Modal >
    )
}


export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "review",
        action: "view",
    });
    const review = await getReview(params.id!);
    if (!review) {
        throw new Response("Review not found", { status: 404 });
    }
    return json(review);
}
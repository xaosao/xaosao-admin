import { json, LoaderFunctionArgs } from "@remix-run/node"
import { Link, useLoaderData, useNavigate } from "@remix-run/react"
import {
    DollarSign,
    Activity,
    Eye,
    Edit,
    Plus,
    Minus,
    UserCheck,
    Users,
    Dot,
    Wallet,
    Ban,
    Trash2,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react"

import Modal from "~/components/ui/modal"
import EmptyPage from "~/components/ui/empty"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import StatusBadge from "~/components/ui/status-badge"
import { ForbiddenCard } from "~/components/ui/forbidden-card"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

// utils and service
import { capitalizeFirstLetter } from "~/utils"
import { useAuthStore } from "~/store/permissionStore"
import { getRecentTransactions } from "~/services/transaction.server"
import { getUserWalletStatus, getWallet } from "~/services/wallet.server"
import { requireUserPermission, requireUserSession } from "~/services/auth.server"

interface LoaderData {
    wallet: any;
    recentTransactions: any;
    stats: any;
}

const iconMap = {
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Activity,
};

export default function WalletDetailsModal() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { wallet, recentTransactions, stats } = useLoaderData<LoaderData>();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount / 100)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const owner = wallet.model ?? wallet.customer;

    function closeHandler() {
        navigate("..");
    }

    const canView = hasPermission("admin", "view");
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
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={owner?.profile ?? ""} alt={owner?.firstName} />
                    <AvatarFallback>{owner?.firstName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-medium text-sm">{owner?.firstName}&nbsp;{owner?.lastName}</p>
                    <p className="flex items-center text-xs text-gray-500">
                        {wallet.customerId === null ? <UserCheck className="h-4 w-4" /> : <Users className="h-4 w-4" />}&nbsp;
                        {wallet.customerId === null ? "Model" : "Customer"}&nbsp;&nbsp;
                        <span className="flex items-center justify-center text-green-500"><Dot />{capitalizeFirstLetter(wallet.status)}</span>
                    </p>
                </div>
            </div>
            <p className="text-sm text-gray-500 space-y-2 my-4">Complete wallet information and transaction history</p>
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.map((stat: any, index: number) => {
                        const IconComponent = iconMap[stat.icon as keyof typeof iconMap];
                        return (
                            <Card key={index} className="border-0 shadow-md rounded-md">
                                <CardContent className="p-2 text-center">
                                    <div className={`p-1 rounded-lg ${stat.bgColor} inline-block`}>
                                        {IconComponent && (
                                            <IconComponent className={`h-4 w-4 ${stat.color}`} />
                                        )}
                                    </div>
                                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                                    <p className="text-xs text-gray-500">{stat.title}</p>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
                <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="w-full flex items-start justify-between">
                        <TabsTrigger value="transactions"><span className="hidden sm:block">Recent</span> Transactions</TabsTrigger>
                        <TabsTrigger value="details">Wallet Details</TabsTrigger>
                        <TabsTrigger value="actions">Quick Actions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="transactions" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center">
                                    <Activity className="h-5 w-5 mr-2" />
                                    Transaction History
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 sm:p-4">
                                <div className="space-y-4">
                                    {recentTransactions && recentTransactions.length ? recentTransactions.map((transaction: any) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div
                                                    className={`p-2 rounded-lg ${transaction.identifier === "deposit"
                                                        ? "bg-green-50"
                                                        : "bg-red-50"
                                                        }`}
                                                >
                                                    {transaction.type === "deposit" ? (
                                                        <Plus className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <Minus className="h-4 w-4 text-red-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{transaction.rejectReason ?? "NO DETAIL"}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatDate(transaction.createdAt)} • {transaction.id}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p
                                                    className={`text-sm font-semibold ${transaction.identifier === "withdraw" ? "text-red-600" : "text-green-600"
                                                        }`}
                                                >
                                                    {transaction.identifier === "withdraw" ? "-" : "+"}&nbsp;
                                                    {formatCurrency(Math.abs(transaction.amount))}
                                                </p>
                                                <StatusBadge status={transaction.status} />
                                            </div>
                                        </div>
                                    )) : <EmptyPage
                                        title="No Transaction Found!"
                                        description="There is no transaction in the database yet!"
                                    />}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="details" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-md flex items-center">
                                    <Wallet className="h-5 w-5 mr-2" />
                                    Wallet Information:
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Wallet ID</label>
                                        <p className="mt-1 text-sm font-mono">{wallet.id}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Owner ID</label>
                                        <p className="mt-1 text-sm font-mono">{owner?.id}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Created At</label>
                                        <p className="mt-1 text-sm">{formatDate(wallet.createdAt)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Last Updated</label>
                                        <p className="mt-1 text-sm">{formatDate(wallet.updatedAt)}</p>
                                    </div>
                                    {wallet.updatedById && <div>
                                        <label className="text-sm font-medium text-gray-500">Updated By</label>
                                        <p className="mt-1 text-sm">{wallet.updatedById}</p>
                                    </div>}

                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <Link to={`view/${wallet.id}`} className="flex space-x-2">
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Full Transaction History
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <Link to={`/dashboard/wallets/${wallet.id}`} className="flex space-x-2">
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit Wallet Settings
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start bg-transparent">
                                    <Link to={`/dashboard/wallets/adjust/${wallet.id}`} className="flex space-x-2">
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Adjust Balance
                                    </Link>
                                </Button>
                                <Separator />
                                <Button variant="outline" className="w-full justify-start text-orange-600 bg-transparent">
                                    <Link to={`/dashboard/wallets/ban/${wallet.id}`} className="flex space-x-2">
                                        <Ban className="h-3 w-3" />
                                        <span>Suspend wallet</span>
                                    </Link>
                                </Button>
                                <Button variant="outline" className="w-full justify-start text-red-600 bg-transparent">
                                    <Link to={`/dashboard/wallets/delete/${wallet.id}`} className="flex space-x-2">
                                        <Trash2 className="h-3 w-3" />
                                        <span>Delete wallet</span>
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={closeHandler}>
                    Close
                </Button>
            </div>
        </Modal>
    )
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "view",
    });
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type !== "model" && type !== "customer") {
        throw new Error("Invalid or missing user type.");
    }
    const wallet = await getWallet(params.id!);
    const owner = wallet?.model ?? wallet?.customer;
    const recentTransactions = await getRecentTransactions(
        type === "model" ? owner?.id : "",
        type === "customer" ? owner?.id : "",
        5
    );
    const stats = await getUserWalletStatus(params?.id as string)

    return json({ wallet, recentTransactions, stats });
}
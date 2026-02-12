import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
    TrendingUp,
    TrendingDown,
    Wallet,
    UserCheck,
    Users,
    Dot,
    X,
} from "lucide-react";

import Modal from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import { ForbiddenCard } from "~/components/ui/forbidden-card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { capitalizeFirstLetter } from "~/utils";
import { useAuthStore } from "~/store/permissionStore";
import { getWalletSummary, WalletSummaryResult } from "~/services/wallet.server";
import { requireUserPermission, requireUserSession } from "~/services/auth.server";

// Transaction identifier display names
const identifierLabels: Record<string, string> = {
    // Model earnings
    booking_earning: "Booking Earning",
    booking_referral: "Booking Commission",
    subscription_referral: "Subscription Commission",
    referral: "Model Referral Bonus",
    // Customer incoming
    recharge: "Top Up",
    booking_refund: "Booking Refund",
    call_refund: "Call Refund",
    call_refund_unused: "Call Unused Refund",
    // Model withdrawals
    withdrawal: "Withdrawal",
    // Customer outgoing
    subscription: "Subscription",
    booking_hold: "Booking Payment",
};

function formatDate(dateString: string | Date) {
    return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US").format(amount) + " Kip";
}

export default function WalletSummaryModal() {
    const navigate = useNavigate();
    const hasPermission = useAuthStore((state) => state.hasPermission);
    const { summary } = useLoaderData<{ summary: WalletSummaryResult }>();

    function closeHandler() {
        navigate("..");
    }

    const canAccess = hasPermission("admin", "edit");
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

    const isModel = summary.ownerType === "model";
    const side1Title = isModel ? "Earnings" : "Incoming";
    const side2Title = isModel ? "Withdrawals" : "Outgoing";

    return (
        <Modal onClose={closeHandler} className="w-11/12 sm:w-4/5 lg:w-3/4 xl:w-2/3 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg flex-1">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={summary.owner?.profile ?? ""} alt={summary.owner?.firstName} />
                        <AvatarFallback>{summary.owner?.firstName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium text-sm">{summary.owner?.firstName}&nbsp;{summary.owner?.lastName}</p>
                        <p className="flex items-center text-xs text-gray-500">
                            {isModel ? <UserCheck className="h-4 w-4" /> : <Users className="h-4 w-4" />}&nbsp;
                            {isModel ? "Model" : "Customer"}&nbsp;&nbsp;
                            <span className="flex items-center justify-center text-green-500">
                                <Dot />{capitalizeFirstLetter(summary.wallet.status)}
                            </span>
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={closeHandler} className="ml-2">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">Wallet Summary</h2>
            <p className="text-sm text-gray-500 mb-4">
                Detailed breakdown of all {isModel ? "earnings and withdrawals" : "incoming and outgoing transactions"}
            </p>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Side 1: Earnings/Incoming - Green theme */}
                <div className="border border-green-200 rounded-lg overflow-hidden">
                    <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="h-5 w-5" />
                            <span className="font-semibold">{side1Title}</span>
                        </div>
                        <span className="text-sm">
                            {summary.earnings.transactions.length} transactions
                        </span>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto">
                        {summary.earnings.transactions.length > 0 ? (
                            <div className="divide-y divide-green-100">
                                {summary.earnings.transactions.map((transaction) => (
                                    <div key={transaction.id} className="px-4 py-3 hover:bg-green-50">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {identifierLabels[transaction.identifier] || transaction.identifier}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDate(transaction.createdAt)}
                                                </p>
                                                {transaction.reason && (
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]" title={transaction.reason}>
                                                        {transaction.reason}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-green-600">
                                                +{formatCurrency(Math.abs(transaction.amount))}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-500">
                                <Wallet className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No {side1Title.toLowerCase()} found</p>
                            </div>
                        )}
                    </div>
                    <div className="bg-green-50 px-4 py-3 border-t border-green-200">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">Total {side1Title}</span>
                            <span className="text-lg font-bold text-green-600">
                                {formatCurrency(summary.earnings.total)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Side 2: Withdrawals/Outgoing - Rose theme */}
                <div className="border border-rose-200 rounded-lg overflow-hidden">
                    <div className="bg-rose-500 text-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <TrendingDown className="h-5 w-5" />
                            <span className="font-semibold">{side2Title}</span>
                        </div>
                        <span className="text-sm">
                            {summary.withdrawals.transactions.length} transactions
                        </span>
                    </div>
                    <div className="max-h-[40vh] overflow-y-auto">
                        {summary.withdrawals.transactions.length > 0 ? (
                            <div className="divide-y divide-rose-100">
                                {summary.withdrawals.transactions.map((transaction) => (
                                    <div key={transaction.id} className="px-4 py-3 hover:bg-rose-50">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {identifierLabels[transaction.identifier] || transaction.identifier}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatDate(transaction.createdAt)}
                                                </p>
                                                {transaction.reason && (
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]" title={transaction.reason}>
                                                        {transaction.reason}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-rose-600">
                                                -{formatCurrency(Math.abs(transaction.amount))}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-8 text-center text-gray-500">
                                <Wallet className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No {side2Title.toLowerCase()} found</p>
                            </div>
                        )}
                    </div>
                    <div className="bg-rose-50 px-4 py-3 border-t border-rose-200">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-700">Total {side2Title}</span>
                            <span className="text-lg font-bold text-rose-600">
                                {formatCurrency(summary.withdrawals.total)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Refunds Section (Customers only) */}
            {!isModel && summary.refunds.transactions.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden mb-4">
                    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4" />
                            <span className="font-semibold text-sm">Refunds</span>
                        </div>
                        <span className="text-xs">
                            {summary.refunds.transactions.length} transactions
                        </span>
                    </div>
                    <div className="max-h-[20vh] overflow-y-auto">
                        <div className="divide-y divide-amber-100">
                            {summary.refunds.transactions.map((transaction) => (
                                <div key={transaction.id} className="px-4 py-2 hover:bg-amber-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {identifierLabels[transaction.identifier] || transaction.identifier}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatDate(transaction.createdAt)}
                                            </p>
                                        </div>
                                        <p className="text-sm font-semibold text-amber-600">
                                            +{formatCurrency(Math.abs(transaction.amount))}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-amber-50 px-4 py-2 border-t border-amber-200">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-gray-700">Total Refunds</span>
                            <span className="font-bold text-amber-600">
                                {formatCurrency(summary.refunds.total)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Available Balance */}
            <div className={`rounded-lg p-4 ${summary.availableBalance >= 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Wallet className={`h-6 w-6 ${summary.availableBalance >= 0 ? "text-blue-600" : "text-red-600"}`} />
                        <span className="font-semibold text-gray-700">Available Balance</span>
                    </div>
                    <span className={`text-xl font-bold ${summary.availableBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {formatCurrency(summary.availableBalance)}
                    </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    {isModel ? (
                        <>Calculated as: Total {side1Title} ({formatCurrency(summary.earnings.total)}) - Total {side2Title} ({formatCurrency(summary.withdrawals.total)})</>
                    ) : (
                        <>Calculated as: Total {side1Title} ({formatCurrency(summary.earnings.total)}) - Total {side2Title} ({formatCurrency(summary.withdrawals.total)}) + Total Refunds ({formatCurrency(summary.refunds.total)})</>
                    )}
                </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={closeHandler}>
                    Close
                </Button>
            </div>
        </Modal>
    );
}

export async function loader({ params, request }: LoaderFunctionArgs) {
    const userId = await requireUserSession(request);
    await requireUserPermission({
        userId,
        group: "wallet",
        action: "view",
    });

    const walletId = params.id;
    if (!walletId) {
        throw new Error("Wallet ID is required!");
    }

    const summary = await getWalletSummary(walletId);

    return json({ summary });
}

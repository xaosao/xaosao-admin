import { prisma } from "./database.server";

interface GetSubscriptionsOptions {
    search?: string;
    package?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
}

export async function getSubscriptions(options: GetSubscriptionsOptions) {
    const {
        search = "",
        package: packageFilter = "all",
        status = "all",
        fromDate = "",
        toDate = "",
        page = 1,
        limit = 10,
    } = options;

    const where: any = {};

    // Search by customer name or whatsapp
    if (search) {
        where.customer = {
            OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { whatsapp: { equals: isNaN(Number(search)) ? undefined : Number(search) } },
            ].filter(Boolean),
        };
    }

    // Filter by package/plan
    if (packageFilter && packageFilter !== "all") {
        where.planId = packageFilter;
    }

    // Filter by status
    if (status && status !== "all") {
        where.status = status;
    }

    // Filter by date range (based on createdAt)
    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) {
            where.createdAt.gte = new Date(fromDate);
        }
        if (toDate) {
            if (toDate.includes("T")) {
                where.createdAt.lte = new Date(toDate);
            } else {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }
    }

    const skip = (page - 1) * limit;

    const [subscriptions, totalCount] = await Promise.all([
        prisma.subscription.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        whatsapp: true,
                        profile: true,
                    },
                },
                plan: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        durationDays: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.subscription.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
        subscriptions,
        pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
}

export async function getSubscriptionStats() {
    const now = new Date();

    const [total, active, expired, canceled, pending] = await Promise.all([
        prisma.subscription.count(),
        prisma.subscription.count({
            where: { status: "active", endDate: { gte: now } },
        }),
        prisma.subscription.count({
            where: {
                OR: [
                    { status: "expired" },
                    { status: "active", endDate: { lt: now } },
                ],
            },
        }),
        prisma.subscription.count({ where: { status: "canceled" } }),
        prisma.subscription.count({
            where: {
                status: { in: ["pending", "pending_payment"] },
            },
        }),
    ]);

    return [
        { title: "Total", value: total, icon: "CreditCard", color: "text-blue-500" },
        { title: "Active", value: active, icon: "CheckCircle", color: "text-green-500" },
        { title: "Expired", value: expired, icon: "Clock", color: "text-gray-500" },
        { title: "Canceled", value: canceled, icon: "XCircle", color: "text-red-500" },
        { title: "Pending", value: pending, icon: "AlertCircle", color: "text-orange-500" },
    ];
}

export async function getSubscriptionPlans() {
    return prisma.subscription_plan.findMany({
        select: { id: true, name: true },
        orderBy: { durationDays: "asc" },
    });
}

export async function updateSubscriptionStatus(
    subscriptionId: string,
    newStatus: string
) {
    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: newStatus },
    });
}

/**
 * Re-activate an expired subscription — keeps the original startDate/endDate,
 * only sets status back to "active".
 */
export async function reactivateSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
    });

    if (!subscription) {
        throw new Error("Subscription not found");
    }

    const updated = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            status: "active",
            notes: `Re-activated by admin (was ${subscription.status})`,
        },
    });

    // Also update subscription_history if exists
    await prisma.subscription_history.updateMany({
        where: {
            subscriptionId,
            status: subscription.status,
        },
        data: {
            status: "active",
        },
    });

    return updated;
}

export async function deleteSubscription(subscriptionId: string) {
    // Delete related history first, then the subscription
    await prisma.subscription_history.deleteMany({
        where: { subscriptionId },
    });
    return prisma.subscription.delete({
        where: { id: subscriptionId },
    });
}

export async function getSubscriptionSummary() {
    // Two lightweight MongoDB aggregation pipelines — nothing loaded into
    // Node.js memory. Safe for millions of rows.

    // Pipeline 1: totals + earliest date + revenue (via $lookup)
    const statsCmd = prisma.$runCommandRaw({
        aggregate: "subscription",
        pipeline: [
            {
                $lookup: {
                    from: "subscription_plan",
                    localField: "planId",
                    foreignField: "_id",
                    as: "planData",
                },
            },
            { $unwind: { path: "$planData", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: null,
                    totalSubscriptions: { $sum: 1 },
                    totalRevenue: { $sum: { $ifNull: ["$planData.price", 0] } },
                    startDate: { $min: "$createdAt" },
                },
            },
        ],
        cursor: {},
    });

    // Pipeline 1b: count unique customers (no large arrays in memory)
    const uniqueCmd = prisma.$runCommandRaw({
        aggregate: "subscription",
        pipeline: [
            { $group: { _id: "$customerId" } },
            { $count: "total" },
        ],
        cursor: {},
    });

    // Pipeline 2: repeat-subscription breakdown entirely in MongoDB
    // Step A: count subs per customer → Step B: bucket those counts
    const repeatCmd = prisma.$runCommandRaw({
        aggregate: "subscription",
        pipeline: [
            { $group: { _id: "$customerId", cnt: { $sum: 1 } } },
            { $match: { cnt: { $gte: 2 } } },
            {
                $group: {
                    _id: null,
                    times2: { $sum: { $cond: [{ $eq: ["$cnt", 2] }, 1, 0] } },
                    times3: { $sum: { $cond: [{ $eq: ["$cnt", 3] }, 1, 0] } },
                    times4: { $sum: { $cond: [{ $eq: ["$cnt", 4] }, 1, 0] } },
                    times5: { $sum: { $cond: [{ $eq: ["$cnt", 5] }, 1, 0] } },
                    timesMore: { $sum: { $cond: [{ $gt: ["$cnt", 5] }, 1, 0] } },
                },
            },
        ],
        cursor: {},
    });

    const [statsRaw, uniqueRaw, repeatRaw] = await Promise.all([statsCmd, uniqueCmd, repeatCmd]) as any[];

    const stats = statsRaw?.cursor?.firstBatch?.[0];
    const unique = uniqueRaw?.cursor?.firstBatch?.[0];
    const repeat = repeatRaw?.cursor?.firstBatch?.[0];

    if (!stats) {
        return {
            startDate: null,
            totalSubscriptions: 0,
            totalRevenue: 0,
            totalUniqueCustomers: 0,
            repeatBreakdown: { times2: 0, times3: 0, times4: 0, times5: 0, timesMore: 0 },
        };
    }

    // Parse date from MongoDB Extended JSON format
    const startDateRaw = stats.startDate;
    const startDate = startDateRaw?.$date
        ? new Date(startDateRaw.$date).toISOString()
        : startDateRaw instanceof Date
            ? startDateRaw.toISOString()
            : typeof startDateRaw === "string"
                ? startDateRaw
                : null;

    return {
        startDate,
        totalSubscriptions: stats.totalSubscriptions ?? 0,
        totalRevenue: stats.totalRevenue ?? 0,
        totalUniqueCustomers: unique?.total ?? 0,
        repeatBreakdown: {
            times2: repeat?.times2 ?? 0,
            times3: repeat?.times3 ?? 0,
            times4: repeat?.times4 ?? 0,
            times5: repeat?.times5 ?? 0,
            timesMore: repeat?.timesMore ?? 0,
        },
    };
}

// Get per-plan subscription counts for a customer
export async function getCustomerPlanCounts(customerId: string) {
    const counts = await prisma.subscription.groupBy({
        by: ["planId"],
        where: { customerId },
        _count: { id: true },
    });
    return counts;
}

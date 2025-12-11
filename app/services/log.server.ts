import { prisma } from "./database.server";
import { IAuditLogsCreate } from "~/interfaces";

export async function getAuditLogs(
  options: {
    search?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  try {
    const {
      search = "",
      status = "all",
      fromDate,
      toDate,
      page = 1,
      limit = 10,
    } = options;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        {
          action: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    // Filter by status
    if (status && status !== "all") {
      whereClause.status = status;
    }

    // Filter by date range
    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1); // include full toDate day
        whereClause.createdAt.lt = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [logs, totalCount] = await Promise.all([
      prisma.audit_logs.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          model: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.audit_logs.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      logs,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit,
      },
    };
  } catch (error) {
    console.error("GET_AUDIT_LOGS_FAILED", error);
    throw new Error("Failed to fetch audit logs!");
  }
}

export async function getAuditLogsByEntity(
  options: {
    modelId?: string;
    customerId?: string;
    userId?: string;
    limit?: number;
    page?: number;
    paginate?: boolean;
  } = {}
) {
  try {
    const {
      modelId,
      customerId,
      userId,
      limit = 20,
      page = 1,
      paginate = false,
    } = options;

    const whereClause: any = {};
    if (modelId) whereClause.modelId = modelId;
    if (customerId) whereClause.customerId = customerId;
    if (userId) whereClause.userId = userId;

    const skip = (page - 1) * limit;

    if (paginate) {
      const [logs, totalCount] = await Promise.all([
        prisma.audit_logs.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            action: true,
            description: true,
            status: true,
            createdAt: true,
          },
        }),
        prisma.audit_logs.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        logs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage,
          hasPreviousPage,
          limit,
        },
      };
    } else {
      const logs = await prisma.audit_logs.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          action: true,
          description: true,
          status: true,
          createdAt: true,
        },
      });

      return { logs };
    }
  } catch (error) {
    console.error("GET_AUDIT_LOGS_BY_ENTITY_FAILED", error);
    throw new Error("Failed to fetch audit logs by entity");
  }
}

export async function createAuditLogs(data: IAuditLogsCreate) {
  try {
    return await prisma.audit_logs.create({
      data: {
        action: data.action,
        description: data.description,
        status: data.status,
        onSuccess: data.onSuccess,
        onError: data.onError,
        ...(data.model && { model: { connect: { id: data.model } } }),
        ...(data.customer && { customer: { connect: { id: data.customer } } }),
        ...(data.user && { user: { connect: { id: data.user } } }),
      },
    });
  } catch (error) {
    console.error("CREATE_AUDIT_LOGS_FAILED", error);
    throw new Error("Failed to create audit logs!");
  }
}

export async function getAuditLogsStatus() {
  try {
    const [total, success, failed, authentication] = await Promise.all([
      prisma.audit_logs.count(),
      prisma.audit_logs.count({
        where: { status: "success" },
      }),
      prisma.audit_logs.count({
        where: { status: "failed" },
      }),
      prisma.audit_logs.count({
        where: { action: "LOGIN" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const logsStatus = [
      {
        title: "Total logs",
        value: format(total),
        trend: "up",
        icon: "Activity",
        color: "text-yellow-600",
      },
      {
        title: "Success logs",
        value: format(success),
        trend: "up",
        icon: "BadgeCheck",
        color: "text-green-600",
      },
      {
        title: "Failed logs",
        value: format(failed),
        trend: "up",
        icon: "Ban",
        color: "text-red-600",
      },
      {
        title: "Authentication logs",
        value: format(authentication),
        trend: "up",
        icon: "ShieldOff",
        color: "text-blue-600",
      },
    ];

    return logsStatus;
  } catch (err) {
    console.error("FETCH_LOGS_STATS_FAILED", err);
    throw new Error("Failed to get logs status!");
  }
}

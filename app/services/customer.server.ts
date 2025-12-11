import { default as bcrypt } from "bcryptjs";

import { ICustomer } from "~/interfaces";
import { prisma } from "./database.server";
import { createWallet } from "./wallet.server";
import { UserStatus } from "~/interfaces/base";
import { getLocationDetails } from "./ip.server";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./admin.server";
import { extractFilenameFromCDNSafe } from "~/utils";
import { deleteFileFromBunny } from "./upload.server";

const { hash } = bcrypt;

export async function getCustomers(
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
      const searchConditions = [
        {
          firstName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
      whereClause.OR = searchConditions;
    }

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        whereClause.createdAt.lt = endDate;
      }
    }

    const skip = (page - 1) * limit;
    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      customers,
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
    console.log("FETCH_CUSTOMER_DATA_FAILED", error);
    throw new Error("Failed to get customers.");
  }
}

export async function getCustomer(id: string) {
  if (!id) {
    console.log("NO_CUSTOMER_ID:", id);
    throw new Error("Failed to get customer data.");
  }
  try {
    const customer = await prisma.customer.findFirst({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    return customer;
  } catch (error) {
    console.log("FETCH_CUSTOMER_DATA_FAILED", error);
    throw new Error("Failed to get customer data.");
  }
}

export async function addCustomer(
  customerData: ICustomer,
  userId: string,
  ip: string,
  accessKey: string
) {
  if (!customerData || !userId)
    throw new Error("Missing customer creation data!");
  const auditBase = {
    action: "CREATE_CUSTOMER",
    user: userId,
  };

  try {
    const existingCustomer = await prisma.customer.findFirst({
      where: { whatsapp: customerData.whatsapp },
    });

    if (existingCustomer) {
      throw new FieldValidationError({
        whatsapp: "This whatsapp number is already in used!",
      });
    }

    const locationDetails = await getLocationDetails(ip, accessKey);
    const passwordHash = await hash(customerData.password, 12);
    // Get latest number and calculate next
    const latestUser = await prisma.customer.findFirst({
      where: {
        number: {
          startsWith: "XSC-",
        },
      },
      orderBy: {
        number: "desc",
      },
    });

    let nextNumber = "XSC-0001";
    if (latestUser?.number) {
      const latestNumber = parseInt(latestUser.number.replace("XSC-", ""));
      const incremented = (latestNumber + 1).toString().padStart(4, "0");
      nextNumber = `XSC-${incremented}`;
    }

    const customer = await prisma.customer.create({
      data: {
        number: nextNumber,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        username: customerData.username,
        password: passwordHash,
        latitude: +locationDetails.latitude,
        longitude: +locationDetails.longitude,
        country: locationDetails.countryName,
        status: customerData.status,
        tier: customerData.tier,
        ip: ip,
        whatsapp: customerData.whatsapp,
        location: locationDetails,
        profile: customerData.profile,
        createdBy: { connect: { id: userId } },
        deletedBy: undefined,
      },
    });

    if (customer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create customer: ${customer.id} successfully!`,
        status: "success",
        onError: customer,
      });

      await createWallet(
        {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          status: UserStatus.ACTIVE,
          customer: customer.id,
        },
        userId
      );
    }
    return customer;
  } catch (error: any) {
    console.log("INSERT_CUSTOMER_DATA_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "customer_number_key") {
        throw new FieldValidationError({
          number: "This number is already exist! Try to create new.",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Create new customer failed!`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to add customer, Try again later!",
    });
  }
}

export async function updateCustomer(
  id: string,
  customerData: ICustomer,
  userId: string
) {
  if (!id || !customerData || !userId)
    throw new Error("Missing customer update data!");

  const auditBase = {
    action: "UPDATE_CUSTOMER",
    user: userId,
  };
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        username: customerData.username,
        whatsapp: customerData.whatsapp,
        tier: customerData.tier,
        status: customerData.status,
        profile: customerData.profile,
      },
    });

    if (customer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update customer: ${customer.id} successfully.`,
        status: "success",
        onSuccess: customer,
      });
    }

    return customer;
  } catch (error: any) {
    console.log("UPDATE_CUSTOMER_DATA_FAILED");

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "customer_whatsapp_key") {
        throw new FieldValidationError({
          whatsapp: "This whatsapp is already exist!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Update customer failed!`,
      status: "failed",
      onSuccess: error,
    });

    throw new FieldValidationError({
      id: "Update customer failed! Try again later!",
    });
  }
}

export async function deleteCustomer(id: string, userId: string) {
  if (!id || !userId) throw new Error("Missing customer delete data!");
  const auditBase = {
    action: "DELETE_CUSTOMER",
    user: userId,
  };
  try {
    const customer = await prisma.customer.delete({
      where: { id },
    });

    if (customer.id) {
      const filePath = extractFilenameFromCDNSafe(customer.profile ?? "");
      await deleteFileFromBunny(filePath);
      await createAuditLogs({
        ...auditBase,
        description: `Delete customer: ${customer.id} successfully.`,
        status: "success",
        onSuccess: customer,
      });
    }
    return customer;
  } catch (error) {
    console.log("DELETE_CUSTOMER_DATA_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete customer failed!`,
      status: "failed",
      onSuccess: error,
    });
    throw new FieldValidationError({
      id: "Delete customer failed! Try again later!",
    });
  }
}

export async function getCustomerStats() {
  try {
    const [total, active, suspended, deleted] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: { status: "active" },
      }),
      prisma.customer.count({
        where: { status: "suspended" },
      }),
      prisma.customer.count({
        where: { status: "inactive" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const customerStats = [
      {
        title: "Total Customers",
        value: format(total),
        icon: "Users",
        color: "text-blue-600",
      },
      {
        title: "Active customers",
        value: format(active),
        icon: "UserCheck",
        color: "text-green-600",
      },
      {
        title: "Suspended customers",
        value: format(suspended),
        icon: "UserLock",
        color: "text-orange-600",
      },
      {
        title: "Inactive customers",
        value: format(deleted),
        icon: "UserX",
        color: "text-red-600",
      },
    ];

    return customerStats;
  } catch (err) {
    console.error("FETCH_CUSTOMER_STATS_FAILED", err);
    throw new Error("Failed to get customer stats.");
  }
}

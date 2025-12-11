import { default as bcrypt } from "bcryptjs";

// backend and service
import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { extractFilenameFromCDNSafe } from "~/utils";
import { deleteFileFromBunny } from "./upload.server";
import { IAdminInput, IAdminUpdateInput } from "~/interfaces";

const { hash } = bcrypt;

export class FieldValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Validation error");
    this.name = "FieldValidationError";
  }
}

export async function getAdmins(options: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const { search = "", page = 1, limit = 10 } = options;

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
        {
          username: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
      whereClause.OR = searchConditions;
    }
    const skip = (page - 1) * limit;
    const [admins, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      admins,
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
    console.error("GET_ADMINS_FAILED", error);
    throw new Error("Failed to fetch admins.");
  }
}

export async function getAdmin(id: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) return null;

    const { password, ...safeUser } = user;
    return safeUser;
  } catch (error) {
    console.error("GET_ADMIN_FAILED", error);
    throw new Error("Failed to fetch admin.");
  }
}

export async function getAdminStats() {
  try {
    const [total, active, suspended, inactive] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { status: "active" },
      }),
      prisma.user.count({
        where: { status: "suspended" },
      }),
      prisma.user.count({
        where: { status: "inactive" },
      }),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const adminStats = [
      {
        title: "Total admins",
        value: format(total),
        icon: "Users",
        color: "text-blue-600",
      },
      {
        title: "Active admins",
        value: format(active),
        icon: "UserCheck",
        color: "text-green-600",
      },
      {
        title: "Suspended admins",
        value: format(suspended),
        icon: "UserLock",
        color: "text-orange-600",
      },
      {
        title: "Inactive admins",
        value: format(inactive),
        icon: "UserX",
        color: "text-red-600",
      },
    ];

    return adminStats;
  } catch (err) {
    console.error("FETCH_CUSTOMER_STATS_FAILED", err);
    throw new Error("Failed to get customer stats.");
  }
}

export async function createAdmin(data: IAdminInput, userId: string) {
  const existingUser = await prisma.user.findFirst({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new FieldValidationError({
      email: "This email address is already in exist!",
    });
  }

  // Get latest number and calculate next
  const latestUser = await prisma.user.findFirst({
    where: {
      number: {
        startsWith: "XS-",
      },
    },
    orderBy: {
      number: "desc",
    },
  });

  let nextNumber = "XS-0001";
  if (latestUser?.number) {
    const latestNumber = parseInt(latestUser.number.replace("XS-", ""));
    const incremented = (latestNumber + 1).toString().padStart(4, "0");
    nextNumber = `XS-${incremented}`;
  }

  const passwordHash = await hash(data.password, 12);
  const auditBase = {
    action: "CREATE_ADMIN_USER",
    user: userId,
  };

  try {
    const admin = await prisma.user.create({
      data: {
        number: nextNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        password: passwordHash,
        gender: data.gender,
        tel: +data.tel,
        email: data.email,
        address: data.address || "",
        profile: data.profile,
        roleId: data.role,
        status: data.status,
      },
    });

    if (admin.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create admin: ${admin.id} successfully.`,
        status: "success",
        onSuccess: admin,
      });
    }
    return admin;
  } catch (error: any) {
    console.error("CREATE_ADMIN_FAILED", error);
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "user_email_key") {
        throw new FieldValidationError({
          email: "This email address is already in use!",
        });
      }

      if (target === "user_tel_key") {
        throw new FieldValidationError({
          tel: "This phone number is already in use!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Create new admin failed.`,
      status: "failed",
      onError: error,
    });

    throw new Error("Failed to create admin.");
  }
}

export async function deleteAdmin(id: string, userId: string) {
  if (!id) throw new Error("Admin id is required!");
  const auditBase = {
    action: "DELETE_ADMIN_ACCOUNT",
    user: userId,
  };
  try {
    const admin = await prisma.user.delete({
      where: { id },
    });
    if (admin.id) {
      const filePath = extractFilenameFromCDNSafe(admin.profile ?? "");
      await deleteFileFromBunny(filePath);
      await createAuditLogs({
        ...auditBase,
        description: `Admin with ID ${id} deleted successfully.`,
        status: "success",
        onSuccess: admin,
      });
    }
    return admin;
  } catch (error) {
    console.log("DELETE_ADMIN_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Admin with ID ${id} deleted failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Delete admin failed! Try again later",
    });
  }
}

export async function updateAdmin(
  id: string,
  data: IAdminUpdateInput,
  userId: string
) {
  if (!id) throw new Error("Invalide admin data to update");
  const auditBase = {
    action: "UPDATE_ADMIN",
    user: userId,
  };
  try {
    const admin = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        tel: data.tel,
        email: data.email,
        status: data.status,
        address: data.address || "",
        ...(data.profile && { profile: data.profile }),
        roleId: data.role,
      },
    });

    if (admin.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Admin with ID ${id} updated successfully.`,
        status: "success",
        onSuccess: admin,
      });
    }
    return admin;
  } catch (error: any) {
    console.error("UPDATE_ADMIN_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "user_email_key") {
        throw new FieldValidationError({
          email: "This email address is already in use!",
        });
      }

      if (target === "user_tel_key") {
        throw new FieldValidationError({
          tel: "This phone number is already in use!",
        });
      }
    }

    await createAuditLogs({
      ...auditBase,
      description: `Admin with ID ${id} update failed!`,
      status: "failed",
      onError: error,
    });

    throw new Error("Failed to update admin information");
  }
}

export async function updateAdminPassword(
  id: string,
  password: string,
  userId: string
) {
  if (!id) throw new Error("Invalide admin data to update");
  const auditBase = {
    action: "UPDATE_ADMIN_PASSWORD",
    user: userId,
  };
  try {
    const passwordHash = await hash(password, 12);
    const admin = await prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
      },
    });
    if (admin.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Change admin: ${id} password successfully.`,
        status: "success",
        onSuccess: admin,
      });
    }
    return admin;
  } catch (error) {
    console.error("UPDATE_ADMIN_PASSWORD_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Change admin: ${id} password failed!`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to update admin password! Try again.",
    });
  }
}

export async function EnableAdminTwoFactorAuthentication(
  id: string,
  is2FAEnabled: boolean,
  userId: string
) {
  if (!id) throw new Error("Invalide admin id");
  const auditBase = {
    action: "ENABLED_ADMIN_2FA_PASSWORD",
    user: userId,
  };
  try {
    const admin = await prisma.user.update({
      where: { id },
      data: {
        is2FAEnabled: is2FAEnabled,
      },
    });
    if (admin.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Enable admin: ${id} 2FA successfully.`,
        status: "success",
        onSuccess: admin,
      });
    }
    return admin;
  } catch (error) {
    console.error("UPDATE_ADMIN_PASSWORD_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Enable admin: ${id} 2FA failed!`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to enable admin 2FA! Try again.",
    });
  }
}

import { createAuditLogs } from "./log.server";
import { prisma } from "./database.server";
import { FieldValidationError } from "./admin.server";
import { permission } from "@prisma/client";

export async function getRoles() {
  try {
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            permissionRoles: true,
            users: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      status: role.status,
      permissionCount: role._count.permissionRoles,
      userCount: role._count.users,
      createdAt: role.createdAt.toISOString().split("T")[0],
      updatedAt: role.updatedAt.toISOString().split("T")[0],
    }));
  } catch (error) {
    console.error("GET_ROLES_FAILED", error);
    throw new Error("Failed to fetch roles.");
  }
}

export async function getPermissions() {
  try {
    return await prisma.permission.findMany({
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("GET_PERMISSIONS_FAILED", error);
    throw new Error("Failed to fetch permissions.");
  }
}

export async function getRoleWithPermissions(roleId: string) {
  if (!roleId) throw new Error("Role ID is required");

  try {
    return await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissionRoles: {
          include: {
            permission: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("GET_ROLE_WITH_PERMS_FAILED", error);
    throw new Error("Failed to fetch role with permissions.");
  }
}

export async function getRoleStats() {
  try {
    const [total, active, inactive, permissions] = await Promise.all([
      prisma.role.count(),
      prisma.role.count({
        where: { status: "active" },
      }),
      prisma.role.count({
        where: { status: "inactive" },
      }),
      prisma.permission.count(),
    ]);

    const format = (val: number) => new Intl.NumberFormat("en-US").format(val);

    const rolesStats = [
      {
        title: "Total Roles",
        value: format(total),
        icon: "Shield",
        color: "text-blue-600",
      },
      {
        title: "Active Roles",
        value: format(active),
        icon: "CheckCircle",
        color: "text-green-600",
      },
      {
        title: "Inactive Roles",
        value: format(inactive),
        icon: "Lock",
        color: "text-red-600",
      },
      {
        title: "Total Permissions",
        value: format(permissions),
        icon: "Key",
        color: "text-purple-600",
      },
    ];

    return rolesStats;
  } catch (error) {
    console.error("FETCH_CUSTOMER_STATS_FAILED", error);
    throw new Error("FETCH_CUSTOMER_STATS_FAILED");
  }
}

export async function getUserWithPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissionRoles: {
            include: {
              permission: {
                select: {
                  id: true,
                  name: true,
                  groupName: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const permissions = user.role.permissionRoles.map((pr) => pr.permission);

  return {
    id: user.id,
    lastName: user.lastName,
    firstName: user.firstName,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
    permissions,
  };
}

export async function createRole(
  name: string,
  permissions: string[],
  createdById: string
) {
  if (!name || !permissions || !createdById)
    throw new Error("Missing role creation data.");
  const auditBase = {
    action: "CREATE_ROLE",
    user: createdById,
  };
  try {
    const role = await prisma.role.create({
      data: {
        name,
        status: "active",
      },
    });

    const permissionRoleData = permissions.map((permissionId) => ({
      roleId: role.id,
      permissionId,
      createdById,
    }));

    await prisma.permission_role.createMany({
      data: permissionRoleData,
    });

    if (role.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create role: ${role.id} successfully.`,
        status: "success",
        onSuccess: role,
      });
    }
    return role;
  } catch (error) {
    console.error("CREATE_ROLE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create role failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to create role and permission links",
    });
  }
}

export async function deleteRole(id: string, userId: string) {
  if (!id) throw new Error("Role ID is required");
  const auditBase = {
    action: "DELETE_ROLE",
    user: userId,
  };
  try {
    await deleteRoleForUpdate(id);
    const role = await prisma.role.delete({
      where: { id },
    });
    if (role.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Delete role: ${role.id} successfully.`,
        status: "success",
        onSuccess: role,
      });
    }
    return role;
  } catch (error) {
    console.log("DELETE_ROLE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete role failed.`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to delete role",
    });
  }
}

export async function updateRole(
  id: string,
  name: string,
  status: string,
  permissions: string[],
  createdById: string
) {
  if (!id || !name || !permissions || !createdById)
    throw new Error("Invalide role update data.");
  const auditBase = {
    action: "UPDATE_SERVICE",
    user: createdById,
  };
  try {
    const clearPermissions = await deleteRoleForUpdate(id);
    if (clearPermissions.message !== "success") {
      throw new Error("Failed to clear existing permissions.");
    }
    const role = await prisma.role.update({
      where: { id },
      data: {
        name: name,
        status: status,
        updatedAt: new Date(),
      },
    });
    if (permissions.length > 0) {
      const permissionRoleData = permissions.map((permissionId) => ({
        roleId: role.id,
        permissionId,
        createdById,
      }));

      await prisma.permission_role.createMany({
        data: permissionRoleData,
      });
    }

    if (role.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update role: ${role.id} successfully.`,
        status: "success",
        onSuccess: role,
      });
    }

    return role;
  } catch (error) {
    console.error("UPDATE_ROLE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update role failed`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      id: "Failed to update role and permission",
    });
  }
}

async function deleteRoleForUpdate(roleId: string) {
  try {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error("Role not found");

    await prisma.$transaction([
      prisma.permission_role.deleteMany({
        where: { roleId },
      }),
    ]);
    return { message: "success" };
  } catch (error) {
    console.error("DELETE_ROLE_FOR_UPDATE_FAILED", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete role."
    );
  }
}

// =============== Permission::::
const defaultPermissions = ["create", "edit", "view", "delete"];

const menuItems = [
  "dashboard",
  "admin",
  "model",
  "customer",
  "service",
  "chat",
  "session",
  "wallet",
  "transaction",
  "booking",
  "revenue",
  "finance",
  "review",
  "log",
  "setting",
  "notification",
];

export async function seedPermissionsData(userId: string) {
  const createdPermissions: permission[] = [];

  for (const menu of menuItems) {
    for (const action of defaultPermissions) {
      const existing = await prisma.permission.findFirst({
        where: {
          name: action,
          groupName: menu,
          userId: userId,
        },
      });

      if (!existing) {
        const permission = await prisma.permission.create({
          data: {
            name: action,
            groupName: menu,
            status: "active",
            createdById: userId,
            userId: userId,
          },
        });

        createdPermissions.push(permission);
      }
    }
  }

  return createdPermissions;
}

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
  "subscription",
  "service",
  "chat",
  "session",
  "wallet",
  "transaction",
  "booking",
  "revenue",
  "finance",
  "post",
  "gift",
  "review",
  "log",
  "setting",
  "notification",
];

// Extra permissions beyond default CRUD for specific groups
const extraPermissions: Record<string, string[]> = {
  transaction: ["reapprove"],
};

export async function seedPermissionsData(userId: string) {
  const createdPermissions: permission[] = [];

  for (const menu of menuItems) {
    const actions = [
      ...defaultPermissions,
      ...(extraPermissions[menu] || []),
    ];

    for (const action of actions) {
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

/**
 * Auto-migrate: ensures all permission groups exist and are linked to
 * super-admin roles. Runs once per server boot (guarded by `migrated` flag).
 *
 * Logic:
 * 1. Create any missing permission records (groupName + name combos)
 * 2. Find roles that already have >= 80% of all permissions (super-admin)
 * 3. Link any missing permissions to those roles via permission_role
 */
let migrated = false;

export async function autoMigratePermissions() {
  if (migrated) return;
  migrated = true;

  try {
    // Step 1: Build the full set of expected permissions
    const expectedPerms: { groupName: string; name: string }[] = [];
    for (const menu of menuItems) {
      const actions = [
        ...defaultPermissions,
        ...(extraPermissions[menu] || []),
      ];
      for (const action of actions) {
        expectedPerms.push({ groupName: menu, name: action });
      }
    }

    // Step 2: Get all existing permissions from DB
    const existingPerms = await prisma.permission.findMany({
      select: { id: true, groupName: true, name: true },
    });

    const existingSet = new Set(
      existingPerms.map((p) => `${p.groupName}:${p.name}`)
    );

    // Step 3: Create missing permission records
    const newPerms: permission[] = [];
    for (const ep of expectedPerms) {
      if (!existingSet.has(`${ep.groupName}:${ep.name}`)) {
        const perm = await prisma.permission.create({
          data: {
            name: ep.name,
            groupName: ep.groupName,
            status: "active",
          },
        });
        newPerms.push(perm);
      }
    }

    if (newPerms.length === 0) return; // Nothing new to link

    console.log(
      `[AutoMigrate] Created ${newPerms.length} new permissions: ${newPerms.map((p) => `${p.groupName}:${p.name}`).join(", ")}`
    );

    // Step 4: Reload all permissions (including newly created)
    const allPerms = await prisma.permission.findMany({
      select: { id: true, groupName: true, name: true },
    });
    const allPermIds = new Set(allPerms.map((p) => p.id));
    const totalPermCount = allPerms.length;

    // Step 5: Find super-admin roles (roles with >= 80% of old permissions)
    const roles = await prisma.role.findMany({
      include: {
        permissionRoles: {
          select: { permissionId: true },
        },
      },
    });

    const oldPermCount = totalPermCount - newPerms.length;

    for (const role of roles) {
      const rolePermIds = new Set(
        role.permissionRoles.map((pr) => pr.permissionId)
      );
      const validCount = [...rolePermIds].filter((id) =>
        allPermIds.has(id)
      ).length;

      // If role has >= 80% of old permissions, treat as super-admin
      if (oldPermCount > 0 && validCount >= oldPermCount * 0.8) {
        // Find which new permissions are missing from this role
        const missingPermIds = newPerms
          .map((p) => p.id)
          .filter((id) => !rolePermIds.has(id));

        if (missingPermIds.length > 0) {
          await prisma.permission_role.createMany({
            data: missingPermIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
          });

          console.log(
            `[AutoMigrate] Linked ${missingPermIds.length} new permissions to role "${role.name}"`
          );
        }
      }
    }
  } catch (error) {
    console.error("[AutoMigrate] Permission migration failed:", error);
    // Non-fatal: don't crash the app
  }
}

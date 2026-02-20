/**
 * Seed script to create initial admin user with Super Admin role
 * and seed all permissions assigned to that role.
 *
 * Run with: npx tsx scripts/seed-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import { default as bcrypt } from "bcryptjs";

const prisma = new PrismaClient();
const { hash } = bcrypt;

const ADMIN_DATA = {
  number: "XS-0001",
  firstName: "Pao",
  lastName: "Kue",
  username: "paokue",
  email: "paokue@xaosao.com",
  password: "Admin@1234",
  gender: "male",
  tel: 2055555555,
  address: "",
  status: "active",
};

const ROLE_NAME = "Super Admin";

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

const defaultActions = ["create", "edit", "view", "delete"];

async function seedAdmin() {
  console.log("Starting admin seed...\n");

  try {
    // 1. Create role
    let role = await prisma.role.findFirst({ where: { name: ROLE_NAME } });
    if (!role) {
      role = await prisma.role.create({
        data: { name: ROLE_NAME, status: "active" },
      });
      console.log(`Created role: ${role.name} (${role.id})`);
    } else {
      console.log(`Role already exists: ${role.name} (${role.id})`);
    }

    // 2. Create admin user
    let admin = await prisma.user.findFirst({
      where: { email: ADMIN_DATA.email },
    });

    if (!admin) {
      const passwordHash = await hash(ADMIN_DATA.password, 12);
      admin = await prisma.user.create({
        data: {
          number: ADMIN_DATA.number,
          firstName: ADMIN_DATA.firstName,
          lastName: ADMIN_DATA.lastName,
          username: ADMIN_DATA.username,
          password: passwordHash,
          gender: ADMIN_DATA.gender,
          tel: ADMIN_DATA.tel,
          email: ADMIN_DATA.email,
          address: ADMIN_DATA.address,
          status: ADMIN_DATA.status,
          roleId: role.id,
        },
      });
      console.log(`Created admin: ${admin.firstName} ${admin.lastName} (${admin.id})`);
    } else {
      console.log(`Admin already exists: ${admin.firstName} ${admin.lastName} (${admin.id})`);
    }

    // 3. Seed permissions
    let permissionsCreated = 0;
    const permissionIds: string[] = [];

    for (const menu of menuItems) {
      for (const action of defaultActions) {
        let permission = await prisma.permission.findFirst({
          where: { name: action, groupName: menu, userId: admin.id },
        });

        if (!permission) {
          permission = await prisma.permission.create({
            data: {
              name: action,
              groupName: menu,
              status: "active",
              createdById: admin.id,
              userId: admin.id,
            },
          });
          permissionsCreated++;
        }

        permissionIds.push(permission.id);
      }
    }
    console.log(`Permissions: ${permissionsCreated} created, ${permissionIds.length} total`);

    // 4. Assign all permissions to the Super Admin role
    let rolesLinked = 0;
    for (const permissionId of permissionIds) {
      const existing = await prisma.permission_role.findFirst({
        where: { roleId: role.id, permissionId },
      });

      if (!existing) {
        await prisma.permission_role.create({
          data: { roleId: role.id, permissionId },
        });
        rolesLinked++;
      }
    }
    console.log(`Permission-role links: ${rolesLinked} created`);

    // Summary
    console.log("\n--- Seed Complete ---");
    console.log(`Role:     ${role.name}`);
    console.log(`Admin:    ${admin.email}`);
    console.log(`Password: ${ADMIN_DATA.password}`);
    console.log(`Permissions: ${permissionIds.length} (${menuItems.length} menus x ${defaultActions.length} actions)`);
    console.log("\nYou can now log in at /signin");
  } catch (error) {
    console.error("Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();

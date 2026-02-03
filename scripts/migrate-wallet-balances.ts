/**
 * Migration Script: Recalculate Wallet Balances
 *
 * This script recalculates all wallet balances based on transaction history
 * to populate the new wallet fields (totalSpend, totalWithdraw, totalRefunded)
 *
 * Run with: npx ts-node scripts/migrate-wallet-balances.ts
 * Or: npx tsx scripts/migrate-wallet-balances.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface WalletUpdate {
  id: string;
  type: "customer" | "model";
  oldValues: {
    totalBalance: number;
    totalRecharge?: number;
  };
  newValues: {
    totalBalance: number;
    totalSpend: number;
    totalWithdraw: number;
    totalRefunded: number;
    totalPending: number;
    // Calculated field (not stored, computed on read):
    // Customer: totalBalance - totalSpend + totalRefunded
    // Model: totalBalance - totalWithdraw
    totalAvailable: number;
  };
}

async function migrateCustomerWallets(): Promise<WalletUpdate[]> {
  console.log("\n📊 Migrating Customer Wallets...\n");

  const updates: WalletUpdate[] = [];

  // Get all customer wallets
  const customerWallets = await prisma.wallet.findMany({
    where: {
      customerId: { not: null },
      status: "active",
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
        },
      },
    },
  });

  console.log(`Found ${customerWallets.length} customer wallets to migrate\n`);

  for (const wallet of customerWallets) {
    if (!wallet.customerId) continue;

    // Calculate totalBalance from approved recharges
    const rechargeResult = await prisma.transaction_history.aggregate({
      where: {
        customerId: wallet.customerId,
        identifier: "recharge",
        status: "approved",
      },
      _sum: { amount: true },
    });
    const totalBalance = rechargeResult._sum.amount || 0;

    // Calculate totalSpend from booking holds (released/held) + subscriptions
    const holdResult = await prisma.transaction_history.aggregate({
      where: {
        customerId: wallet.customerId,
        identifier: "booking_hold",
        status: { in: ["held", "released"] }, // Only count active holds
      },
      _sum: { amount: true },
    });
    // booking_hold amounts are negative, so we need absolute value
    const holdAmount = Math.abs(holdResult._sum.amount || 0);

    const subscriptionResult = await prisma.transaction_history.aggregate({
      where: {
        customerId: wallet.customerId,
        identifier: "subscription",
        status: "approved",
      },
      _sum: { amount: true },
    });
    const subscriptionAmount = subscriptionResult._sum.amount || 0;

    const totalSpend = holdAmount + subscriptionAmount;

    // Calculate totalRefunded from booking refunds
    const refundResult = await prisma.transaction_history.aggregate({
      where: {
        customerId: wallet.customerId,
        identifier: "booking_refund",
        status: "approved",
      },
      _sum: { amount: true },
    });
    const totalRefunded = refundResult._sum.amount || 0;

    // Calculate totalAvailable: totalBalance - totalSpend + totalRefunded
    const totalAvailable = totalBalance - totalSpend + totalRefunded;

    const update: WalletUpdate = {
      id: wallet.id,
      type: "customer",
      oldValues: {
        totalBalance: wallet.totalBalance,
        totalRecharge: wallet.totalRecharge,
      },
      newValues: {
        totalBalance,
        totalSpend,
        totalWithdraw: 0, // Customers don't withdraw
        totalRefunded,
        totalPending: 0, // Customers don't have pending
        totalAvailable, // Computed: totalBalance - totalSpend + totalRefunded
      },
    };

    updates.push(update);

    console.log(`Customer: ${wallet.customer?.firstName || wallet.customerId}`);
    console.log(`  Old totalBalance: ${wallet.totalBalance.toLocaleString()}`);
    console.log(`  New totalBalance (recharges): ${totalBalance.toLocaleString()}`);
    console.log(`  New totalSpend: ${totalSpend.toLocaleString()}`);
    console.log(`  New totalRefunded: ${totalRefunded.toLocaleString()}`);
    console.log(`  ➜ totalAvailable: ${totalAvailable.toLocaleString()} (totalBalance - totalSpend + totalRefunded)`);
    console.log("");

    // Update the wallet
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        totalBalance,
        totalSpend,
        totalWithdraw: 0,
        totalRefunded,
        totalPending: 0,
      },
    });
  }

  return updates;
}

async function migrateModelWallets(): Promise<WalletUpdate[]> {
  console.log("\n📊 Migrating Model Wallets...\n");

  const updates: WalletUpdate[] = [];

  // Get all model wallets
  const modelWallets = await prisma.wallet.findMany({
    where: {
      modelId: { not: null },
      status: "active",
    },
    include: {
      model: {
        select: {
          id: true,
          firstName: true,
        },
      },
    },
  });

  console.log(`Found ${modelWallets.length} model wallets to migrate\n`);

  for (const wallet of modelWallets) {
    if (!wallet.modelId) continue;

    // Calculate totalBalance from approved earnings (booking_earning + referral)
    const earningResult = await prisma.transaction_history.aggregate({
      where: {
        modelId: wallet.modelId,
        identifier: { in: ["booking_earning", "referral"] },
        status: "approved",
      },
      _sum: { amount: true },
    });
    const totalBalance = earningResult._sum.amount || 0;

    // Calculate totalPending from pending booking earnings
    const pendingResult = await prisma.transaction_history.aggregate({
      where: {
        modelId: wallet.modelId,
        identifier: "booking_earning",
        status: "pending",
      },
      _sum: { amount: true },
    });
    const totalPending = pendingResult._sum.amount || 0;

    // Calculate totalWithdraw from approved withdrawals
    const withdrawResult = await prisma.transaction_history.aggregate({
      where: {
        modelId: wallet.modelId,
        identifier: { in: ["withdrawal", "withdraw"] },
        status: "approved",
      },
      _sum: { amount: true },
    });
    const totalWithdraw = withdrawResult._sum.amount || 0;

    // Calculate totalAvailable: totalBalance - totalWithdraw
    const totalAvailable = totalBalance - totalWithdraw;

    const update: WalletUpdate = {
      id: wallet.id,
      type: "model",
      oldValues: {
        totalBalance: wallet.totalBalance,
        totalRecharge: wallet.totalRecharge,
      },
      newValues: {
        totalBalance,
        totalSpend: 0, // Models don't spend
        totalWithdraw,
        totalRefunded: 0, // Models don't get refunds
        totalPending,
        totalAvailable, // Computed: totalBalance - totalWithdraw
      },
    };

    updates.push(update);

    console.log(`Model: ${wallet.model?.firstName || wallet.modelId}`);
    console.log(`  Old totalBalance: ${wallet.totalBalance.toLocaleString()}`);
    console.log(`  New totalBalance (earnings): ${totalBalance.toLocaleString()}`);
    console.log(`  New totalWithdraw: ${totalWithdraw.toLocaleString()}`);
    console.log(`  New totalPending: ${totalPending.toLocaleString()}`);
    console.log(`  ➜ totalAvailable: ${totalAvailable.toLocaleString()} (totalBalance - totalWithdraw)`);
    console.log("");

    // Update the wallet
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        totalBalance,
        totalSpend: 0,
        totalWithdraw,
        totalRefunded: 0,
        totalPending,
      },
    });
  }

  return updates;
}

async function generateReport(customerUpdates: WalletUpdate[], modelUpdates: WalletUpdate[]) {
  console.log("\n" + "=".repeat(60));
  console.log("📋 MIGRATION REPORT");
  console.log("=".repeat(60));

  console.log(`\nCustomer Wallets Migrated: ${customerUpdates.length}`);
  console.log(`Model Wallets Migrated: ${modelUpdates.length}`);
  console.log(`Total Wallets Migrated: ${customerUpdates.length + modelUpdates.length}`);

  // Summary of changes
  let customersWithChanges = 0;
  let modelsWithChanges = 0;

  for (const update of customerUpdates) {
    if (update.oldValues.totalBalance !== update.newValues.totalBalance) {
      customersWithChanges++;
    }
  }

  for (const update of modelUpdates) {
    if (update.oldValues.totalBalance !== update.newValues.totalBalance) {
      modelsWithChanges++;
    }
  }

  console.log(`\nCustomers with balance changes: ${customersWithChanges}`);
  console.log(`Models with balance changes: ${modelsWithChanges}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Migration completed successfully!");
  console.log("=".repeat(60) + "\n");
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 WALLET BALANCE MIGRATION SCRIPT");
  console.log("=".repeat(60));
  console.log("\nThis script will recalculate all wallet balances based on");
  console.log("transaction history to populate the new wallet fields.\n");
  console.log("New Schema:");
  console.log("  Customer: totalBalance, totalSpend, totalRefunded");
  console.log("    ➜ totalAvailable = totalBalance - totalSpend + totalRefunded");
  console.log("  Model: totalBalance, totalWithdraw, totalPending");
  console.log("    ➜ totalAvailable = totalBalance - totalWithdraw");
  console.log("");

  try {
    // Migrate customer wallets
    const customerUpdates = await migrateCustomerWallets();

    // Migrate model wallets
    const modelUpdates = await migrateModelWallets();

    // Generate report
    await generateReport(customerUpdates, modelUpdates);

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
